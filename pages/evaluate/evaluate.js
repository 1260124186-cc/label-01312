// pages/evaluate/evaluate.js
const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    // 页面模式
    mode: 'submit', // submit-提交评价 / list-查看评价列表
    // 预约ID
    appointmentId: '',
    appointmentInfo: null,
    // 评价表单
    rating: 5,
    comment: '',
    selectedTags: [],
    // 可选标签
    tags: [
      { id: 'patient', name: '耐心教学', selected: false },
      { id: 'professional', name: '专业能力强', selected: false },
      { id: 'friendly', name: '态度友好', selected: false },
      { id: 'punctual', name: '守时守约', selected: false },
      { id: 'helpful', name: '收获很大', selected: false },
      { id: 'recommend', name: '值得推荐', selected: false }
    ],
    // 已评价
    hasEvaluated: false,
    // 评价列表（查看模式）
    evaluationList: [],
    averageRating: 0,
    totalEvaluations: 0,
    loading: false,
    submitting: false
  },

  onLoad: function (options) {
    const { appointmentId, type, userId } = options;

    if (appointmentId) {
      // 提交评价模式
      this.setData({
        mode: 'submit',
        appointmentId: appointmentId
      });
      this.loadAppointmentInfo(appointmentId);
      this.checkEvaluated(appointmentId);
    } else if (type === 'received' || userId) {
      // 查看评价列表模式
      this.setData({
        mode: 'list'
      });
      this.loadEvaluationList(userId);
    }
  },

  // 加载预约信息
  loadAppointmentInfo: function (appointmentId) {
    const that = this;

    // 开发模式
    if (app.globalData.devMode) {
      const appt = app.globalData.mockData.appointments.find(a => a._id === appointmentId);
      if (appt) {
        that.setData({ appointmentInfo: appt });
      }
      return;
    }

    const db = wx.cloud.database();
    
    db.collection('appointments').doc(appointmentId).get().then(res => {
      this.setData({
        appointmentInfo: res.data
      });
    }).catch(err => {
      console.error('加载预约信息失败', err);
    });
  },

  // 检查是否已评价
  checkEvaluated: function (appointmentId) {
    const that = this;

    // 开发模式
    if (app.globalData.devMode) {
      const openid = wx.getStorageSync('openid');
      const evaluated = app.globalData.mockData.evaluations.some(e => 
        e.appointmentId === appointmentId && e.evaluatorId === openid
      );
      that.setData({ hasEvaluated: evaluated });
      return;
    }

    wx.cloud.callFunction({
      name: 'submitEvaluation',
      data: {
        action: 'checkEvaluated',
        data: {
          appointmentId: appointmentId
        }
      },
      success: res => {
        if (res.result.code === 0) {
          this.setData({
            hasEvaluated: res.result.data.evaluated
          });
        }
      }
    });
  },

  // 加载评价列表
  loadEvaluationList: function (userId) {
    const that = this;
    this.setData({ loading: true });

    // 如果没有指定userId，加载当前用户收到的评价
    const targetUserId = userId || wx.getStorageSync('openid');

    // 开发模式
    if (app.globalData.devMode) {
      setTimeout(() => {
        const evals = app.globalData.mockData.evaluations.filter(e => e.evaluateeId === targetUserId);
        let totalRating = 0;
        evals.forEach(e => totalRating += e.rating);
        const avgRating = evals.length > 0 ? (totalRating / evals.length).toFixed(1) : 0;
        
        that.setData({
          evaluationList: evals,
          averageRating: avgRating,
          totalEvaluations: evals.length,
          loading: false
        });
      }, 300);
      return;
    }

    wx.cloud.callFunction({
      name: 'submitEvaluation',
      data: {
        action: 'getEvaluations',
        data: {
          userId: targetUserId,
          page: 1,
          pageSize: 50
        }
      },
      success: res => {
        if (res.result.code === 0) {
          this.setData({
            evaluationList: res.result.data.list,
            averageRating: res.result.data.averageRating,
            totalEvaluations: res.result.data.total,
            loading: false
          });
        } else {
          this.setData({ loading: false });
        }
      },
      fail: err => {
        console.error('加载评价列表失败', err);
        this.setData({ loading: false });
      }
    });
  },

  // 选择评分
  selectRating: function (e) {
    const rating = e.currentTarget.dataset.rating;
    this.setData({
      rating: rating
    });
  },

  // 切换标签选择
  toggleTag: function (e) {
    const tagId = e.currentTarget.dataset.id;
    const selectedTags = [...this.data.selectedTags];
    const tags = this.data.tags.map(tag => {
      if (tag.id === tagId) {
        return { ...tag, selected: !tag.selected };
      }
      return tag;
    });
    
    const index = selectedTags.indexOf(tagId);
    if (index > -1) {
      selectedTags.splice(index, 1);
    } else {
      selectedTags.push(tagId);
    }
    
    this.setData({
      tags: tags,
      selectedTags: selectedTags
    });
  },

  // 评价内容输入
  onCommentInput: function (e) {
    this.setData({
      comment: e.detail.value
    });
  },

  // 提交评价
  submitEvaluation: function () {
    const that = this;

    if (this.data.hasEvaluated) {
      util.showToast('您已评价过了');
      return;
    }

    if (!this.data.comment.trim() && this.data.selectedTags.length === 0) {
      util.showToast('请填写评价内容或选择标签');
      return;
    }

    if (this.data.submitting) return;

    this.setData({ submitting: true });
    util.showLoading('提交中...');

    // 获取选中的标签名称
    const tagNames = this.data.tags
      .filter(t => this.data.selectedTags.includes(t.id))
      .map(t => t.name);

    // 开发模式
    if (app.globalData.devMode) {
      setTimeout(() => {
        const openid = wx.getStorageSync('openid');
        const appt = app.globalData.mockData.appointments.find(a => a._id === that.data.appointmentId);
        const evaluateeId = appt ? (appt.providerId === openid ? appt.receiverId : appt.providerId) : '';
        
        const newEval = {
          _id: 'eval_' + Date.now(),
          appointmentId: that.data.appointmentId,
          evaluatorId: openid,
          evaluateeId: evaluateeId,
          evaluatorInfo: { nickName: '当前用户', avatarUrl: '' },
          rating: that.data.rating,
          comment: that.data.comment.trim(),
          tags: tagNames,
          createTime: new Date()
        };
        app.globalData.mockData.evaluations.push(newEval);
        
        util.hideLoading();
        util.showSuccess('评价成功');
        that.setData({ submitting: false });
        setTimeout(() => { wx.navigateBack(); }, 1500);
      }, 500);
      return;
    }

    wx.cloud.callFunction({
      name: 'submitEvaluation',
      data: {
        action: 'submit',
        data: {
          appointmentId: this.data.appointmentId,
          rating: this.data.rating,
          comment: this.data.comment.trim(),
          tags: tagNames
        }
      },
      success: res => {
        util.hideLoading();
        if (res.result.code === 0) {
          util.showSuccess('评价成功');
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          util.showToast(res.result.message || '评价失败');
        }
      },
      fail: err => {
        util.hideLoading();
        util.showError('评价失败');
        console.error('评价失败', err);
      },
      complete: () => {
        this.setData({ submitting: false });
      }
    });
  },

  // 渲染星星
  getStarArray: function (rating) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push({
        value: i,
        active: i <= rating
      });
    }
    return stars;
  }
});
