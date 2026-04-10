// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 消息通知管理云函数
 * 功能：
 * - 创建消息通知
 * - 获取消息列表
 * - 标记消息已读
 * - 标记所有消息已读
 * - 获取未读消息数量
 * - 删除消息
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { action, data } = event;

  try {
    switch (action) {
      case 'create':
        return await createNotification(data);
      case 'getList':
        return await getNotificationList(openid, data);
      case 'markRead':
        return await markAsRead(openid, data);
      case 'markAllRead':
        return await markAllAsRead(openid);
      case 'getUnreadCount':
        return await getUnreadCount(openid);
      case 'delete':
        return await deleteNotification(openid, data);
      default:
        return {
          code: -1,
          message: '未知操作'
        };
    }
  } catch (err) {
    console.error('消息操作失败', err);
    return {
      code: -1,
      message: '操作失败',
      error: err
    };
  }
};

/**
 * 创建消息通知
 * 用于其他云函数调用，发送系统通知
 */
async function createNotification(data) {
  const {
    userId,           // 接收者openid
    type,             // 消息类型：appointment_new, appointment_accepted, appointment_rejected, appointment_cancelled, appointment_completed, evaluation_new, system
    title,            // 消息标题
    content,          // 消息内容
    relatedId,        // 关联ID（如预约ID、评价ID等）
    relatedType,      // 关联类型：appointment, evaluation, skill
    extraData = {}    // 额外数据
  } = data;

  if (!userId || !type || !title) {
    return {
      code: -1,
      message: '缺少必要参数'
    };
  }

  const notification = {
    userId: userId,
    type: type,
    title: title,
    content: content || '',
    relatedId: relatedId || '',
    relatedType: relatedType || '',
    extraData: extraData,
    isRead: false,
    createTime: db.serverDate(),
    readTime: null
  };

  const result = await db.collection('notifications').add({
    data: notification
  });

  // 发送订阅消息（如果用户已授权）
  await sendSubscribeMessage(userId, type, title, content, extraData);

  return {
    code: 0,
    message: '消息创建成功',
    data: {
      notificationId: result._id
    }
  };
}

/**
 * 发送订阅消息
 */
async function sendSubscribeMessage(userId, type, title, content, extraData) {
  try {
    // 获取用户的订阅消息设置
    const userSettings = await db.collection('user_settings').where({
      _openid: userId
    }).get();

    // 检查用户是否开启了对应类型的消息通知
    const settings = userSettings.data[0];
    if (settings && settings.notificationEnabled === false) {
      return;
    }

    // 根据消息类型选择对应的订阅消息模板
    const templateMap = {
      'appointment_new': 'appointment_new_template_id',
      'appointment_accepted': 'appointment_accepted_template_id',
      'appointment_rejected': 'appointment_rejected_template_id',
      'appointment_cancelled': 'appointment_cancelled_template_id',
      'appointment_completed': 'appointment_completed_template_id',
      'evaluation_new': 'evaluation_new_template_id'
    };

    const templateId = templateMap[type];
    if (!templateId) return;

    // 获取用户的订阅消息记录
    const subscribeRecords = await db.collection('subscribe_messages').where({
      userId: userId,
      templateId: templateId
    }).orderBy('createTime', 'desc').limit(1).get();

    if (subscribeRecords.data.length === 0) return;

    const record = subscribeRecords.data[0];

    // 发送订阅消息
    await cloud.openapi.subscribeMessage.send({
      touser: userId,
      templateId: templateId,
      page: getPageByType(type, extraData),
      data: buildMessageData(type, title, content, extraData)
    });

  } catch (err) {
    console.error('发送订阅消息失败', err);
    // 订阅消息发送失败不影响业务流程
  }
}

/**
 * 根据消息类型获取跳转页面
 */
function getPageByType(type, extraData) {
  const pageMap = {
    'appointment_new': `/pages/appointment/appointment`,
    'appointment_accepted': `/pages/appointment/appointment`,
    'appointment_rejected': `/pages/appointment/appointment`,
    'appointment_cancelled': `/pages/appointment/appointment`,
    'appointment_completed': `/pages/appointment/appointment`,
    'evaluation_new': `/pages/profile/profile`
  };
  return pageMap[type] || 'pages/index/index';
}

