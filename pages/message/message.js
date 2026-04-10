// pages/message/message.js
const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    // 登录状态
    isLogin: false,
    // 当前标签
    currentTab: 'all',
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'unread', name: '未读' },
      { key: 'appointment', name: '预约' },
      { key: 'evaluation', name: '评价' }
    ],
    // 消息列表
    messageList: [],
    // 状态
    loading: false,
    page: 1,
    pageSize: 15,
    hasMore: true,
    // 未读数量
    unreadCount: 0,
    // 是否显示全部已读按钮
    showMarkAllRead: false
  },

  onLoad: function (options) {
    // 如果有传入的筛选类型
    if (options.type) {
      this.setData({
        currentTab: options.type
      });
    }
    // 请求订阅消息授权
    this.requestSubscribeMessage();
  },

  // 请求订阅消息授权
  requestSubscribeMessage: function () {
    // 开发模式跳过
    if (app.globalData.devMode) return;

    // 订阅消息模板ID列表
    const tmplIds = [
      'appointment_new_template_id',
      'appointment_accepted_template_id',
      'appointment_rejected_template_id',
      'appointment_cancelled_template_id',
      'appointment_completed_template_id',
      'evaluation_new_template_id'
    ];

    wx.requestSubscribeMessage({
      tmplIds: tmplIds,
      success: (res) => {
        console.log('订阅消息授权结果', res);
        // 保存订阅记录
        tmplIds.forEach(tmplId => {
          if (res[tmplId] === 'accept') {
            this.saveSubscribeRecord(tmplId);
          }
        });
      },
      fail: (err) => {
        console.error('订阅消息授权失败', err);
      }
    });
  },

  // 保存订阅记录
  saveSubscribeRecord: function (templateId) {
    wx.cloud.callFunction({
      name: 'subscribeMessage',
      data: {
        action: 'saveSubscribe',
        data: {
          templateId: templateId
        }
      }
    });
  },

  onShow: function () {
    // 检查登录状态
    const isLogin = app.globalData.isLogin;
    this.setData({ isLogin: isLogin });

    if (!isLogin) {
      this.setData({ messageList: [], unreadCount: 0 });
      return;
    }

    this.loadMessages(true);
    this.getUnreadCount();
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadMessages(true).then(() => {
      this.getUnreadCount();
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMessages(false);
    }
  },

  // 跳转登录
  goLogin: function () {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  // 切换标签
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.currentTab) {
      this.setData({
        currentTab: tab,
        messageList: [],
        page: 1,
        hasMore: true
      });
      this.loadMessages(true);
    }
  },

  // 加载消息列表
  loadMessages: function (refresh = false) {
    const that = this;
    if (this.data.loading) return Promise.resolve();

    this.setData({ loading: true });

    const page = refresh ? 1 : this.data.page;
    const currentTab = this.data.currentTab;

    // 开发模式使用模拟数据
    if (app.globalData.devMode) {
      return this.loadMockMessages(refresh, page, currentTab);
    }

    // 构建查询参数
    let queryData = {
      page: page,
      pageSize: this.data.pageSize
    };

    // 根据标签筛选
    if (currentTab === 'unread') {
      // 未读消息在云函数端处理
    } else if (currentTab === 'appointment') {
      queryData.type = 'appointment_new';
    } else if (currentTab === 'evaluation') {
      queryData.type = 'evaluation_new';
    }

    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'manageNotification',
        data: {
          action: 'getList',
          data: queryData
        },
        success: res => {
          if (res.result.code === 0) {
            let list = res.result.data.list;

            // 如果是未读标签，过滤未读消息
            if (currentTab === 'unread') {
              list = list.filter(item => !item.isRead);
            }

            list = list.map(item => ({
              ...item,
              typeText: this.getTypeText(item.type),
              typeIcon: this.getTypeIcon(item.type),
              timeStr: util.relativeTime(new Date(item.createTime).getTime()),
              showDelete: false
            }));

            this.setData({
              messageList: refresh ? list : [...this.data.messageList, ...list],
              page: page + 1,
              hasMore: list.length === this.data.pageSize,
              loading: false,
              unreadCount: res.result.data.unreadCount,
              showMarkAllRead: res.result.data.unreadCount > 0
            });

            // 更新全局未读数
            app.updateUnreadCount(res.result.data.unreadCount);
          } else {
            util.showToast(res.result.message || '加载失败');
            this.setData({ loading: false });
          }
          resolve();
        },
        fail: err => {
          console.error('加载消息失败', err);
          util.showError('加载失败');
          this.setData({ loading: false });
          reject(err);
        }
      });
    });
  },

  // 加载模拟数据
  loadMockMessages: function (refresh, page, currentTab) {
    const that = this;
    return new Promise((resolve) => {
      setTimeout(() => {
        const openid = wx.getStorageSync('openid');

        // 从全局模拟数据获取消息列表（确保数据持久化）
        let mockMessages = app.globalData.mockData.notifications || [];

        // 如果是首次加载且没有数据，初始化默认数据
        if (mockMessages.length === 0) {
          mockMessages = [
            {
              _id: 'msg_001',
              userId: openid,
              type: 'appointment_new',
              title: '收到新预约',
              content: '李四预约了您的技能「Python编程入门教学」',
              relatedId: 'appt_003',
              relatedType: 'appointment',
              isRead: false,
              createTime: new Date(Date.now() - 30 * 60 * 1000),
              extraData: {
                skillTitle: 'Python编程入门教学',
                appointmentTime: '2026-04-15 14:00',
                partnerName: '李四'
              }
            },
            {
              _id: 'msg_002',
              userId: openid,
              type: 'appointment_accepted',
              title: '预约已接受',
              content: '您的预约「PS修图教学，从入门到精通」已被接受',
              relatedId: 'appt_001',
              relatedType: 'appointment',
              isRead: true,
              createTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
              extraData: {
                skillTitle: 'PS修图教学，从入门到精通',
                appointmentTime: '2026-02-05 14:00',
                partnerName: '王五'
              }
            },
            {
              _id: 'msg_003',
              userId: openid,
              type: 'evaluation_new',
              title: '收到新评价',
              content: '李四评价了您的技能交换，给了5星好评',
              relatedId: 'appt_002',
              relatedType: 'evaluation',
              isRead: false,
              createTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
              extraData: {
                rating: 5,
                comment: '教得很好，发音纠正非常专业！',
                evaluatorName: '李四',
                skillTitle: '教英语口语，纠正发音'
              }
            },
            {
              _id: 'msg_004',
              userId: openid,
              type: 'appointment_completed',
              title: '技能交换完成',
              content: '技能交换「教英语口语，纠正发音」已完成，快去评价吧',
              relatedId: 'appt_002',
              relatedType: 'appointment',
              isRead: true,
              createTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              extraData: {
                skillTitle: '教英语口语，纠正发音',
                appointmentTime: '2026-02-03 15:00',
                partnerName: '李四'
              }
            },
            {
              _id: 'msg_005',
              userId: openid,
              type: 'appointment_cancelled',
              title: '预约已取消',
              content: '预约「吉他弹唱教学」已被取消',
              relatedId: 'appt_004',
              relatedType: 'appointment',
              isRead: false,
              createTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
              extraData: {
                skillTitle: '吉他弹唱教学',
                partnerName: '王五'
              }
            }
          ];
          // 保存到全局
          app.globalData.mockData.notifications = mockMessages;
        }

        let list = mockMessages;

        // 根据标签筛选
        if (currentTab === 'unread') {
          list = list.filter(item => !item.isRead);
        } else if (currentTab === 'appointment') {
          list = list.filter(item => item.type.includes('appointment'));
        } else if (currentTab === 'evaluation') {
          list = list.filter(item => item.type === 'evaluation_new');
        }

        list = list.map(item => ({
          ...item,
          typeText: that.getTypeText(item.type),
          typeIcon: that.getTypeIcon(item.type),
          timeStr: util.relativeTime(new Date(item.createTime).getTime()),
          showDelete: false
        }));

        const unreadCount = mockMessages.filter(item => !item.isRead).length;

        that.setData({
          messageList: refresh ? list : [...that.data.messageList, ...list],
          hasMore: false,
          loading: false,
          unreadCount: unreadCount,
          showMarkAllRead: unreadCount > 0
        });

        // 更新全局未读数
        app.updateUnreadCount(unreadCount);

        resolve();
      }, 300);
    });
  },

  // 获取类型文字
  getTypeText: function (type) {
    const typeMap = {
      'appointment_new': '新预约',
      'appointment_accepted': '预约确认',
      'appointment_rejected': '预约拒绝',
      'appointment_cancelled': '预约取消',
      'appointment_completed': '交换完成',
      'evaluation_new': '新评价',
      'system': '系统通知'
    };
    return typeMap[type] || '通知';
  },

  // 获取类型图标
  getTypeIcon: function (type) {
    const iconMap = {
      'appointment_new': '📅',
      'appointment_accepted': '✅',
      'appointment_rejected': '❌',
      'appointment_cancelled': '🚫',
      'appointment_completed': '🎉',
      'evaluation_new': '⭐',
      'system': '📢'
    };
    return iconMap[type] || '📨';
  },

  // 点击消息
  onMessageTap: function (e) {
    const message = e.currentTarget.dataset.message;

    // 标记已读
    if (!message.isRead) {
      this.markAsRead(message._id);
    }

    // 根据消息类型跳转
    this.navigateByMessage(message);
  },

  // 根据消息类型跳转
  navigateByMessage: function (message) {
    if (message.relatedType === 'appointment' && message.relatedId) {
      wx.navigateTo({
        url: `/pages/appointment/appointment?highlight=${message.relatedId}`
      });
    } else if (message.relatedType === 'evaluation') {
      wx.switchTab({
        url: '/pages/profile/profile'
      });
    }
  },

  // 标记消息已读
  markAsRead: function (notificationId) {
    const that = this;

    // 开发模式
    if (app.globalData.devMode) {
      // 同步更新全局数据
      const notifications = app.globalData.mockData.notifications || [];
      notifications.forEach(item => {
        if (item._id === notificationId) {
          item.isRead = true;
        }
      });
      app.globalData.mockData.notifications = notifications;

      const list = this.data.messageList.map(item => {
        if (item._id === notificationId) {
          return { ...item, isRead: true };
        }
        return item;
      });
      const unreadCount = list.filter(item => !item.isRead).length;
      this.setData({
        messageList: list,
        unreadCount: unreadCount,
        showMarkAllRead: unreadCount > 0
      });
      app.updateUnreadCount(unreadCount);
      return;
    }

    wx.cloud.callFunction({
      name: 'manageNotification',
      data: {
        action: 'markRead',
        data: { notificationId: notificationId }
      },
      success: res => {
        if (res.result.code === 0) {
          const list = that.data.messageList.map(item => {
            if (item._id === notificationId) {
              return { ...item, isRead: true };
            }
            return item;
          });
          const unreadCount = Math.max(0, that.data.unreadCount - 1);
          that.setData({
            messageList: list,
            unreadCount: unreadCount,
            showMarkAllRead: unreadCount > 0
          });
          app.updateUnreadCount(unreadCount);
        }
      }
    });
  },

  // 标记全部已读
  markAllAsRead: function () {
    const that = this;

    util.showConfirm('确定将所有消息标记为已读？').then(confirm => {
      if (!confirm) return;

      util.showLoading('处理中...');

      // 开发模式
      if (app.globalData.devMode) {
        setTimeout(() => {
          // 同步更新全局数据
          const notifications = app.globalData.mockData.notifications || [];
          notifications.forEach(item => {
            item.isRead = true;
          });
          app.globalData.mockData.notifications = notifications;

          const list = that.data.messageList.map(item => ({ ...item, isRead: true }));
          that.setData({
            messageList: list,
            unreadCount: 0,
            showMarkAllRead: false
          });
          app.updateUnreadCount(0);
          util.hideLoading();
          util.showSuccess('已全部已读');
        }, 300);
        return;
      }

      wx.cloud.callFunction({
        name: 'manageNotification',
        data: {
          action: 'markAllRead'
        },
        success: res => {
          util.hideLoading();
          if (res.result.code === 0) {
            const list = that.data.messageList.map(item => ({ ...item, isRead: true }));
            that.setData({
              messageList: list,
              unreadCount: 0,
              showMarkAllRead: false
            });
            app.updateUnreadCount(0);
            util.showSuccess('已全部已读');
          } else {
            util.showToast(res.result.message || '操作失败');
          }
        },
        fail: err => {
          util.hideLoading();
          util.showError('操作失败');
          console.error('标记全部已读失败', err);
        }
      });
    });
  },

  // 获取未读数量
  getUnreadCount: function () {
    const that = this;

    // 开发模式
    if (app.globalData.devMode) {
      // 从全局数据计算未读数
      const notifications = app.globalData.mockData.notifications || [];
      const unreadCount = notifications.filter(item => !item.isRead).length;
      this.setData({
        unreadCount: unreadCount,
        showMarkAllRead: unreadCount > 0
      });
      app.updateUnreadCount(unreadCount);
      return;
    }

    wx.cloud.callFunction({
      name: 'manageNotification',
      data: {
        action: 'getUnreadCount'
      },
      success: res => {
        if (res.result.code === 0) {
          const count = res.result.data.unreadCount;
          that.setData({
            unreadCount: count,
            showMarkAllRead: count > 0
          });
          app.updateUnreadCount(count);
        }
      }
    });
  },

  // 长按显示删除选项
  onMessageLongPress: function (e) {
    const message = e.currentTarget.dataset.message;
    const list = this.data.messageList.map(item => {
      if (item._id === message._id) {
        return { ...item, showDelete: true };
      }
      return { ...item, showDelete: false };
    });
    this.setData({ messageList: list });
  },

  // 删除消息
  deleteMessage: function (e) {
    const message = e.currentTarget.dataset.message;
    const that = this;

    util.showConfirm('确定删除这条消息？').then(confirm => {
      if (!confirm) {
        // 取消删除，隐藏删除按钮
        const list = that.data.messageList.map(item => ({ ...item, showDelete: false }));
        that.setData({ messageList: list });
        return;
      }

      util.showLoading('删除中...');

      // 开发模式
      if (app.globalData.devMode) {
        setTimeout(() => {
          const list = that.data.messageList.filter(item => item._id !== message._id);
          const unreadCount = list.filter(item => !item.isRead).length;
          that.setData({
            messageList: list,
            unreadCount: unreadCount,
            showMarkAllRead: unreadCount > 0
          });
          app.updateUnreadCount(unreadCount);
          util.hideLoading();
          util.showSuccess('删除成功');
        }, 300);
        return;
      }

      wx.cloud.callFunction({
        name: 'manageNotification',
        data: {
          action: 'delete',
          data: { notificationId: message._id }
        },
        success: res => {
          util.hideLoading();
          if (res.result.code === 0) {
            const list = that.data.messageList.filter(item => item._id !== message._id);
            const unreadCount = list.filter(item => !item.isRead).length;
            that.setData({
              messageList: list,
              unreadCount: unreadCount,
              showMarkAllRead: unreadCount > 0
            });
            app.updateUnreadCount(unreadCount);
            util.showSuccess('删除成功');
          } else {
            util.showToast(res.result.message || '删除失败');
          }
        },
        fail: err => {
          util.hideLoading();
          util.showError('删除失败');
          console.error('删除消息失败', err);
        }
      });
    });
  },

  // 点击页面其他地方隐藏删除按钮
  hideDeleteBtn: function () {
    const list = this.data.messageList.map(item => ({ ...item, showDelete: false }));
    this.setData({ messageList: list });
  }
});
