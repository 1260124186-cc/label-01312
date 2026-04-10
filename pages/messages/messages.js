// pages/messages/messages.js
const app = getApp();

Page({
  data: {
    messages: [],
    page: 1,
    pageSize: 20,
    total: 0,
    isLoading: false,
    hasMore: true,
    unreadCount: 0,
    isLogin: false
  },

  onLoad: function (options) {
    this.checkLoginStatus();
    this.loadMessages(true);
    this.getUnreadCount();
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 4
      });
    }
    // 每次显示页面时检查登录状态并刷新
    this.checkLoginStatus();
    this.loadMessages(true);
    this.getUnreadCount();
  },

  // 检查登录状态
  checkLoginStatus: function () {
    const that = this;
    const isLogin = app.globalData.isLogin || !!wx.getStorageSync('userInfo');
    that.setData({ isLogin });
  },

  onPullDownRefresh: function () {
    this.loadMessages(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMessages(false);
    }
  },

  loadMessages: function (refresh = false) {
    const that = this;

    // 未登录时清空消息
    if (!app.globalData.isLogin && !wx.getStorageSync('userInfo')) {
      that.setData({
        messages: [],
        page: 1,
        total: 0,
        hasMore: false,
        isLoading: false,
        unreadCount: 0
      });
      return;
    }

    const page = refresh ? 1 : that.data.page;

    if (that.data.isLoading) return;

    that.setData({ isLoading: true });

    if (app.globalData.devMode) {
      // 确保有用户
      if (!app.globalData.openid) {
        that.setData({ isLoading: false, messages: [] });
        return;
      }
      setTimeout(() => {
        const allMessages = app.globalData.mockData.messages || [];
        // 只过滤当前用户的消息
        const userMessages = allMessages.filter(m => m.userId === app.globalData.openid);
        const start = (page - 1) * that.data.pageSize;
        const end = start + that.data.pageSize;
        const pageMessages = userMessages.slice(start, end);

        that.setData({
          messages: refresh ? pageMessages : [...that.data.messages, ...pageMessages],
          page: refresh ? 2 : page + 1,
          total: userMessages.length,
          hasMore: end < userMessages.length,
          isLoading: false
        });
      }, 300);
      return;
    }

    wx.cloud.callFunction({
      name: 'sendMessage',
      data: {
        action: 'getList',
        data: { page, pageSize: that.data.pageSize }
      },
      success: res => {
        if (res.result.code === 0) {
          const { list, total } = res.result.data;
          that.setData({
            messages: refresh ? list : [...that.data.messages, ...list],
            page: refresh ? 2 : page + 1,
            total,
            hasMore: (page - 1) * that.data.pageSize + list.length < total,
            isLoading: false
          });
        }
      },
      fail: err => {
        console.error('加载消息失败', err);
        that.setData({ isLoading: false });
      }
    });
  },

  getUnreadCount: function () {
    const that = this;

    // 未登录时未读数为0
    if (!app.globalData.isLogin && !wx.getStorageSync('userInfo')) {
      that.setData({ unreadCount: 0 });
      return;
    }

    if (app.globalData.devMode) {
      if (!app.globalData.openid) {
        that.setData({ unreadCount: 0 });
        return;
      }
      const mockMessages = app.globalData.mockData.messages || [];
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
  },

  markAsRead: function (e) {
    const that = this;
    const { messageId, index } = e.currentTarget.dataset;
    const message = that.data.messages[index];

    if (!message || message.isRead) return;

    if (app.globalData.devMode) {
      message.isRead = true;
      that.setData({ messages: [...that.data.messages] });
      that.getUnreadCount();
      return;
    }

    wx.cloud.callFunction({
      name: 'sendMessage',
      data: {
        action: 'markAsRead',
        data: { messageId }
      },
      success: res => {
        if (res.result.code === 0) {
          message.isRead = true;
          that.setData({ messages: [...that.data.messages] });
          that.getUnreadCount();
        }
      }
    });
  },

  markAllAsRead: function () {
    const that = this;

    if (app.globalData.devMode) {
      app.globalData.mockData.messages.forEach(m => {
        m.isRead = true;
      });
      that.loadMessages(true);
      that.getUnreadCount();
      wx.showToast({ title: '全部标记已读' });
      return;
    }

    wx.cloud.callFunction({
      name: 'sendMessage',
      data: { action: 'markAllAsRead' },
      success: res => {
        if (res.result.code === 0) {
          that.loadMessages(true);
          that.getUnreadCount();
          wx.showToast({ title: '全部标记已读' });
        }
      }
    });
  },

  getMessageIcon: function (type) {
    const icons = {
      new_appointment: '📬',
      status_changed: '🔔',
      new_evaluation: '⭐',
      system: '📢'
    };
    return icons[type] || '📩';
  },

  formatTime: function (dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
});
