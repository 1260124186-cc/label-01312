// pages/match/match.js
const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    // 匹配类型
    matchType: 'findSkill', // findSkill-找技能 / findNeed-找需求者
    // 筛选条件
    filters: {
      category: '',
      categoryIndex: -1,
      campus: '',
      campusIndex: -1,
      availableTime: []
    },
    // 分类列表
    categories: [],
    categoryNames: [],
    // 校区列表
    campusList: [],
    campusNames: [],
    // 时间选项
    timeSlots: [
      { id: 'morning', name: '上午', selected: false },
      { id: 'afternoon', name: '下午', selected: false },
      { id: 'evening', name: '晚上', selected: false },
      { id: 'weekend', name: '周末', selected: false }
    ],
    // 匹配结果
    matchResults: [],
    // 状态
    loading: false,
    hasSearched: false,
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad: function (options) {
    // 初始化分类和校区数据
    const categories = app.globalData.skillCategories;
    const campusList = app.globalData.campusList;
    
    this.setData({
      categories: categories,
      categoryNames: categories.map(c => c.name),
      campusList: campusList,
      campusNames: campusList.map(c => c.name)
    });
  },

  onShow: function () {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  // 切换匹配类型
  switchMatchType: function (e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      matchType: type,
      matchResults: [],
      hasSearched: false,
      page: 1,
      hasMore: true
    });
  },

  // 选择分类
  onCategoryChange: function (e) {
    const index = e.detail.value;
    const category = this.data.categories[index];
    this.setData({
      'filters.categoryIndex': index,
      'filters.category': category.id
    });
  },

  // 选择校区
  onCampusChange: function (e) {
    const index = e.detail.value;
    const campus = this.data.campusList[index];
    this.setData({
      'filters.campusIndex': index,
      'filters.campus': campus.name
    });
  },

  // 切换时间选择
  toggleTimeSlot: function (e) {
    const index = e.currentTarget.dataset.index;
    const timeSlots = this.data.timeSlots;
    timeSlots[index].selected = !timeSlots[index].selected;
    
    const selectedTimes = timeSlots
      .filter(t => t.selected)
      .map(t => t.id);
    
    this.setData({
      timeSlots: timeSlots,
      'filters.availableTime': selectedTimes
    });
  },

  // 开始匹配
  startMatch: function () {
    this.setData({
      matchResults: [],
      page: 1,
      hasMore: true
    });
    this.doMatch(true);
  },

  // 执行匹配
  doMatch: function (refresh = false) {
    const that = this;
    if (this.data.loading) return;

    this.setData({ loading: true });
    util.showLoading('匹配中...');

    const { category, campus, availableTime } = this.data.filters;
    const page = refresh ? 1 : this.data.page;

    // 开发模式使用模拟数据
    if (app.globalData.devMode) {
      setTimeout(() => {
        const openid = wx.getStorageSync('openid');
        let mockSkills = app.globalData.mockData.skills.filter(s => {
          // 排除自己
          if (s._openid === openid) return false;
          if (s.status !== 'active') return false;
          // 类型筛选
          if (that.data.matchType === 'findSkill' && s.type !== 'skill') return false;
          if (that.data.matchType === 'findNeed' && s.type !== 'need') return false;
          return true;
        });

        // 分类筛选
        if (category) {
          mockSkills = mockSkills.filter(s => s.category === category);
        }
        // 校区筛选
        if (campus) {
          mockSkills = mockSkills.filter(s => s.campus === campus);
        }

        // 计算匹配分数
        const matchedList = mockSkills.map(skill => {
          let matchScore = 0;
          if (campus && skill.campus === campus) matchScore += 30;
          if (category && skill.category === category) matchScore += 40;
          if (availableTime.length > 0 && skill.availableTime) {
            const overlap = availableTime.some(t => skill.availableTime.includes(t));
            if (overlap) matchScore += 30;
          }
          if (skill.publisherInfo && skill.publisherInfo.creditScore) {
            matchScore += Math.floor(skill.publisherInfo.creditScore / 10);
          }
          return { ...skill, matchScore, createTimeStr: util.relativeTime(new Date(skill.createTime).getTime()) };
        });

        matchedList.sort((a, b) => b.matchScore - a.matchScore);

        util.hideLoading();
        that.setData({
          matchResults: matchedList,
          hasMore: false,
          loading: false,
          hasSearched: true
        });
      }, 500);
      return;
    }

    wx.cloud.callFunction({
      name: 'matchSkill',
      data: {
        type: this.data.matchType,
        category: category || undefined,
        campus: campus || undefined,
        availableTime: availableTime.length > 0 ? availableTime : undefined,
        page: page,
        pageSize: this.data.pageSize
      },
      success: res => {
        util.hideLoading();
        if (res.result.code === 0) {
          const list = res.result.data.list.map(item => ({
            ...item,
            createTimeStr: util.relativeTime(new Date(item.createTime).getTime())
          }));

          this.setData({
            matchResults: refresh ? list : [...this.data.matchResults, ...list],
            page: page + 1,
            hasMore: res.result.data.hasMore,
            loading: false,
            hasSearched: true
          });
        } else {
          util.showToast(res.result.message || '匹配失败');
          this.setData({ loading: false });
        }
      },
      fail: err => {
        util.hideLoading();
        util.showError('匹配失败');
        console.error('匹配失败', err);
        this.setData({ loading: false });
      }
    });
  },

  // 加载更多
  loadMore: function () {
    if (this.data.hasMore && !this.data.loading && this.data.hasSearched) {
      this.doMatch(false);
    }
  },

  // 点击结果卡片
  onResultTap: function (e) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${item._id}`
    });
  },

  // 重置筛选条件
  resetFilters: function () {
    const timeSlots = this.data.timeSlots.map(t => ({
      ...t,
      selected: false
    }));

    this.setData({
      filters: {
        category: '',
        categoryIndex: -1,
        campus: '',
        campusIndex: -1,
        availableTime: []
      },
      timeSlots: timeSlots,
      matchResults: [],
      hasSearched: false,
      page: 1,
      hasMore: true
    });
  },

  // 上拉加载
  onReachBottom: function () {
    this.loadMore();
  }
});
