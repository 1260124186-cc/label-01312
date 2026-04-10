// pages/mySkills/mySkills.js
const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    type: 'skill', // skill-我的技能 / need-我的需求
    skillList: [],
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad: function (options) {
    if (options.type) {
      this.setData({
        type: options.type
      });
    }

    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: this.data.type === 'skill' ? '我的技能' : '我的需求'
    });
  },

  onShow: function () {
    this.loadMySkills(true);
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadMySkills(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMySkills(false);
    }
  },

  // 加载我的技能/需求列表
  loadMySkills: function (refresh = false) {
    const that = this;
    if (this.data.loading) return Promise.resolve();

    const openid = wx.getStorageSync('openid');
    if (!openid) {
      return Promise.resolve();
    }

    this.setData({ loading: true });

    // 开发模式使用模拟数据
    if (app.globalData.devMode) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const mockSkills = app.globalData.mockData.skills.filter(s => 
            s._openid === openid && s.type === that.data.type
          );
          const list = mockSkills.map(item => ({
            ...item,
            createTimeStr: util.relativeTime(new Date(item.createTime).getTime()),
            statusText: that.getStatusText(item.status)
          }));
          that.setData({
            skillList: list,
            hasMore: false,
            loading: false
          });
          resolve();
        }, 300);
      });
    }

    const db = wx.cloud.database();
    const page = refresh ? 1 : this.data.page;

    return db.collection('skills')
      .where({
        _openid: openid,
        type: this.data.type
      })
      .orderBy('createTime', 'desc')
      .skip((page - 1) * this.data.pageSize)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        const list = res.data.map(item => ({
          ...item,
          createTimeStr: util.relativeTime(new Date(item.createTime).getTime()),
          statusText: this.getStatusText(item.status)
        }));

        this.setData({
          skillList: refresh ? list : [...this.data.skillList, ...list],
          page: page + 1,
          hasMore: list.length === this.data.pageSize,
          loading: false
        });
      })
      .catch(err => {
        console.error('加载列表失败', err);
        this.setData({ loading: false });
      });
  },

  // 获取状态文字
  getStatusText: function (status) {
    const statusMap = {
      'active': '展示中',
      'closed': '已关闭',
      'completed': '已完成'
    };
    return statusMap[status] || status;
  },

  // 查看详情
  viewDetail: function (e) {
    const skill = e.currentTarget.dataset.skill;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${skill._id}`
    });
  },

  // 编辑技能
  editSkill: function (e) {
    const skill = e.currentTarget.dataset.skill;
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

  // 关闭技能
  closeSkill: function (e) {
    const that = this;
    const skill = e.currentTarget.dataset.skill;
    
    util.showConfirm('确定要关闭吗？关闭后将不再展示。').then(confirm => {
      if (confirm) {
        // 开发模式
        if (app.globalData.devMode) {
          const mockSkill = app.globalData.mockData.skills.find(s => s._id === skill._id);
          if (mockSkill) mockSkill.status = 'closed';
          util.showSuccess('已关闭');
          that.loadMySkills(true);
          return;
        }

        const db = wx.cloud.database();
        db.collection('skills').doc(skill._id).update({
          data: {
            status: 'closed',
            updateTime: db.serverDate()
          }
        }).then(() => {
          util.showSuccess('已关闭');
          that.loadMySkills(true);
        });
      }
    });
  },

  // 重新发布
  republishSkill: function (e) {
    const that = this;
    const skill = e.currentTarget.dataset.skill;

    // 开发模式
    if (app.globalData.devMode) {
      const mockSkill = app.globalData.mockData.skills.find(s => s._id === skill._id);
      if (mockSkill) mockSkill.status = 'active';
      util.showSuccess('已重新发布');
      that.loadMySkills(true);
      return;
    }
    
    const db = wx.cloud.database();
    db.collection('skills').doc(skill._id).update({
      data: {
        status: 'active',
        updateTime: db.serverDate()
      }
    }).then(() => {
      util.showSuccess('已重新发布');
      that.loadMySkills(true);
    });
  },

  // 删除技能
  deleteSkill: function (e) {
    const that = this;
    const skill = e.currentTarget.dataset.skill;
    
    util.showConfirm('确定要删除吗？删除后无法恢复。').then(confirm => {
      if (confirm) {
        // 开发模式
        if (app.globalData.devMode) {
          const index = app.globalData.mockData.skills.findIndex(s => s._id === skill._id);
          if (index > -1) app.globalData.mockData.skills.splice(index, 1);
          util.showSuccess('已删除');
          that.loadMySkills(true);
          return;
        }

        const db = wx.cloud.database();
        db.collection('skills').doc(skill._id).remove().then(() => {
          util.showSuccess('已删除');
          that.loadMySkills(true);
        });
      }
    });
  },

  // 去发布
  goPublish: function () {
    wx.switchTab({
      url: '/pages/publish/publish'
    });
  }
});
