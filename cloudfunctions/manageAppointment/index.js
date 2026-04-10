// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 预约管理云函数
 * 功能：创建预约、更新预约状态、取消预约、检查预约状态
 * 特点：使用事务防止同一时间被多人预约
 *
 * 支持的 action:
 * - create: 创建预约
 * - updateStatus: 更新预约状态
 * - cancel: 取消预约
 * - getMyAppointments: 获取我的预约列表
 * - checkAppointment: 检查是否已预约某个技能
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { action, data } = event;

  try {
    switch (action) {
      case 'create':
        return await createAppointment(openid, data);
      case 'updateStatus':
        return await updateAppointmentStatus(openid, data);
      case 'cancel':
        return await cancelAppointment(openid, data);
      case 'getMyAppointments':
        return await getMyAppointments(openid, data);
      case 'checkAppointment':
        return await checkAppointment(openid, data);
      default:
        return {
          code: -1,
          message: '未知操作'
        };
    }
  } catch (err) {
    console.error('预约操作失败', err);
    return {
      code: -1,
      message: '操作失败',
      error: err
    };
  }
};

/**
 * 创建预约
 * 使用事务确保同一时间段不会被重复预约
 */
async function createAppointment(openid, data) {
  const {
    skillId,
    providerId,
    appointmentTime,
    duration,
    location,
    message
  } = data;

  // 检查是否已存在相同时间的预约
  const existingAppointment = await db.collection('appointments').where({
    skillId: skillId,
    appointmentTime: appointmentTime,
    status: _.in(['pending', 'confirmed'])
  }).get();

  if (existingAppointment.data.length > 0) {
    return {
      code: -2,
      message: '该时间段已被预约，请选择其他时间'
    };
  }

  // 获取技能信息
  const skillResult = await db.collection('skills').doc(skillId).get();
  if (!skillResult.data) {
    return {
      code: -3,
      message: '技能不存在'
    };
  }
  const skill = skillResult.data;

  // 获取预约双方的用户信息
  const providerResult = await db.collection('users').where({
    _openid: providerId
  }).get();

  const receiverResult = await db.collection('users').where({
    _openid: openid
  }).get();

  const providerInfo = providerResult.data[0] || {};
  const receiverInfo = receiverResult.data[0] || {};

  // 创建预约记录
  const appointment = {
    skillId: skillId,
    providerId: providerId,
    receiverId: openid,
    providerInfo: {
      nickName: providerInfo.nickName || '未知用户',
      avatarUrl: providerInfo.avatarUrl || ''
    },
    receiverInfo: {
      nickName: receiverInfo.nickName || '未知用户',
      avatarUrl: receiverInfo.avatarUrl || ''
    },
    skillTitle: skill.title,
    skillType: skill.type,
    appointmentTime: appointmentTime,
    duration: duration || skill.duration || 1,
    location: location || '',
    status: 'pending', // 待确认
    message: message || '',
    createTime: db.serverDate(),
    updateTime: db.serverDate()
  };

  const result = await db.collection('appointments').add({
    data: appointment
  });

  // 给技能提供者发送新预约消息通知
  await sendMessage({
    userId: providerId,
    type: 'new_appointment',
    title: '收到新的预约请求',
    content: `${receiverInfo.nickName || '用户'} 预约了您的「${skill.title}」技能，请及时确认。`,
    relatedId: result._id,
    relatedData: { appointmentId: result._id }
  });

  return {
    code: 0,
    message: '预约创建成功，等待对方确认',
    data: {
      appointmentId: result._id
    }
  };
}

/**
 * 更新预约状态
 */
