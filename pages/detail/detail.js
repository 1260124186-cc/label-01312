// pages/detail/detail.js
const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    skillId: '',
    skillInfo: null,
    loading: true,
    isOwner: false, // 是否是发布者本人
    hasAppointment: false, // 是否已预约
    // 预约表单
    showAppointmentForm: false,
    appointmentData: {
      date: '',
      time: '',
      location: '',
      message: ''
    },
    // 日期选择器
    minDate: '',
    maxDate: ''
  },

  onLoad: function (options) {
    const { id } = options;
    if (id) {
      this.setData({ skillId: id });
      this.loadSkillDetail(id);
    } else {
      util.showToast('参数错误');
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }

    // 设置日期范围
    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 1);
    
    this.setData({
      minDate: util.formatDate(today),
      maxDate: util.formatDate(maxDate)
    });
  },

  onShow: function () {
    // 每次显示时重新加载数据和检查预约状态
    if (this.data.skillId) {
      this.loadSkillDetail(this.data.skillId);
      this.checkAppointmentStatus();
    }
  },

  // 检查是否已预约
  checkAppointmentStatus: function () {
    const that = this;
    const openid = wx.getStorageSync('openid');
    if (!openid) return;

    // 开发模式
    if (app.globalData.devMode) {
      const appointments = app.globalData.mockData.appointments;
      const hasAppointment = appointments.some(a => 
        a.skillId === that.data.skillId && 
        a.receiverId === openid &&
        (a.status === 'pending' || a.status === 'confirmed')
      );
      that.setData({ hasAppointment: hasAppointment });
      return;
    }

    // 云开发模式
    wx.cloud.callFunction({
      name: 'manageAppointment',
      data: {
        action: 'checkAppointment',
        data: {
          skillId: that.data.skillId
        }
      },
      success: res => {
        if (res.result.code === 0) {
          that.setData({ hasAppointment: res.result.hasAppointment });
        }
      }
    });
  },

  // 加载技能详情
  loadSkillDetail: function (id) {
    const that = this;

    // 开发模式使用模拟数据
    if (app.globalData.devMode) {
      const skill = app.globalData.mockData.skills.find(s => s._id === id);
      if (skill) {
        const openid = wx.getStorageSync('openid');
        skill.viewCount = (skill.viewCount || 0) + 1;
        that.setData({
          skillInfo: {
            ...skill,
            createTimeStr: util.relativeTime(new Date(skill.createTime).getTime())
          },
          loading: false,
          isOwner: skill._openid === openid
        });
      } else {
        util.showToast('技能不存在');
        that.setData({ loading: false });
      }
      return;
    }

    const db = wx.cloud.database();

    db.collection('skills').doc(id).get().then(res => {
      const skill = res.data;
      const openid = wx.getStorageSync('openid');

      // 增加浏览次数
      db.collection('skills').doc(id).update({
        data: {
          viewCount: db.command.inc(1)
        }
      });

      that.setData({
        skillInfo: {
          ...skill,
          createTimeStr: util.relativeTime(new Date(skill.createTime).getTime())
        },
        loading: false,
        isOwner: skill._openid === openid
      });
    }).catch(err => {
      console.error('加载详情失败', err);
      util.showToast('加载失败');
      that.setData({ loading: false });
    });
  },

  // 联系发布者（显示预约表单）
  contactPublisher: function () {
    // 检查登录状态
    if (!app.globalData.isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再预约',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
      return;
    }

    if (this.data.isOwner) {
      util.showToast('不能预约自己的技能');
      return;
    }

    this.setData({
      showAppointmentForm: true
    });
  },

  // 关闭预约表单
  closeAppointmentForm: function () {
    this.setData({
      showAppointmentForm: false
    });
  },

  // 阻止冒泡
  stopPropagation: function () {},

  // 日期选择
  onDateChange: function (e) {
    this.setData({
      'appointmentData.date': e.detail.value
    });
  },

  // 时间选择
  onTimeChange: function (e) {
    this.setData({
      'appointmentData.time': e.detail.value
    });
  },

  // 地点输入
  onLocationInput: function (e) {
    this.setData({
      'appointmentData.location': e.detail.value
    });
  },

  // 留言输入
  onMessageInput: function (e) {
    this.setData({
      'appointmentData.message': e.detail.value
    });
  },

  // 提交预约
  submitAppointment: function () {
    const that = this;
    const { date, time, location, message } = this.data.appointmentData;

    if (!date) {
      util.showToast('请选择日期');
      return;
    }
    if (!time) {
      util.showToast('请选择时间');
      return;
    }
    if (!location.trim()) {
      util.showToast('请输入交换地点');
      return;
    }

    util.showLoading('提交中...');

    const appointmentTime = `${date} ${time}`;

    // 开发模式使用模拟数据
    if (app.globalData.devMode) {
      setTimeout(() => {
        const newAppt = {
          _id: 'appt_' + Date.now(),
          skillId: that.data.skillId,
          providerId: that.data.skillInfo._openid,
          receiverId: wx.getStorageSync('openid'),
          providerInfo: that.data.skillInfo.publisherInfo,
          receiverInfo: { nickName: '当前用户', avatarUrl: '' },
          skillTitle: that.data.skillInfo.title,
          skillType: that.data.skillInfo.type,
          appointmentTime: appointmentTime,
          duration: that.data.skillInfo.duration,
          location: location.trim(),
          status: 'pending',
          message: message.trim(),
          createTime: new Date()
        };
        app.globalData.mockData.appointments.push(newAppt);
        
        util.hideLoading();
        util.showSuccess('预约成功');
        that.setData({
          showAppointmentForm: false,
          hasAppointment: true,
          appointmentData: { date: '', time: '', location: '', message: '' }
        });
      }, 500);
      return;
    }

    wx.cloud.callFunction({
      name: 'manageAppointment',
      data: {
        action: 'create',
        data: {
          skillId: this.data.skillId,
          providerId: this.data.skillInfo._openid,
          appointmentTime: appointmentTime,
          duration: this.data.skillInfo.duration,
          location: location.trim(),
          message: message.trim()
        }
      },
      success: res => {
        util.hideLoading();
        if (res.result.code === 0) {
          util.showSuccess('预约成功');
          that.setData({
            showAppointmentForm: false,
            hasAppointment: true,
            appointmentData: {
              date: '',
              time: '',
              location: '',
              message: ''
            }
          });
        } else {
          util.showToast(res.result.message || '预约失败');
        }
      },
      fail: err => {
        util.hideLoading();
        util.showError('预约失败');
        console.error('预约失败', err);
      }
    });
  },

  // 编辑技能（发布者）
  editSkill: function () {
    const skill = this.data.skillInfo;
    if (!skill) {
      util.showToast('数据加载中，请稍后');
      return;
    }
    
    // 将技能数据存储到全局，供编辑页面使用
    app.globalData.editSkillData = {
      _id: skill._id,
      type: skill.type,
      title: skill.title,
      description: skill.description,
      category: skill.category,
      categoryName: skill.categoryName,
      duration: skill.duration,
      campus: skill.campus,
      availableTime: skill.availableTime || []
    };
    
    wx.navigateTo({
      url: '/pages/editSkill/editSkill'
    });
  },

  // 关闭技能（发布者）
  closeSkill: function () {
    const that = this;
    util.showConfirm('确定要关闭这个技能/需求吗？关闭后将不再展示。').then(confirm => {
      if (confirm) {
        // 开发模式
        if (app.globalData.devMode) {
          const skill = app.globalData.mockData.skills.find(s => s._id === that.data.skillId);
          if (skill) skill.status = 'closed';
          util.showSuccess('已关闭');
          setTimeout(() => { wx.navigateBack(); }, 1500);
          return;
        }

        const db = wx.cloud.database();
        db.collection('skills').doc(that.data.skillId).update({
          data: {
            status: 'closed',
            updateTime: db.serverDate()
          }
        }).then(() => {
          util.showSuccess('已关闭');
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }).catch(err => {
          console.error('关闭失败', err);
          util.showError('关闭失败');
        });
      }
    });
  },

  // 分享
  onShareAppMessage: function () {
    const skill = this.data.skillInfo;
    return {
      title: skill ? skill.title : '技能交换',
      path: `/pages/detail/detail?id=${this.data.skillId}`
    };
  }
});
