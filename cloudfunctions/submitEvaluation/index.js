// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 评价提交与积分计算云函数
 * 功能：提交评价、计算并更新用户信誉分
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  const { action, data } = event;

  try {
    switch (action) {
      case 'submit':
        return await submitEvaluation(openid, data);
      case 'getEvaluations':
        return await getEvaluations(data);
      case 'checkEvaluated':
        return await checkEvaluated(openid, data);
      default:
        return {
          code: -1,
          message: '未知操作'
        };
    }
  } catch (err) {
    console.error('评价操作失败', err);
    return {
      code: -1,
      message: '操作失败',
      error: err
    };
  }
};

/**
 * 提交评价
 */
async function submitEvaluation(openid, data) {
  const {
    appointmentId,
    rating,      // 评分 1-5
    comment,     // 评价内容
    tags         // 评价标签
  } = data;

  // 获取预约信息
  const appointmentResult = await db.collection('appointments').doc(appointmentId).get();
  if (!appointmentResult.data) {
    return {
      code: -1,
      message: '预约不存在'
    };
  }

  const appointment = appointmentResult.data;

  // 验证预约状态
  if (appointment.status !== 'completed') {
    return {
      code: -2,
      message: '只能评价已完成的交换'
    };
  }

  // 验证评价者身份
  if (appointment.providerId !== openid && appointment.receiverId !== openid) {
    return {
      code: -3,
      message: '无权评价此交换'
    };
  }

  // 确定被评价者
  const evaluateeId = appointment.providerId === openid 
    ? appointment.receiverId 
    : appointment.providerId;

  // 检查是否已评价
  const existingEvaluation = await db.collection('evaluations').where({
    appointmentId: appointmentId,
    evaluatorId: openid
  }).get();

  if (existingEvaluation.data.length > 0) {
    return {
      code: -4,
      message: '您已评价过此次交换'
    };
  }

  // 获取评价者信息
  const evaluatorResult = await db.collection('users').where({
    _openid: openid
  }).get();
  const evaluatorInfo = evaluatorResult.data[0] || {};

  // 创建评价记录
  const evaluation = {
    appointmentId: appointmentId,
    skillId: appointment.skillId,
    evaluatorId: openid,
    evaluateeId: evaluateeId,
    evaluatorInfo: {
      nickName: evaluatorInfo.nickName || '匿名用户',
      avatarUrl: evaluatorInfo.avatarUrl || ''
    },
    rating: rating,
    comment: comment || '',
    tags: tags || [],
    createTime: db.serverDate()
  };

  await db.collection('evaluations').add({
    data: evaluation
  });

  // 给被评价者发送新评价通知
  await sendMessage({
    userId: evaluateeId,
    type: 'new_evaluation',
    title: '收到新评价',
    content: `${evaluatorInfo.nickName || '用户'} 给了你 ${rating} 星评价！`,
    relatedId: appointmentId,
    relatedData: { appointmentId, evaluationId: null }
  });

  // 计算并更新被评价者的信誉分
  await updateCreditScore(evaluateeId, rating);

  return {
    code: 0,
    message: '评价提交成功'
  };
}

/**
 * 发送消息
 * 调用sendMessage云函数创建消息
 */
async function sendMessage(messageData) {
  try {
    await cloud.callFunction({
      name: 'sendMessage',
      data: {
        action: 'create',
        data: messageData
      }
    });
  } catch (err) {
    console.error('发送消息失败', err);
  }
}

/**
 * 计算并更新用户信誉分
 * 算法：基于历史评价的加权平均
 * - 新评价权重较高
 * - 信誉分范围 0-100
 */
async function updateCreditScore(userId, newRating) {
  // 获取用户所有评价
  const evaluationsResult = await db.collection('evaluations').where({
    evaluateeId: userId
  }).orderBy('createTime', 'desc').get();

  const evaluations = evaluationsResult.data;

  if (evaluations.length === 0) {
    return;
  }

  // 计算加权平均分
  // 最近的评价权重更高
  let totalWeight = 0;
  let weightedSum = 0;

  evaluations.forEach((evaluation, index) => {
    // 权重递减：最新的权重为1，往后依次递减
    const weight = 1 / (index + 1);
    totalWeight += weight;
    weightedSum += evaluation.rating * weight;
  });

  // 计算平均评分（1-5分）
  const averageRating = weightedSum / totalWeight;

  // 将评分转换为信誉分（0-100）
  // 公式：信誉分 = (平均评分 / 5) * 100
  // 并考虑交换次数的加成
  let creditScore = Math.round((averageRating / 5) * 100);

  // 确保信誉分在合理范围内
  creditScore = Math.max(0, Math.min(100, creditScore));

  // 更新用户信誉分
  await db.collection('users').where({
    _openid: userId
  }).update({
    data: {
      creditScore: creditScore,
      updateTime: db.serverDate()
    }
  });

  // 同时更新该用户发布的技能中的信誉分信息
  await db.collection('skills').where({
    _openid: userId
  }).update({
    data: {
      'publisherInfo.creditScore': creditScore
    }
  });
}

/**
 * 获取用户的评价列表
 */
async function getEvaluations(data) {
  const { userId, page = 1, pageSize = 10 } = data;

  const result = await db.collection('evaluations')
    .where({
      evaluateeId: userId
    })
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  const countResult = await db.collection('evaluations')
    .where({
      evaluateeId: userId
    })
    .count();

  // 计算平均评分
  let totalRating = 0;
  result.data.forEach(evaluation => {
    totalRating += evaluation.rating;
  });
  const averageRating = result.data.length > 0 
    ? (totalRating / result.data.length).toFixed(1) 
    : 0;

  return {
    code: 0,
    message: '获取成功',
    data: {
      list: result.data,
      total: countResult.total,
      averageRating: averageRating,
      page: page,
      pageSize: pageSize
    }
  };
}

/**
 * 检查是否已评价
 */
async function checkEvaluated(openid, data) {
  const { appointmentId } = data;

  const result = await db.collection('evaluations').where({
    appointmentId: appointmentId,
    evaluatorId: openid
  }).get();

  return {
    code: 0,
    data: {
      evaluated: result.data.length > 0
    }
  };
}