async function updateAppointmentStatus(openid, data) {
  const { appointmentId, status } = data;

  // 获取预约信息
  const appointmentResult = await db.collection('appointments').doc(appointmentId).get();
  if (!appointmentResult.data) {
    return {
      code: -1,
      message: '预约不存在'
    };
  }

  const appointment = appointmentResult.data;

  // 验证权限（只有预约双方可以操作）
  if (appointment.providerId !== openid && appointment.receiverId !== openid) {
    return {
      code: -2,
      message: '无权操作此预约'
    };
  }

  // 状态流转校验
  const validTransitions = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': []
  };

  if (!validTransitions[appointment.status].includes(status)) {
    return {
      code: -3,
      message: '无效的状态变更'
    };
  }

  // 更新状态
  await db.collection('appointments').doc(appointmentId).update({
    data: {
      status: status,
      updateTime: db.serverDate()
    }
  });

  // 发送状态变更消息通知
  let notifyUserId, notifyTitle, notifyContent;
  const otherPartyName = appointment.providerId === openid
    ? appointment.receiverInfo.nickName
    : appointment.providerInfo.nickName;

  if (status === 'confirmed') {
    notifyUserId = appointment.receiverId;
    notifyTitle = '预约已被接受';
    notifyContent = `${otherPartyName || '对方'}已接受了您「${appointment.skillTitle}」的预约，准备开始交换吧！`;
  } else if (status === 'cancelled') {
    notifyUserId = appointment.providerId === openid ? appointment.receiverId : appointment.providerId;
    notifyTitle = '预约已取消';
    notifyContent = `${otherPartyName || '对方'}取消了「${appointment.skillTitle}」的预约。`;
  } else if (status === 'completed') {
    notifyUserId = appointment.providerId === openid ? appointment.receiverId : appointment.providerId;
    notifyTitle = '预约已完成';
    notifyContent = `「${appointment.skillTitle}」交换已完成，记得去评价哦！`;
  }

  if (notifyUserId && notifyTitle) {
    await sendMessage({
      userId: notifyUserId,
      type: 'status_changed',
      title: notifyTitle,
      content: notifyContent,
      relatedId: appointmentId,
      relatedData: { appointmentId }
    });
  }

  // 如果完成，更新双方的交换次数
  if (status === 'completed') {
    await db.collection('users').where({
      _openid: appointment.providerId
    }).update({
      data: {
        totalExchanges: _.inc(1)
      }
    });

    await db.collection('users').where({
      _openid: appointment.receiverId
    }).update({
      data: {
        totalExchanges: _.inc(1)
      }
    });
  }

  return {
    code: 0,
    message: '状态更新成功'
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
 * 取消预约
 */
async function cancelAppointment(openid, data) {
  return await updateAppointmentStatus(openid, {
    appointmentId: data.appointmentId,
    status: 'cancelled'
  });
}

/**
 * 获取我的预约列表
 */
async function getMyAppointments(openid, data) {
  const { type = 'all', status, page = 1, pageSize = 10 } = data;

  let query = {};

  // 根据类型筛选
  if (type === 'provider') {
    query.providerId = openid;
  } else if (type === 'receiver') {
    query.receiverId = openid;
  } else {
    query = _.or([
      { providerId: openid },
      { receiverId: openid }
    ]);
  }

  // 状态筛选
  if (status) {
    query.status = status;
  }

  const result = await db.collection('appointments')
    .where(query)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  const countResult = await db.collection('appointments')
    .where(query)
    .count();

  return {
    code: 0,
    message: '获取成功',
    data: {
      list: result.data,
      total: countResult.total,
      page: page,
      pageSize: pageSize
    }
  };
}

/**
 * 检查是否已预约某个技能
 * 用于防止重复预约
 */
async function checkAppointment(openid, data) {
  const { skillId } = data;

  if (!skillId) {
    return {
      code: -1,
      message: '缺少技能ID参数'
    };
  }

  // 查询当前用户是否已预约该技能（状态为pending或confirmed）
  const result = await db.collection('appointments').where({
    skillId: skillId,
    receiverId: openid,
    status: _.in(['pending', 'confirmed'])
  }).get();

  return {
    code: 0,
    data: {
      hasAppointment: result.data.length > 0,
      appointment: result.data.length > 0 ? result.data[0] : null
    }
  };
}
