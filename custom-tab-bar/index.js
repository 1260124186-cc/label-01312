Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#4A90D9",
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
        pagePath: "/pages/profile/profile",
        text: "我的",
        icon: "👤"
      }
    ]
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    }
  }
});
