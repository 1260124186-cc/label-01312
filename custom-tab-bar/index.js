const app = getApp();

Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#4A90D9",
    unreadCount: 0,
    list: [
      {
        pagePath: "/pages/index/index",
        text: "首页",
        icon: "🏠"
      },
      {
        pagePath: "/pages/publish/publish",
        text: "发布",
        icon: "✏️"
      },
      {
        pagePath: "/pages/match/match",
        text: "匹配",
        icon: "🔗"
      },
      {
        pagePath: "/pages/appointment/appointment",
        text: "预约",
        icon: "📅"
      },
      {
        pagePath: "/pages/messages/messages",
        text: "消息",
        icon: "🔔"
      },
      {
        pagePath: "/pages/profile/profile",
        text: "我的",
        icon: "👤"
      }
    ]
  },

  lifetimes: {
    attached() {
      this.updateUnreadCount();
    }
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    },

    // 提供外部调用的刷新方法
    refreshUnread() {
      this.updateUnreadCount();
    },

    updateUnreadCount() {
      const that = this;

      // 未登录时，消息数为0
      if (!app.globalData.isLogin && !wx.getStorageSync('userInfo')) {
        that.setData({ unreadCount: 0 });
        return;
      }

      if (app.globalData.devMode) {
        // 开发模式也需要确保有登录用户
        if (!app.globalData.openid) {
          that.setData({ unreadCount: 0 });
          return;
        }
        const mockMessages = app.globalData.mockData.messages || [];
        // 只过滤当前用户的消息
        const userMessages = mockMessages.filter(m => m.userId === app.globalData.openid);
        const unreadCount = userMessages.filter(m => !m.isRead).length;
        that.setData({ unreadCount });
        return;
      }

      wx.cloud.callFunction({
        name: 'sendMessage',
        data: { action: 'getUnreadCount' },
        success: res => {
          if (res.result.code === 0) {
            that.setData({ unreadCount: res.result.data.unreadCount });
          }
        }
      });
    }
  }
});
