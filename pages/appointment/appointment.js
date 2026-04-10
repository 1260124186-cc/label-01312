// pages/appointment/appointment.js
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
      { key: 'pending', name: '待确认' },
      { key: 'confirmed', name: '已确认' },
      { key: 'completed', name: '已完成' }
    ],
    // 预约列表
    appointmentList: [],
    // 状态
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad: function (options) {
    // 如果有传入的状态筛选
    if (options.status) {
      this.setData({
        currentTab: options.status
      });
    }
  },

  onShow: function () {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    // 检查登录状态
    const isLogin = app.globalData.isLogin;
    this.setData({ isLogin: isLogin });
    
    if (!isLogin) {
      // 未登录时清空列表
      this.setData({ appointmentList: [] });
      return;
    }
    
    this.loadAppointments(true);
  },

  // 跳转登录
  goLogin: function () {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadAppointments(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadAppointments(false);
    }
  },

  // 切换标签
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.currentTab) {
      this.setData({
        currentTab: tab,
        appointmentList: [],
        page: 1,
        hasMore: true
      });
      this.loadAppointments(true);
    }
  },

  // 加载预约列表
  loadAppointments: function (refresh = false) {
    const that = this;
    if (this.data.loading) return Promise.resolve();

    this.setData({ loading: true });

    const page = refresh ? 1 : this.data.page;
    const status = this.data.currentTab === 'all' ? undefined : this.data.currentTab;

    // 开发模式使用模拟数据
    if (app.globalData.devMode) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const openid = wx.getStorageSync('openid');
          let mockAppts = app.globalData.mockData.appointments.filter(item => 
            item.providerId === openid || item.receiverId === openid
          );

          // 状态筛选
          if (status) {
            mockAppts = mockAppts.filter(item => item.status === status);
          }

          const list = mockAppts.map(item => {
            // 检查是否已评价
            const hasEvaluated = app.globalData.mockData.evaluations.some(e => 
              e.appointmentId === item._id && e.evaluatorId === openid
            );
            return {
              ...item,
              isProvider: item.providerId === openid,
              partnerInfo: item.providerId === openid ? item.receiverInfo : item.providerInfo,
              statusText: that.getStatusText(item.status),
              statusClass: item.status,
              hasEvaluated: hasEvaluated
            };
          });

          that.setData({
            appointmentList: list,
            hasMore: false,
            loading: false
          });
          resolve();
        }, 300);
      });
    }

    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'manageAppointment',
        data: {
          action: 'getMyAppointments',
          data: {
            type: 'all',
            status: status,
            page: page,
            pageSize: this.data.pageSize
          }
        },
        success: res => {
          if (res.result.code === 0) {
            const openid = wx.getStorageSync('openid');
            const list = res.result.data.list.map(item => ({
              ...item,
              // 判断当前用户是提供者还是接收者
              isProvider: item.providerId === openid,
              // 对方信息
              partnerInfo: item.providerId === openid ? item.receiverInfo : item.providerInfo,
              // 状态文字
              statusText: this.getStatusText(item.status),
              statusClass: item.status
            }));

            this.setData({
              appointmentList: refresh ? list : [...this.data.appointmentList, ...list],
              page: page + 1,
              hasMore: list.length === this.data.pageSize,
              loading: false
            });
          } else {
            util.showToast(res.result.message || '加载失败');
            this.setData({ loading: false });
          }
          resolve();
        },
        fail: err => {
          console.error('加载预约失败', err);
          util.showError('加载失败');
          this.setData({ loading: false });
          reject(err);
        }
      });
    });
  },

  // 获取状态文字
  getStatusText: function (status) {
    const statusMap = {
      'pending': '待确认',
      'confirmed': '已确认',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  },

  // 确认预约
  confirmAppointment: function (e) {
    const appointment = e.currentTarget.dataset.appointment;
    
    util.showConfirm('确定接受这个预约吗？').then(confirm => {
      if (confirm) {
        this.updateAppointmentStatus(appointment._id, 'confirmed');
      }
    });
  },

  // 完成预约
  completeAppointment: function (e) {
    const appointment = e.currentTarget.dataset.appointment;
    
    util.showConfirm('确定技能交换已完成吗？完成后可以进行评价。').then(confirm => {
      if (confirm) {
        this.updateAppointmentStatus(appointment._id, 'completed');
      }
    });
  },

  // 取消预约
  cancelAppointment: function (e) {
    const appointment = e.currentTarget.dataset.appointment;
    
    util.showConfirm('确定要取消这个预约吗？').then(confirm => {
      if (confirm) {
        this.updateAppointmentStatus(appointment._id, 'cancelled');
      }
    });
  },

  // 更新预约状态
  updateAppointmentStatus: function (appointmentId, status) {
    const that = this;
    util.showLoading('处理中...');

    // 开发模式使用模拟数据
    if (app.globalData.devMode) {
      setTimeout(() => {
        const appt = app.globalData.mockData.appointments.find(a => a._id === appointmentId);
        if (appt) {
          appt.status = status;
        }
        util.hideLoading();
        util.showSuccess('操作成功');
        that.loadAppointments(true);
      }, 300);
      return;
    }

    wx.cloud.callFunction({
      name: 'manageAppointment',
      data: {
        action: 'updateStatus',
        data: {
          appointmentId: appointmentId,
          status: status
        }
      },
      success: res => {
        util.hideLoading();
        if (res.result.code === 0) {
          util.showSuccess('操作成功');
          // 刷新列表
          this.loadAppointments(true);
        } else {
          util.showToast(res.result.message || '操作失败');
        }
      },
      fail: err => {
        util.hideLoading();
        util.showError('操作失败');
        console.error('更新状态失败', err);
      }
    });
  },

  // 去评价
  goEvaluate: function (e) {
    const appointment = e.currentTarget.dataset.appointment;
    wx.navigateTo({
      url: `/pages/evaluate/evaluate?appointmentId=${appointment._id}`
    });
  },

  // 查看技能详情
  viewSkillDetail: function (e) {
    const appointment = e.currentTarget.dataset.appointment;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${appointment.skillId}`
    });
  }
});
