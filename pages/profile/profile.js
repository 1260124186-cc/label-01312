// pages/profile/profile.js
const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    userInfo: null,
    isLogin: false,
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    // 统计数据
    stats: {
      publishedSkills: 0,
      publishedNeeds: 0,
      completedExchanges: 0,
      creditScore: 100
    },
    // 菜单列表
    menuList: [
      { id: 'mySkills', title: '我的技能', emoji: '🎯', url: '/pages/mySkills/mySkills?type=skill' },
      { id: 'myNeeds', title: '我的需求', emoji: '🔍', url: '/pages/mySkills/mySkills?type=need' },
      { id: 'myAppointments', title: '我的预约', emoji: '📅', url: '/pages/appointment/appointment' },
      { id: 'myEvaluations', title: '我的评价', emoji: '⭐', url: '/pages/evaluate/evaluate?type=received' }
    ]
  },

  onLoad: function (options) {
    // 判断是否可以使用 getUserProfile
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    }
  },

  onShow: function () {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus: function () {
    const that = this;
    
    // 从全局状态检查登录状态
    if (app.globalData.isLogin && app.globalData.userInfo) {
      that.setData({
        userInfo: app.globalData.userInfo,
        isLogin: true,
        hasUserInfo: true
      });
      that.loadUserStats();
      return;
    }

    // 从本地存储检查
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid');

    if (userInfo && openid) {
      app.globalData.isLogin = true;
      app.globalData.userInfo = userInfo;
      app.globalData.openid = openid;
      that.setData({
        userInfo: userInfo,
        isLogin: true,
        hasUserInfo: true
      });
      that.loadUserStats();
    } else {
      // 未登录状态，不自动登录
      that.setData({
        userInfo: null,
        isLogin: false,
        hasUserInfo: false,
        stats: {
          publishedSkills: 0,
          publishedNeeds: 0,
          completedExchanges: 0,
          creditScore: 100
        }
      });
    }
  },

  // 跳转到登录页面
  goLogin: function () {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  // 获取用户信息（使用getUserProfile）
  getUserProfile: function () {
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
          
          that.setData({
            userInfo: fullUserInfo,
            isLogin: true,
            hasUserInfo: true
          });
          
          that.loadUserStats();
          util.showSuccess('登录成功');
          return;
        }
        
        // 云开发模式
        wx.setStorageSync('userInfo', userInfo);
        app.globalData.userInfo = userInfo;
        app.globalData.isLogin = true;

        that.setData({
          userInfo: userInfo,
          isLogin: true,
          hasUserInfo: true
        });

        // 更新云端用户信息
        that.updateUserInfo(userInfo);
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
        util.showToast('授权失败，请重试');
      }
    });
  },

  // 更新云端用户信息
  updateUserInfo: function (userInfo) {
    const that = this;
    const openid = wx.getStorageSync('openid');

    if (!openid) {
      // 先登录获取openid
      wx.cloud.callFunction({
        name: 'login',
        data: {},
        success: res => {
          if (res.result.code === 0) {
            wx.setStorageSync('openid', res.result.openid);
            app.globalData.openid = res.result.openid;
            that.doUpdateUserInfo(userInfo);
          }
        }
      });
    } else {
      that.doUpdateUserInfo(userInfo);
    }
  },

  // 执行更新用户信息
  doUpdateUserInfo: function (userInfo) {
    const that = this;

    const db = wx.cloud.database();

    db.collection('users').where({
      _openid: wx.getStorageSync('openid')
    }).update({
      data: {
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        gender: userInfo.gender,
        updateTime: db.serverDate()
      },
      success: res => {
        console.log('更新用户信息成功', res);
        that.loadUserStats();
      },
      fail: err => {
        console.error('更新用户信息失败', err);
      }
    });
  },

  // 加载用户统计数据
  loadUserStats: function () {
    const that = this;
    const openid = wx.getStorageSync('openid');

    if (!openid) return;

    // 开发模式使用模拟数据
    if (app.globalData.devMode) {
      const mockSkills = app.globalData.mockData.skills;
      const mockUser = app.globalData.mockData.users.find(u => u._openid === openid);
      
      const publishedSkills = mockSkills.filter(s => s._openid === openid && s.type === 'skill').length;
      const publishedNeeds = mockSkills.filter(s => s._openid === openid && s.type === 'need').length;

      that.setData({
        'stats.publishedSkills': publishedSkills,
        'stats.publishedNeeds': publishedNeeds,
        'stats.creditScore': mockUser ? mockUser.creditScore : 100,
        'stats.completedExchanges': mockUser ? mockUser.totalExchanges : 0
      });

      if (mockUser) {
        const userInfo = wx.getStorageSync('userInfo') || {};
        const updatedUserInfo = { ...userInfo, ...mockUser };
        wx.setStorageSync('userInfo', updatedUserInfo);
        that.setData({ userInfo: updatedUserInfo });
      }
      return;
    }

    const db = wx.cloud.database();

    // 获取发布的技能数量
    db.collection('skills').where({
      _openid: openid,
      type: 'skill'
    }).count().then(res => {
      that.setData({
        'stats.publishedSkills': res.total
      });
    });

    // 获取发布的需求数量
    db.collection('skills').where({
      _openid: openid,
      type: 'need'
    }).count().then(res => {
      that.setData({
        'stats.publishedNeeds': res.total
      });
    });

    // 获取用户详细信息（包含信誉分和交换次数）
    db.collection('users').where({
      _openid: openid
    }).get().then(res => {
      if (res.data.length > 0) {
        const userData = res.data[0];
        that.setData({
          'stats.creditScore': userData.creditScore || 100,
          'stats.completedExchanges': userData.totalExchanges || 0
        });
        
        // 更新本地存储的用户信息
        const userInfo = wx.getStorageSync('userInfo') || {};
        const updatedUserInfo = {
          ...userInfo,
          ...userData
        };
        wx.setStorageSync('userInfo', updatedUserInfo);
        that.setData({
          userInfo: updatedUserInfo
        });
      }
    });
  },

  // 跳转到编辑个人资料页面
  goEditProfile: function () {
    if (!this.data.isLogin || !this.data.hasUserInfo) {
      util.showToast('请先登录');
      return;
    }
    // 可以在这里跳转到编辑资料页面
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  // 菜单点击
  onMenuTap: function (e) {
    const item = e.currentTarget.dataset.item;
    if (!this.data.isLogin || !this.data.hasUserInfo) {
      util.showToast('请先登录');
      return;
    }
    
    // TabBar页面使用switchTab
    const tabBarPages = [
      '/pages/index/index',
      '/pages/publish/publish',
      '/pages/match/match',
      '/pages/appointment/appointment',
      '/pages/profile/profile'
    ];
    
    if (tabBarPages.includes(item.url)) {
      wx.switchTab({ url: item.url });
    } else {
      wx.navigateTo({ url: item.url });
    }
  },

  // 退出登录
  logout: function () {
    const that = this;
    util.showConfirm('确定要退出登录吗？').then(confirm => {
      if (confirm) {
        // 清除本地存储
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('openid');
        
        // 清除全局数据
        app.globalData.userInfo = null;
        app.globalData.openid = null;
        app.globalData.isLogin = false;

        // 重置页面数据
        that.setData({
          userInfo: null,
          isLogin: false,
          hasUserInfo: false,
          stats: {
            publishedSkills: 0,
            publishedNeeds: 0,
            completedExchanges: 0,
            creditScore: 100
          }
        });

        util.showSuccess('已退出登录');
      }
    });
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.checkLoginStatus();
    wx.stopPullDownRefresh();
  }
});
