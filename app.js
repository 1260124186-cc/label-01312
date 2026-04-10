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
    }
  },

  // 清除登录状态（开发模式下使用）
  clearLoginState: function() {
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('openid');
    this.globalData.userInfo = null;
    this.globalData.openid = null;
    this.globalData.isLogin = false;
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
      ]
    };

    // 设置模拟的openid
    wx.setStorageSync('openid', 'mock_openid_001');
    this.globalData.openid = 'mock_openid_001';
  }
});
