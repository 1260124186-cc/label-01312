// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 订阅消息管理云函数
 * 功能：
 * - 保存用户订阅消息记录
 * - 获取用户订阅设置
 * - 更新订阅设置
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { action, data } = event;

  try {
    switch (action) {
      case 'saveSubscribe':
        return await saveSubscribe(openid, data);
      case 'getSettings':
        return await getSettings(openid);
      case 'updateSettings':
        return await updateSettings(openid, data);
      default:
        return {
          code: -1,
          message: '未知操作'
        };
    }
  } catch (err) {
    console.error('订阅消息操作失败', err);
    return {
      code: -1,
      message: '操作失败',
      error: err
    };
  }
};

/**
 * 保存用户订阅消息记录
 */
async function saveSubscribe(openid, data) {
  const { templateId, scene = 0 } = data;

  if (!templateId) {
    return {
      code: -1,
      message: '缺少模板ID'
    };
  }

  // 保存订阅记录
  await db.collection('subscribe_messages').add({
    data: {
      userId: openid,
      templateId: templateId,
      scene: scene,
      createTime: db.serverDate()
    }
  });

  return {
    code: 0,
    message: '订阅成功'
  };
}

/**
 * 获取用户订阅设置
 */
async function getSettings(openid) {
  const result = await db.collection('user_settings').where({
    _openid: openid
  }).get();

  const defaultSettings = {
    notificationEnabled: true,
    appointmentNotification: true,
    evaluationNotification: true,
    systemNotification: true
  };

  if (result.data.length > 0) {
    return {
      code: 0,
      message: '获取成功',
      data: {
        ...defaultSettings,
        ...result.data[0]
      }
    };
  }

  return {
    code: 0,
    message: '获取成功',
    data: defaultSettings
  };
}

/**
 * 更新用户订阅设置
 */
async function updateSettings(openid, data) {
  const {
    notificationEnabled,
    appointmentNotification,
    evaluationNotification,
    systemNotification
  } = data;

  const settings = {};
  if (typeof notificationEnabled !== 'undefined') settings.notificationEnabled = notificationEnabled;
  if (typeof appointmentNotification !== 'undefined') settings.appointmentNotification = appointmentNotification;
  if (typeof evaluationNotification !== 'undefined') settings.evaluationNotification = evaluationNotification;
  if (typeof systemNotification !== 'undefined') settings.systemNotification = systemNotification;

  // 检查是否已存在设置记录
  const existing = await db.collection('user_settings').where({
    _openid: openid
  }).get();

  if (existing.data.length > 0) {
    // 更新
    await db.collection('user_settings').doc(existing.data[0]._id).update({
      data: {
        ...settings,
        updateTime: db.serverDate()
      }
    });
  } else {
    // 创建
    await db.collection('user_settings').add({
      data: {
        _openid: openid,
        ...settings,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
  }

  return {
    code: 0,
    message: '设置已更新'
  };
}
