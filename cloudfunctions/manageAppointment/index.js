// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 创建消息通知（内部函数）
 */
async function createNotification(notificationData) {
  try {
    await cloud.callFunction({
      name: 'manageNotification',
      data: {
        action: 'create',
        data: notificationData
      }
    });
  } catch (err) {
    console.error('创建通知失败', err);
    // 通知创建失败不影响主业务流程
  }
}

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

  // 发送通知给技能提供者
  await createNotification({
    userId: providerId,
    type: 'appointment_new',
    title: '收到新预约',
    content: `${receiverInfo.nickName || '有人'}预约了您的技能「${skill.title}」`,
    relatedId: result._id,
    relatedType: 'appointment',
    extraData: {
      skillTitle: skill.title,
      appointmentTime: appointmentTime,
      partnerName: receiverInfo.nickName || '未知用户'
    }
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

  // 发送状态变更通知
  const notificationTypeMap = {
    'confirmed': 'appointment_accepted',
    'cancelled': 'appointment_cancelled',
    'completed': 'appointment_completed'
  };

  const notificationTitleMap = {
    'confirmed': '预约已接受',
    'cancelled': '预约已取消',
    'completed': '技能交换完成'
  };

  const notificationContentMap = {
    'confirmed': `您的预约「${appointment.skillTitle}」已被接受`,
    'cancelled': `预约「${appointment.skillTitle}」已被取消`,
    'completed': `技能交换「${appointment.skillTitle}」已完成，快去评价吧`
  };

  // 确定通知接收者
  let notifyUserId;
  let partnerName;
  if (status === 'confirmed' || status === 'cancelled') {
    // 通知预约发起者（receiver）
    notifyUserId = appointment.receiverId;
    partnerName = appointment.providerInfo.nickName;
  } else if (status === 'completed') {
    // 完成时通知双方
    notifyUserId = appointment.receiverId === openid ? appointment.providerId : appointment.receiverId;
    partnerName = appointment.receiverId === openid ? appointment.receiverInfo.nickName : appointment.providerInfo.nickName;
  }

  if (notifyUserId && notificationTypeMap[status]) {
    await createNotification({
      userId: notifyUserId,
      type: notificationTypeMap[status],
      title: notificationTitleMap[status],
      content: notificationContentMap[status],
      relatedId: appointmentId,
      relatedType: 'appointment',
      extraData: {
        skillTitle: appointment.skillTitle,
        appointmentTime: appointment.appointmentTime,
        partnerName: partnerName,
        status: status
      }
    });

    // 完成状态时，给另一方也发送通知
    if (status === 'completed') {
      const otherUserId = notifyUserId === appointment.receiverId ? appointment.providerId : appointment.receiverId;
      const otherPartnerName = notifyUserId === appointment.receiverId ? appointment.providerInfo.nickName : appointment.receiverInfo.nickName;
      await createNotification({
        userId: otherUserId,
        type: 'appointment_completed',
        title: '技能交换完成',
        content: `技能交换「${appointment.skillTitle}」已完成，快去评价吧`,
        relatedId: appointmentId,
        relatedType: 'appointment',
        extraData: {
          skillTitle: appointment.skillTitle,
          appointmentTime: appointment.appointmentTime,
          partnerName: otherPartnerName,
          status: status
        }
      });
    }
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
