const app = getApp();

Page({
  data: {
    messages: [],
    unreadCount: 0,
    isLogin: false
  },

  onLoad: function (options) {
    this.loadMessages();
  },

  onShow: function () {
    this.loadMessages();
    if (app.globalData.isLogin) {
      app.clearNotificationBadge();
    }
  },

  loadMessages: function () {
    const isLogin = app.globalData.isLogin;
    const messages = isLogin ? app.getMessages() : [];
    const unreadCount = isLogin ? app.getUnreadMessageCount() : 0;

    this.setData({
      messages: messages,
      unreadCount: unreadCount,
      isLogin: isLogin
    });
  },

  markAsRead: function (e) {
    const messageId = e.currentTarget.dataset.id;
    app.markMessageAsRead(messageId);
    this.loadMessages();
  },

  markAllAsRead: function () {
    app.markAllMessagesAsRead();
    this.loadMessages();
  },

  onMessageTap: function (e) {
    const messageId = e.currentTarget.dataset.id;
    const message = this.data.messages.find(m => m._id === messageId);

    if (message && !message.isRead) {
      app.markMessageAsRead(messageId);
      this.loadMessages();
    }

    if (message && message.relatedPage) {
      wx.navigateTo({
        url: message.relatedPage
      });
    }
  },

  deleteMessage: function (e) {
    const that = this;
    const messageId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条消息吗？',
      success: function (res) {
        if (res.confirm) {
          app.deleteMessage(messageId);
          that.loadMessages();
        }
      }
    });
  }
});