/**
 * 构建订阅消息数据
 */
function buildMessageData(type, title, content, extraData) {
  // 根据不同类型的消息构建不同的数据格式
  const dataMap = {
    'appointment_new': {
      thing1: { value: title },
      thing2: { value: content },
      time3: { value: extraData.appointmentTime || '' }
    },
    'appointment_accepted': {
      thing1: { value: title },
      thing2: { value: '您的预约已被接受' },
      time3: { value: extraData.appointmentTime || '' }
    },
    'appointment_rejected': {
      thing1: { value: title },
      thing2: { value: '您的预约已被拒绝' },
      thing3: { value: content }
    },
    'appointment_cancelled': {
      thing1: { value: title },
      thing2: { value: '预约已被取消' },
      thing3: { value: content }
    },
    'appointment_completed': {
      thing1: { value: title },
      thing2: { value: '技能交换已完成' },
      thing3: { value: '快去评价对方吧' }
    },
    'evaluation_new': {
      thing1: { value: title },
      thing2: { value: '您收到了新评价' },
      thing3: { value: content }
    }
  };

  return dataMap[type] || {
    thing1: { value: title },
    thing2: { value: content }
  };
}

/**
 * 获取消息列表
 */
async function getNotificationList(openid, data) {
  const { page = 1, pageSize = 20, type } = data || {};

  let query = {
    userId: openid
  };

  // 按类型筛选
  if (type) {
    query.type = type;
  }

  const result = await db.collection('notifications')
    .where(query)
    .orderBy('isRead', 'asc')  // 未读在前
    .orderBy('createTime', 'desc')  // 时间倒序
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  const countResult = await db.collection('notifications')
    .where(query)
    .count();

  const unreadCount = await db.collection('notifications')
    .where({
      userId: openid,
      isRead: false
    })
    .count();

  return {
    code: 0,
    message: '获取成功',
    data: {
      list: result.data,
      total: countResult.total,
      unreadCount: unreadCount.total,
      page: page,
      pageSize: pageSize
    }
  };
}

/**
 * 标记消息已读
 */
async function markAsRead(openid, data) {
  const { notificationId } = data;

  if (!notificationId) {
    return {
      code: -1,
      message: '缺少消息ID'
    };
  }

  // 验证消息归属
  const notification = await db.collection('notifications').doc(notificationId).get();
  if (!notification.data || notification.data.userId !== openid) {
    return {
      code: -2,
      message: '无权操作此消息'
    };
  }

  await db.collection('notifications').doc(notificationId).update({
    data: {
      isRead: true,
      readTime: db.serverDate()
    }
  });

  return {
    code: 0,
    message: '已标记为已读'
  };
}

/**
 * 标记所有消息已读
 */
async function markAllAsRead(openid) {
  const result = await db.collection('notifications')
    .where({
      userId: openid,
      isRead: false
    })
    .update({
      data: {
        isRead: true,
        readTime: db.serverDate()
      }
    });

  return {
    code: 0,
    message: '全部已读',
    data: {
      updatedCount: result.stats.updated
    }
  };
}

/**
 * 获取未读消息数量
 */
async function getUnreadCount(openid) {
  const countResult = await db.collection('notifications')
    .where({
      userId: openid,
      isRead: false
    })
    .count();

  return {
    code: 0,
    message: '获取成功',
    data: {
      unreadCount: countResult.total
    }
  };
}

/**
 * 删除消息
 */
async function deleteNotification(openid, data) {
  const { notificationId } = data;

  if (!notificationId) {
    return {
      code: -1,
      message: '缺少消息ID'
    };
  }

  // 验证消息归属
  const notification = await db.collection('notifications').doc(notificationId).get();
  if (!notification.data || notification.data.userId !== openid) {
    return {
      code: -2,
      message: '无权操作此消息'
    };
  }

  await db.collection('notifications').doc(notificationId).remove();

  return {
    code: 0,
    message: '删除成功'
  };
}
