// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数 - 用户登录
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  try {
    // 查询用户是否存在
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();

    if (userResult.data.length === 0) {
      // 新用户，创建用户记录
      const newUser = {
        _openid: openid,
        nickName: '新用户',
        avatarUrl: '',
        gender: 0,
        campus: '',
        major: '',
        grade: '',
        introduction: '',
        skills: [],
        creditScore: 100, // 初始信誉分
        totalExchanges: 0,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      };

      await db.collection('users').add({
        data: newUser
      });

      return {
        code: 0,
        message: '登录成功（新用户）',
        openid: openid,
        userInfo: newUser,
        isNewUser: true
      };
    } else {
      // 老用户，返回用户信息
      return {
        code: 0,
        message: '登录成功',
        openid: openid,
        userInfo: userResult.data[0],
        isNewUser: false
      };
    }
  } catch (err) {
    console.error('登录失败', err);
    return {
      code: -1,
      message: '登录失败',
      error: err
    };
  }
};
