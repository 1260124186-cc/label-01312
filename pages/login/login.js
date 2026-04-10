// pages/login/login.js
const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    canIUseGetUserProfile: false,
    showModal: false,
    modalTitle: '',
    modalContent: ''
  },

  // 用户协议内容
  userAgreementContent: `校园技能交换平台用户协议

一、服务条款的接受
欢迎使用校园技能交换平台（以下简称"本平台"）。在使用本平台前，请您仔细阅读本协议的全部内容。

二、服务内容
1. 本平台为在校学生提供技能交换服务，用户可以发布自己的技能或需求，与其他用户进行技能互换。
2. 本平台不涉及任何金钱交易，所有交换基于时间对等原则（如1小时换1小时）。
3. 本平台提供技能匹配、预约管理、评价反馈等功能。

三、用户行为规范
1. 用户应如实填写个人信息，不得冒用他人身份。
2. 用户发布的技能或需求内容应真实、合法、健康。
3. 用户应遵守预约时间，按时完成技能交换。
4. 禁止发布任何违法违规、侵权、虚假或不当内容。
5. 用户应尊重其他用户，文明交流，不得进行骚扰、辱骂等行为。

四、免责声明
1. 本平台仅提供信息发布和匹配服务，不对交换过程中发生的任何纠纷承担责任。
2. 用户应自行评估交换风险，建议在公共场所进行技能交换。
3. 对于因网络故障、系统维护等原因导致的服务中断，本平台不承担责任。

五、知识产权
1. 本平台的所有内容（包括但不限于文字、图片、代码）的知识产权归本平台所有。
2. 用户发布的内容，用户保留其知识产权，但授权本平台在平台内使用。

六、协议修改
本平台有权根据需要修改本协议，修改后的协议将在平台上公布。用户继续使用本平台即视为接受修改后的协议。

七、联系方式
如有任何问题，请联系平台管理员。`,

  // 隐私政策内容
  privacyPolicyContent: `校园技能交换平台隐私政策

一、信息收集
我们收集的信息包括：
1. 账户信息：微信昵称、头像等基本信息。
2. 发布信息：您发布的技能、需求、评价等内容。
3. 使用信息：您的浏览记录、预约记录等。
4. 设备信息：设备型号、操作系统版本等。

二、信息使用
我们使用收集的信息用于：
1. 提供、维护和改进我们的服务。
2. 进行技能匹配和推荐。
3. 发送服务通知和更新。
4. 防止欺诈和滥用行为。

三、信息共享
1. 我们不会将您的个人信息出售给第三方。
2. 您发布的技能、需求等信息将对其他用户可见。
3. 在法律要求的情况下，我们可能会披露您的信息。

四、信息安全
1. 我们采取合理的技术和管理措施保护您的信息安全。
2. 我们使用加密技术保护敏感数据。
3. 我们定期审查信息收集、存储和处理做法。

五、信息保留
1. 我们会在必要期限内保留您的信息。
2. 当您注销账户时，我们会按规定删除或匿名化您的个人信息。

六、您的权利
您有权：
1. 访问和更正您的个人信息。
2. 删除您的账户和相关信息。
3. 撤回对信息使用的同意。

七、未成年人保护
1. 本平台主要面向在校大学生。
2. 未满18周岁的用户应在监护人同意下使用本平台。

八、政策更新
我们可能会不时更新本隐私政策。更新后的政策将在平台上公布，建议您定期查看。

九、联系我们
如有任何隐私相关问题，请联系平台管理员。`,

  onLoad: function (options) {
    // 判断是否可以使用 getUserProfile
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    }
  },

  // 微信登录
  handleLogin: function () {
    const that = this;
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取用户信息成功', res);
        const userInfo = res.userInfo;
        
        // 开发模式下创建用户
        if (app.globalData.devMode) {
          // 生成模拟openid
          const mockOpenid = 'wx_user_' + Date.now();
          wx.setStorageSync('openid', mockOpenid);
          app.globalData.openid = mockOpenid;
          
          // 创建完整的用户信息对象
          const fullUserInfo = {
            _openid: mockOpenid,
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl,
            gender: userInfo.gender,
            creditScore: 100,
            totalExchanges: 0,
            createTime: new Date()
          };
          
          // 保存到本地和全局
          wx.setStorageSync('userInfo', fullUserInfo);
          app.globalData.userInfo = fullUserInfo;
          app.globalData.isLogin = true;
          
          // 添加到模拟数据
          app.globalData.mockData.users.push(fullUserInfo);
          
          util.showSuccess('登录成功');
          
          // 返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
          return;
        }
        
        // 云开发模式
        wx.setStorageSync('userInfo', userInfo);
        app.globalData.userInfo = userInfo;
        app.globalData.isLogin = true;
        
        // 调用云函数登录
        wx.cloud.callFunction({
          name: 'login',
          data: {},
          success: res => {
            if (res.result.code === 0) {
              wx.setStorageSync('openid', res.result.openid);
              app.globalData.openid = res.result.openid;
              
              util.showSuccess('登录成功');
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            }
          },
          fail: err => {
            console.error('登录失败', err);
            util.showError('登录失败');
          }
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
        if (err.errMsg.includes('cancel')) {
          util.showToast('已取消登录');
        } else {
          util.showToast('授权失败，请重试');
        }
      }
    });
  },

  // 返回
  goBack: function () {
    wx.navigateBack();
  },

  // 显示用户协议
  showUserAgreement: function () {
    this.setData({
      showModal: true,
      modalTitle: '用户协议',
      modalContent: this.userAgreementContent
    });
  },

  // 显示隐私政策
  showPrivacyPolicy: function () {
    this.setData({
      showModal: true,
      modalTitle: '隐私政策',
      modalContent: this.privacyPolicyContent
    });
  },

  // 关闭弹窗
  closeModal: function () {
    this.setData({
      showModal: false
    });
  },

  // 阻止滚动穿透
  preventMove: function () {
    return false;
  }
});
