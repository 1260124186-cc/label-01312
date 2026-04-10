// app.js
App({
  onLaunch: function () {
    // 开发模式：设置为 true 使用模拟数据，false 使用云开发
    this.globalData.devMode = true;

    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: 'your-env-id', // 请替换为你的云开发环境ID
        traceUser: true,
      });
    }

    // 初始化模拟数据
    if (this.globalData.devMode) {
      this.initMockData();
    }

    // 检查本地存储的登录状态（开发模式和云开发模式都检查）
    this.checkLogin();
  },

  globalData: {
    userInfo: null,
    openid: null,
    isLogin: false,
    // 技能分类
    skillCategories: [
      { id: 1, name: '编程开发', icon: 'code' },
      { id: 2, name: '设计美工', icon: 'design' },
      { id: 3, name: '语言学习', icon: 'language' },
      { id: 4, name: '音乐艺术', icon: 'music' },
      { id: 5, name: '运动健身', icon: 'sport' },
      { id: 6, name: '学业辅导', icon: 'study' },
      { id: 7, name: '生活技能', icon: 'life' },
      { id: 8, name: '其他', icon: 'other' }
    ],
    // 校区列表
    campusList: [
      { id: 1, name: '东校区' },
      { id: 2, name: '西校区' },
      { id: 3, name: '南校区' },
      { id: 4, name: '北校区' }
    ]
  },

  // 检查登录状态
  checkLogin: function() {
    const that = this;
    // 尝试从本地存储获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid');

    if (userInfo && openid) {
      that.globalData.userInfo = userInfo;
      that.globalData.openid = openid;
      that.globalData.isLogin = true;
      that.updateTabBarBadge();
    }
  },

  // 清除登录状态（开发模式下使用）
  clearLoginState: function() {
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('openid');
    this.globalData.userInfo = null;
    this.globalData.openid = null;
    this.globalData.isLogin = false;
    this.updateTabBarBadge();
  },

  // 调用云函数登录
  cloudLogin: function(callback) {
    const that = this;

    // 开发模式使用模拟登录
    if (that.globalData.devMode) {
      const mockResult = {
        openid: 'mock_openid_001',
        userInfo: that.globalData.mockData.users[0]
      };
      that.globalData.openid = mockResult.openid;
      wx.setStorageSync('openid', mockResult.openid);
      if (callback) callback(mockResult);
      return;
    }

    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        console.log('云函数登录成功', res);
        that.globalData.openid = res.result.openid;
        wx.setStorageSync('openid', res.result.openid);
        if (callback) callback(res.result);
      },
      fail: err => {
        console.error('云函数登录失败', err);
      }
    });
  },

  // 初始化模拟数据
  initMockData: function() {
    const now = new Date();

    this.globalData.mockData = {
      // 模拟用户数据
      users: [
        {
          _id: 'user_001',
          _openid: 'mock_openid_001',
          nickName: '张三',
          avatarUrl: '',
          campus: '东校区',
          major: '计算机科学',
          grade: '大三',
          creditScore: 95,
          totalExchanges: 12
        },
        {
          _id: 'user_002',
          _openid: 'mock_openid_002',
          nickName: '李四',
          avatarUrl: '',
          campus: '西校区',
          major: '英语',
          grade: '大二',
          creditScore: 88,
          totalExchanges: 8
        },
        {
          _id: 'user_003',
          _openid: 'mock_openid_003',
          nickName: '王五',
          avatarUrl: '',
          campus: '东校区',
          major: '设计',
          grade: '大四',
          creditScore: 92,
          totalExchanges: 15
        }
      ],

      // 模拟技能数据
      skills: [
        {
          _id: 'skill_001',
          _openid: 'mock_openid_002',
          type: 'skill',
          title: '教英语口语，纠正发音',
          description: '英语专业大二学生，通过专八考试，可以帮助提升口语能力，纠正发音问题。一对一辅导，针对性强。',
          category: 3,
          categoryName: '语言学习',
          duration: 1,
          campus: '西校区',
          availableTime: ['afternoon', 'evening'],
          status: 'active',
          publisherInfo: {
            nickName: '李四',
            avatarUrl: '',
            creditScore: 88
          },
          viewCount: 56,
          createTime: new Date(now - 2 * 24 * 60 * 60 * 1000)
        },
        {
          _id: 'skill_002',
          _openid: 'mock_openid_003',
          type: 'skill',
          title: 'PS修图教学，从入门到精通',
          description: '设计专业学生，熟练使用Photoshop，可以教授基础修图、人像美化、海报设计等。有丰富的教学经验。',
          category: 2,
          categoryName: '设计美工',
          duration: 2,
          campus: '东校区',
          availableTime: ['morning', 'weekend'],
          status: 'active',
          publisherInfo: {
            nickName: '王五',
            avatarUrl: '',
            creditScore: 92
          },
          viewCount: 89,
          createTime: new Date(now - 1 * 24 * 60 * 60 * 1000)
        },
        {
          _id: 'skill_003',
          _openid: 'mock_openid_001',
          type: 'skill',
          title: 'Python编程入门教学',
          description: '计算机专业学生，可以教授Python基础语法、数据分析、爬虫入门等。有耐心，善于讲解。',
          category: 1,
          categoryName: '编程开发',
          duration: 2,
          campus: '东校区',
          availableTime: ['evening', 'weekend'],
          status: 'active',
          publisherInfo: {
            nickName: '张三',
            avatarUrl: '',
            creditScore: 95
          },
          viewCount: 123,
          createTime: new Date(now - 3 * 24 * 60 * 60 * 1000)
        },
        {
          _id: 'skill_004',
          _openid: 'mock_openid_002',
          type: 'need',
          title: '求教Python爬虫技术',
          description: '想学习Python爬虫，用于收集学习资料。希望能有基础的爬虫知识教学，包括requests、BeautifulSoup等。',
          category: 1,
          categoryName: '编程开发',
          duration: 2,
          campus: '西校区',
          availableTime: ['evening', 'weekend'],
          status: 'active',
          publisherInfo: {
            nickName: '李四',
            avatarUrl: '',
            creditScore: 88
          },
          viewCount: 34,
          createTime: new Date(now - 4 * 24 * 60 * 60 * 1000)
        },
        {
          _id: 'skill_005',
          _openid: 'mock_openid_003',
          type: 'need',
          title: '想学吉他弹唱',
          description: '零基础想学吉他，希望能学会几首简单的弹唱歌曲。自己有吉他，希望找个有耐心的老师。',
          category: 4,
          categoryName: '音乐艺术',
          duration: 1,
          campus: '东校区',
          availableTime: ['afternoon', 'weekend'],
          status: 'active',
          publisherInfo: {
            nickName: '王五',
            avatarUrl: '',
            creditScore: 92
          },
          viewCount: 28,
          createTime: new Date(now - 5 * 24 * 60 * 60 * 1000)
        },
        {
          _id: 'skill_006',
          _openid: 'mock_openid_001',
          type: 'skill',
          title: '高数辅导，期末不挂科',
          description: '高数成绩优秀，可以辅导高等数学、线性代数、概率论。讲解思路清晰，帮助理解概念。',
          category: 6,
          categoryName: '学业辅导',
          duration: 2,
          campus: '东校区',
          availableTime: ['morning', 'afternoon'],
          status: 'active',
          publisherInfo: {
            nickName: '张三',
            avatarUrl: '',
            creditScore: 95
          },
          viewCount: 156,
          createTime: new Date(now - 6 * 24 * 60 * 60 * 1000)
        }
      ],

      // 模拟预约数据
      appointments: [
        {
          _id: 'appt_001',
          skillId: 'skill_002',
          providerId: 'mock_openid_003',
          receiverId: 'mock_openid_001',
          providerInfo: { nickName: '王五', avatarUrl: '' },
          receiverInfo: { nickName: '张三', avatarUrl: '' },
          skillTitle: 'PS修图教学，从入门到精通',
          skillType: 'skill',
          appointmentTime: '2026-02-05 14:00',
          duration: 2,
          location: '图书馆自习室A203',
          status: 'confirmed',
          message: '想学习海报设计',
          createTime: new Date(now - 1 * 24 * 60 * 60 * 1000)
        },
        {
          _id: 'appt_002',
          skillId: 'skill_001',
          providerId: 'mock_openid_002',
          receiverId: 'mock_openid_001',
          providerInfo: { nickName: '李四', avatarUrl: '' },
          receiverInfo: { nickName: '张三', avatarUrl: '' },
          skillTitle: '教英语口语，纠正发音',
          skillType: 'skill',
          appointmentTime: '2026-02-03 15:00',
          duration: 1,
          location: '咖啡厅',
          status: 'completed',
          message: '希望提升口语',
          createTime: new Date(now - 5 * 24 * 60 * 60 * 1000)
        }
      ],

      // 模拟评价数据
      evaluations: [
        {
          _id: 'eval_001',
          appointmentId: 'appt_002',
          evaluatorId: 'mock_openid_001',
          evaluateeId: 'mock_openid_002',
          evaluatorInfo: { nickName: '张三', avatarUrl: '' },
          rating: 5,
          comment: '李四同学教得很好，发音纠正非常专业，收获很大！',
          tags: ['耐心教学', '专业能力强', '态度友好'],
          createTime: new Date(now - 4 * 24 * 60 * 60 * 1000)
        }
      ],

      notifications: [
        {
          _id: 'notif_001',
          userId: 'mock_openid_001',
          type: 'appointment',
          title: '预约已被接受',
          content: '您的PS修图教学预约已被王五接受，请准时参加！',
          icon: '✅',
          isRead: false,
          relatedId: 'appt_001',
          relatedPage: '/pages/appointment/appointment',
          createTime: new Date(now - 1 * 24 * 60 * 60 * 1000),
          createTimeStr: '2026-02-04 10:30'
        },
        {
          _id: 'notif_002',
          userId: 'mock_openid_001',
          type: 'evaluation',
          title: '收到新评价',
          content: '李四对您的英语口语教学给出了5星好评！',
          icon: '⭐',
          isRead: false,
          relatedId: 'eval_001',
          relatedPage: '/pages/profile/profile',
          createTime: new Date(now - 2 * 24 * 60 * 60 * 1000),
          createTimeStr: '2026-02-03 15:20'
        },
        {
          _id: 'notif_003',
          userId: 'mock_openid_001',
          type: 'system',
          title: '新预约提醒',
          content: '您收到了一个新的技能交换预约请求！',
          icon: '📅',
          isRead: true,
          relatedId: 'appt_001',
          relatedPage: '/pages/appointment/appointment',
          createTime: new Date(now - 3 * 24 * 60 * 60 * 1000),
          createTimeStr: '2026-02-02 09:15'
        }
      ]
    };

    // 设置模拟的openid
    wx.setStorageSync('openid', 'mock_openid_001');
    this.globalData.openid = 'mock_openid_001';

    this.initNotifications();
  },

  initNotifications: function() {
    const notifications = wx.getStorageSync('notifications');
    if (!notifications || notifications.length === 0) {
      wx.setStorageSync('notifications', this.globalData.mockData.notifications);
    }
  },

  getMessages: function() {
    if (!this.globalData.isLogin) {
      return [];
    }
    const openid = this.globalData.openid;
    const notifications = wx.getStorageSync('notifications') || [];
    return notifications.filter(n => n.userId === openid).sort((a, b) =>
      new Date(b.createTime) - new Date(a.createTime)
    );
  },

  getUnreadMessageCount: function() {
    if (!this.globalData.isLogin) {
      return 0;
    }
    const openid = this.globalData.openid;
    const notifications = wx.getStorageSync('notifications') || [];
    return notifications.filter(n => n.userId === openid && !n.isRead).length;
  },

  markMessageAsRead: function(messageId) {
    const notifications = wx.getStorageSync('notifications') || [];
    const index = notifications.findIndex(n => n._id === messageId);
    if (index !== -1) {
      notifications[index].isRead = true;
      wx.setStorageSync('notifications', notifications);
    }
    this.updateTabBarBadge();
  },

  markAllMessagesAsRead: function() {
    const openid = this.globalData.openid;
    const notifications = wx.getStorageSync('notifications') || [];
    notifications.forEach(n => {
      if (n.userId === openid) {
        n.isRead = true;
      }
    });
    wx.setStorageSync('notifications', notifications);
    this.updateTabBarBadge();
  },

  deleteMessage: function(messageId) {
    let notifications = wx.getStorageSync('notifications') || [];
    notifications = notifications.filter(n => n._id !== messageId);
    wx.setStorageSync('notifications', notifications);
    this.updateTabBarBadge();
  },

  addNotification: function(notification) {
    if (!this.globalData.isLogin) {
      return;
    }
    const notifications = wx.getStorageSync('notifications') || [];
    const now = new Date();
    const newNotification = {
      _id: 'notif_' + Date.now(),
      userId: notification.userId,
      type: notification.type || 'system',
      title: notification.title,
      content: notification.content,
      icon: notification.icon || '📬',
      isRead: false,
      relatedId: notification.relatedId || '',
      relatedPage: notification.relatedPage || '',
      createTime: now,
      createTimeStr: now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\//g, '-')
    };
    notifications.unshift(newNotification);
    wx.setStorageSync('notifications', notifications);

    this.updateTabBarBadge();

    if (this.globalData.enablePush) {
      wx.showToast({
        title: notification.title,
        icon: 'none',
        duration: 3000
      });
    }
  },

  updateTabBarBadge: function() {
    const unreadCount = this.getUnreadMessageCount();
    try {
      if (unreadCount > 0) {
        wx.setTabBarBadge({
          index: 3,
          text: unreadCount > 99 ? '99+' : unreadCount.toString(),
          fail: (err) => {
            console.log('setTabBarBadge delayed, will retry');
          }
        });
      } else {
        wx.removeTabBarBadge({
          index: 3,
          fail: (err) => {
            console.log('removeTabBarBadge delayed');
          }
        });
      }
    } catch (e) {
      console.log('tabbar api not ready yet');
    }
  },

  clearNotificationBadge: function() {
    if (!this.globalData.isLogin) {
      return;
    }
    this.getMessages().forEach(m => {
      if (!m.isRead) {
        this.markMessageAsRead(m._id);
      }
    });
  },

  sendAppointmentNotification: function(appointment, status) {
    const statusMap = {
      'confirmed': {
        title: '预约已被接受',
        content: `您的「${appointment.skillTitle}」预约已被接受！`,
        icon: '✅'
      },
      'cancelled': {
        title: '预约已取消',
        content: `「${appointment.skillTitle}」的预约已取消`,
        icon: '❌'
      },
      'pending': {
        title: '收到新预约',
        content: `您收到了「${appointment.skillTitle}」的新预约请求！`,
        icon: '📅'
      },
      'rejected': {
        title: '预约已被拒绝',
        content: `很遗憾，您的「${appointment.skillTitle}」预约已被拒绝`,
        icon: '🚫'
      }
    };

    const config = statusMap[status];
    if (!config) return;

    let userId = appointment.receiverId;
    if (status === 'pending') {
      userId = appointment.providerId;
    } else if (status === 'cancelled') {
      const currentUser = this.globalData.openid;
      userId = currentUser === appointment.providerId ?
        appointment.receiverId : appointment.providerId;
    }

    this.addNotification({
      userId: userId,
      type: 'appointment',
      title: config.title,
      content: config.content,
      icon: config.icon,
      relatedId: appointment._id,
      relatedPage: '/pages/appointment/appointment'
    });
  },

  sendEvaluationNotification: function(evaluation) {
    this.addNotification({
      userId: evaluation.evaluateeId,
      type: 'evaluation',
      title: '收到新评价',
      content: `您收到了${evaluation.rating}星好评！`,
      icon: '⭐',
      relatedId: evaluation._id,
      relatedPage: '/pages/profile/profile'
    });
  }
});
