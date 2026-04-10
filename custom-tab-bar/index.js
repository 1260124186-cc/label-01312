Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#4A90D9",
    unreadCount: 0,
    list: [
      {
        pagePath: "pages/index/index",
        text: "首页",
        icon: "🏠"
      },
      {
        pagePath: "pages/publish/publish",
        text: "发布",
        icon: "✏️"
      },
      {
        pagePath: "pages/match/match",
        text: "匹配",
        icon: "🔗"
      },
      {
        pagePath: "pages/message/message",
        text: "消息",
        icon: "📨"
      },
      {
        pagePath: "pages/profile/profile",
        text: "我的",
        icon: "👤"
      }
    ]
  },

  attached() {
    // 组件加载时获取未读消息数
    this.getUnreadCount();
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      const index = data.index;

      // 更新选中状态
      this.setData({ selected: index });

      // 跳转页面
      wx.switchTab({
        url: '/' + url
      });
    },

    // 获取未读消息数量
    getUnreadCount() {
      const app = getApp();

      // 如果没有app对象，直接返回
      if (!app) {
        this.setData({ unreadCount: 0 });
        return;
      }

      // 开发模式
      if (app.globalData && app.globalData.devMode) {
        // 从全局获取未读数
        const unreadCount = app.globalData.unreadCount || 0;
        this.setData({ unreadCount });
        return;
      }

      // 云开发模式 - 不在这里调用云函数，避免超时
      // 让各个页面在onShow时主动调用并更新tabBar
      const openid = wx.getStorageSync('openid');
      if (!openid) {
        this.setData({ unreadCount: 0 });
        return;
      }
    },

    // 更新未读数量（供外部调用）
    updateUnreadCount(count) {
      this.setData({ unreadCount: count });
    }
  }
});
