// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 消息通知云函数
 * 功能：创建消息、获取消息列表、标记已读、获取未读数量
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { action, data } = event;

  try {
    switch (action) {
      case 'create':
        return await createMessage(data);
      case 'getList':
        return await getMessageList(openid, data);
      case 'markAsRead':
        return await markAsRead(openid, data);
      case 'getUnreadCount':
        return await getUnreadCount(openid);
      case 'markAllAsRead':
        return await markAllAsRead(openid);
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
 * 创建消息
 * 由其他云函数调用，无需验证openid权限
 */
async function createMessage(data) {
  const {
    userId,           // 接收用户openid
    type,             // 消息类型：new_appointment, status_changed, new_evaluation, system
    title,            // 消息标题
    content,          // 消息内容
    relatedId,        // 关联ID（预约ID、评价ID等）
    relatedData       // 关联数据（可选）
  } = data;

  if (!userId || !type || !title) {
    return {
      code: -1,
      message: '缺少必要参数'
    };
  }

  const message = {
    userId: userId,
    type: type,
    title: title,
    content: content || '',
    relatedId: relatedId || '',
    relatedData: relatedData || {},
    isRead: false,
    createTime: db.serverDate()
  };

  const result = await db.collection('messages').add({
    data: message
  });

  return {
    code: 0,
    message: '消息创建成功',
    data: {
      messageId: result._id
    }
  };
}

/**
 * 获取用户消息列表
 */
async function getMessageList(openid, data) {
  const { page = 1, pageSize = 20, type = 'all' } = data;

  let query = { userId: openid };
  if (type !== 'all') {
    query.type = type;
  }

  const result = await db.collection('messages')
    .where(query)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  const countResult = await db.collection('messages')
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
 * 标记单条消息为已读
 */
async function markAsRead(openid, data) {
  const { messageId } = data;

  if (!messageId) {
    return {
      code: -1,
      message: '缺少消息ID'
    };
  }

  await db.collection('messages').where({
    _id: messageId,
    userId: openid
  }).update({
    data: {
      isRead: true
    }
  });

  return {
    code: 0,
    message: '标记已读成功'
  };
}

/**
 * 标记全部消息为已读
 */
async function markAllAsRead(openid) {
  await db.collection('messages').where({
    userId: openid,
    isRead: false
  }).update({
    data: {
      isRead: true
    }
  });

  return {
    code: 0,
    message: '全部已读成功'
  };
}

/**
 * 获取未读消息数量
 */
async function getUnreadCount(openid) {
  const countResult = await db.collection('messages')
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
