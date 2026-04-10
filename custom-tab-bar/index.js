const app = getApp();

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
        pagePath: "pages/messages/messages",
        text: "消息",
        icon: "🔔"
      },
      {
        pagePath: "pages/profile/profile",
        text: "我的",
        icon: "👤"
      }
    ]
  },

  attached: function() {
    const currentRoute = getCurrentPages()[0]?.route;
    if (currentRoute) {
      const idx = this.data.list.findIndex(item => item.pagePath === currentRoute);
      if (idx > -1) {
        this.setData({ selected: idx });
      }
    }
    this.updateUnreadCount();
    const that = this;
    this.interval = setInterval(() => {
      that.updateUnreadCount();
    }, 1000);
  },

  detached: function() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      const index = parseInt(data.index);
      this.setData({
        selected: index
      });
      wx.switchTab({
        url: '/' + url,
        fail: (err) => {
          console.error('switchTab fail', err);
        }
      });
    },

    updateUnreadCount: function() {
      const unreadCount = app.getUnreadMessageCount();
      if (unreadCount !== this.data.unreadCount) {
        this.setData({
          unreadCount: unreadCount
        });
      }
    }
  }
});
