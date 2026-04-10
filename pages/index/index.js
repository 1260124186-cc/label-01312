// pages/index/index.js
const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    // 当前选中的标签：all-全部 / skill-技能 / need-需求
    currentTab: 'all',
    // 当前选中的分类
    currentCategory: 0,
    // 分类列表
    categories: [],
    // 技能/需求列表
    skillList: [],
    // 分页
    page: 1,
    pageSize: 10,
    hasMore: true,
    // 加载状态
    loading: false,
    refreshing: false,
    // 搜索关键词
    searchKeyword: ''
  },

  onLoad: function (options) {
    // 初始化分类数据
    const categories = [
      { id: 0, name: '全部' },
      ...app.globalData.skillCategories
    ];
    this.setData({
      categories: categories
    });

    // 加载数据
    this.loadSkillList(true);
  },

  onShow: function () {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    // 每次显示时刷新数据
    if (this.data.skillList.length > 0) {
      this.loadSkillList(true);
    }
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.setData({ refreshing: true });
    this.loadSkillList(true).then(() => {
      wx.stopPullDownRefresh();
      this.setData({ refreshing: false });
    });
  },

  // 上拉加载更多
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadSkillList(false);
    }
  },

  // 切换标签
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.currentTab) {
      this.setData({
        currentTab: tab,
        page: 1,
        hasMore: true,
        skillList: []
      });
      this.loadSkillList(true);
    }
  },

  // 切换分类
  switchCategory: function (e) {
    const index = e.currentTarget.dataset.index;
    if (index !== this.data.currentCategory) {
      this.setData({
        currentCategory: index,
        page: 1,
        hasMore: true,
        skillList: []
      });
      this.loadSkillList(true);
    }
  },

  // 搜索输入
  onSearchInput: function (e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  // 执行搜索
  doSearch: function () {
    this.setData({
      page: 1,
      hasMore: true,
      skillList: []
    });
    this.loadSkillList(true);
  },

  // 加载技能/需求列表
  loadSkillList: function (refresh = false) {
    const that = this;
    
    if (that.data.loading) {
      return Promise.resolve();
    }

    that.setData({ loading: true });

    // 开发模式使用模拟数据
    if (app.globalData.devMode) {
      return that.loadMockSkillList(refresh);
    }

    const db = wx.cloud.database();
    const _ = db.command;

    // 构建查询条件
    let query = {
      status: 'active'
    };

    // 类型筛选
    if (that.data.currentTab === 'skill') {
      query.type = 'skill';
    } else if (that.data.currentTab === 'need') {
      query.type = 'need';
    }

    // 分类筛选
    if (that.data.currentCategory > 0) {
      const categoryId = that.data.categories[that.data.currentCategory].id;
      query.category = categoryId;
    }

    // 搜索关键词
    if (that.data.searchKeyword.trim()) {
      query.title = db.RegExp({
        regexp: that.data.searchKeyword.trim(),
        options: 'i'
      });
    }

    const page = refresh ? 1 : that.data.page;

    return db.collection('skills')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * that.data.pageSize)
      .limit(that.data.pageSize)
      .get()
      .then(res => {
        const list = res.data.map(item => ({
          ...item,
          createTimeStr: util.relativeTime(new Date(item.createTime).getTime())
        }));

        that.setData({
          skillList: refresh ? list : [...that.data.skillList, ...list],
          page: page + 1,
          hasMore: list.length === that.data.pageSize,
          loading: false
        });
      })
      .catch(err => {
        console.error('加载列表失败', err);
        util.showToast('加载失败');
        that.setData({ loading: false });
      });
  },

  // 加载模拟数据
  loadMockSkillList: function (refresh = false) {
    const that = this;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        let mockSkills = app.globalData.mockData.skills.filter(item => item.status === 'active');

        // 类型筛选
        if (that.data.currentTab === 'skill') {
          mockSkills = mockSkills.filter(item => item.type === 'skill');
        } else if (that.data.currentTab === 'need') {
          mockSkills = mockSkills.filter(item => item.type === 'need');
        }

        // 分类筛选
        if (that.data.currentCategory > 0) {
          const categoryId = that.data.categories[that.data.currentCategory].id;
          mockSkills = mockSkills.filter(item => item.category === categoryId);
        }

        // 搜索关键词
        if (that.data.searchKeyword.trim()) {
          const keyword = that.data.searchKeyword.trim().toLowerCase();
          mockSkills = mockSkills.filter(item => 
            item.title.toLowerCase().includes(keyword) ||
            item.description.toLowerCase().includes(keyword)
          );
        }

        // 按时间排序
        mockSkills.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

        const list = mockSkills.map(item => ({
          ...item,
          createTimeStr: util.relativeTime(new Date(item.createTime).getTime())
        }));

        that.setData({
          skillList: list,
          hasMore: false,
          loading: false
        });

        resolve();
      }, 300);
    });
  },

  // 点击技能卡片
  onSkillTap: function (e) {
    const skill = e.currentTarget.dataset.skill;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${skill._id}`
    });
  },

  // 跳转到发布页面
  goPublish: function () {
    wx.switchTab({
      url: '/pages/publish/publish'
    });
  }
});
