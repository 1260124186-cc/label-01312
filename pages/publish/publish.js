// pages/publish/publish.js
const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    // 模式：publish-发布 / edit-编辑
    mode: 'publish',
    editSkillId: '',
    // 发布类型：skill-技能 / need-需求
    publishType: 'skill',
    // 表单数据
    formData: {
      title: '',
      description: '',
      category: '',
      categoryIndex: -1,
      duration: 1,
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
    // 可选时间段
    timeSlots: [
      { id: 'morning', name: '上午 (8:00-12:00)', selected: false },
      { id: 'afternoon', name: '下午 (14:00-18:00)', selected: false },
      { id: 'evening', name: '晚上 (19:00-22:00)', selected: false },
      { id: 'weekend', name: '周末全天', selected: false }
    ],
    // 时长选项
    durationOptions: [1, 2, 3, 4, 5],
    durationIndex: 0,
    // 提交状态
    submitting: false,
    // 协议弹窗
    showAgreement: false
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

    // 如果有传入类型参数
    if (options.type) {
      this.setData({
        publishType: options.type
      });
    }

    // 编辑模式
    if (options.mode === 'edit' && app.globalData.editSkillData) {
      this.initEditMode();
    }
  },

  // 初始化编辑模式
  initEditMode: function () {
    const editData = app.globalData.editSkillData;
    if (!editData) return;

    // 设置导航栏标题
    wx.setNavigationBarTitle({ title: '编辑' });

    // 找到分类索引
    const categoryIndex = this.data.categories.findIndex(c => c.id === editData.category);
    // 找到校区索引
    const campusIndex = this.data.campusList.findIndex(c => c.name === editData.campus);
    // 找到时长索引
    const durationIndex = this.data.durationOptions.indexOf(editData.duration);

    // 设置时间段选中状态
    const timeSlots = this.data.timeSlots.map(t => ({
      ...t,
      selected: editData.availableTime && editData.availableTime.includes(t.id)
    }));

    this.setData({
      mode: 'edit',
      editSkillId: editData._id,
      publishType: editData.type,
      formData: {
        title: editData.title,
        description: editData.description,
        category: editData.category,
        categoryIndex: categoryIndex,
        duration: editData.duration,
        campus: editData.campus,
        campusIndex: campusIndex,
        availableTime: editData.availableTime || []
      },
      timeSlots: timeSlots,
      durationIndex: durationIndex >= 0 ? durationIndex : 0
    });

    // 清除全局编辑数据
    app.globalData.editSkillData = null;
  },

  onShow: function () {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    // 检查登录状态
    this.checkLogin();
  },

  // 检查登录状态
  checkLogin: function () {
    if (!app.globalData.isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再发布',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
    }
  },

  // 切换发布类型
  switchType: function (e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      publishType: type
    });
  },

  // 标题输入
  onTitleInput: function (e) {
    this.setData({
      'formData.title': e.detail.value
    });
  },

  // 描述输入
  onDescriptionInput: function (e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  // 选择分类
  onCategoryChange: function (e) {
    const index = e.detail.value;
    const category = this.data.categories[index];
    this.setData({
      'formData.categoryIndex': index,
      'formData.category': category.id
    });
  },

  // 选择校区
  onCampusChange: function (e) {
    const index = e.detail.value;
    const campus = this.data.campusList[index];
    this.setData({
      'formData.campusIndex': index,
      'formData.campus': campus.name
    });
  },

  // 选择时长
  onDurationChange: function (e) {
    const index = e.detail.value;
    this.setData({
      durationIndex: index,
      'formData.duration': this.data.durationOptions[index]
    });
  },

  // 选择可用时间
  toggleTimeSlot: function (e) {
    const index = e.currentTarget.dataset.index;
    const timeSlots = this.data.timeSlots;
    timeSlots[index].selected = !timeSlots[index].selected;
    
    // 更新选中的时间段
    const selectedTimes = timeSlots
      .filter(t => t.selected)
      .map(t => t.id);
    
    this.setData({
      timeSlots: timeSlots,
      'formData.availableTime': selectedTimes
    });
  },

  // 表单验证
  validateForm: function () {
    const { title, description, category, campus, availableTime } = this.data.formData;
    
    if (!title.trim()) {
      util.showToast('请输入标题');
      return false;
    }
    if (title.length < 2 || title.length > 30) {
      util.showToast('标题长度应在2-30字之间');
      return false;
    }
    if (!description.trim()) {
      util.showToast('请输入详细描述');
      return false;
    }
    if (description.length < 10) {
      util.showToast('描述至少需要10个字');
      return false;
    }
    if (!category) {
      util.showToast('请选择分类');
      return false;
    }
    if (!campus) {
      util.showToast('请选择校区');
      return false;
    }
    if (availableTime.length === 0) {
      util.showToast('请选择可用时间');
      return false;
    }
    
    return true;
  },

  // 提交发布
  submitPublish: function () {
    // 检查登录状态
    if (!app.globalData.isLogin) {
      util.showToast('请先登录');
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    if (this.data.submitting) {
      return;
    }

    // 编辑模式
    if (this.data.mode === 'edit') {
      this.updateSkill();
      return;
    }

    this.setData({ submitting: true });
    util.showLoading('发布中...');

    const that = this;
    const openid = wx.getStorageSync('openid');
    const userInfo = wx.getStorageSync('userInfo') || {};

    // 获取分类名称
    const categoryIndex = this.data.formData.categoryIndex;
    const categoryName = categoryIndex >= 0 ? this.data.categories[categoryIndex].name : '';

    // 构建技能/需求数据
    const skillData = {
      _id: 'skill_' + Date.now(),
      _openid: openid,
      type: this.data.publishType,
      title: this.data.formData.title.trim(),
      description: this.data.formData.description.trim(),
      category: this.data.formData.category,
      categoryName: categoryName,
      duration: this.data.formData.duration,
      campus: this.data.formData.campus,
      availableTime: this.data.formData.availableTime,
      status: 'active',
      publisherInfo: {
        nickName: userInfo.nickName || '匿名用户',
        avatarUrl: userInfo.avatarUrl || '',
        creditScore: userInfo.creditScore || 100
      },
      viewCount: 0,
      createTime: new Date(),
      updateTime: new Date()
    };

    // 开发模式使用模拟数据
    if (app.globalData.devMode) {
      setTimeout(() => {
        app.globalData.mockData.skills.unshift(skillData);
        util.hideLoading();
        util.showSuccess('发布成功');
        that.resetForm();
        that.setData({ submitting: false });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' });
        }, 1500);
      }, 500);
      return;
    }

    const db = wx.cloud.database();
    skillData.createTime = db.serverDate();
    skillData.updateTime = db.serverDate();

    db.collection('skills').add({
      data: skillData,
      success: res => {
        util.hideLoading();
        util.showSuccess('发布成功');
        
        // 重置表单
        that.resetForm();
        
        // 延迟跳转到首页
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }, 1500);
      },
      fail: err => {
        util.hideLoading();
        util.showError('发布失败');
        console.error('发布失败', err);
      },
      complete: () => {
        that.setData({ submitting: false });
      }
    });
  },

  // 更新技能（编辑模式）
  updateSkill: function () {
    const that = this;
    this.setData({ submitting: true });
    util.showLoading('保存中...');

    const categoryIndex = this.data.formData.categoryIndex;
    const categoryName = categoryIndex >= 0 ? this.data.categories[categoryIndex].name : '';

    const updateData = {
      type: this.data.publishType,
      title: this.data.formData.title.trim(),
      description: this.data.formData.description.trim(),
      category: this.data.formData.category,
      categoryName: categoryName,
      duration: this.data.formData.duration,
      campus: this.data.formData.campus,
      availableTime: this.data.formData.availableTime
    };

    // 开发模式
    if (app.globalData.devMode) {
      setTimeout(() => {
        const skill = app.globalData.mockData.skills.find(s => s._id === that.data.editSkillId);
        if (skill) {
          Object.assign(skill, updateData);
          skill.updateTime = new Date();
        }
        util.hideLoading();
        util.showSuccess('保存成功');
        that.setData({ submitting: false });
        setTimeout(() => { wx.navigateBack(); }, 1500);
      }, 500);
      return;
    }

    const db = wx.cloud.database();
    updateData.updateTime = db.serverDate();

    db.collection('skills').doc(this.data.editSkillId).update({
      data: updateData,
      success: () => {
        util.hideLoading();
        util.showSuccess('保存成功');
        setTimeout(() => { wx.navigateBack(); }, 1500);
      },
      fail: err => {
        util.hideLoading();
        util.showError('保存失败');
        console.error('保存失败', err);
      },
      complete: () => {
        that.setData({ submitting: false });
      }
    });
  },

  // 重置表单
  resetForm: function () {
    const timeSlots = this.data.timeSlots.map(t => ({
      ...t,
      selected: false
    }));

    this.setData({
      mode: 'publish',
      editSkillId: '',
      formData: {
        title: '',
        description: '',
        category: '',
        categoryIndex: -1,
        duration: 1,
        campus: '',
        campusIndex: -1,
        availableTime: []
      },
      timeSlots: timeSlots,
      durationIndex: 0
    });
  },

  // 显示协议弹窗
  showAgreementModal: function () {
    this.setData({ showAgreement: true });
  },

  // 关闭协议弹窗
  closeAgreementModal: function () {
    this.setData({ showAgreement: false });
  },

  // 阻止冒泡
  stopPropagation: function () {}
});
