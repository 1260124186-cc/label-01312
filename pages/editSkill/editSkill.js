// pages/editSkill/editSkill.js
const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
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
    submitting: false
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

    // 初始化编辑数据
    this.initEditMode();
  },

  // 初始化编辑模式
  initEditMode: function () {
    const editData = app.globalData.editSkillData;
    if (!editData) {
      util.showToast('编辑数据不存在');
      setTimeout(() => { wx.navigateBack(); }, 1500);
      return;
    }

    // 设置导航栏标题
    wx.setNavigationBarTitle({ title: '编辑' + (editData.type === 'skill' ? '技能' : '需求') });

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

  // 标题输入
  onTitleInput: function (e) {
    this.setData({
      'formData.title': e.detail.value
    });
  },

  // 描述输入
  onDescInput: function (e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  // 选择分类
  onCategoryChange: function (e) {
    const index = parseInt(e.detail.value);
    this.setData({
      'formData.categoryIndex': index,
      'formData.category': this.data.categories[index].id
    });
  },

  // 选择时长
  onDurationChange: function (e) {
    const index = parseInt(e.detail.value);
    this.setData({
      durationIndex: index,
      'formData.duration': this.data.durationOptions[index]
    });
  },

  // 选择校区
  onCampusChange: function (e) {
    const index = parseInt(e.detail.value);
    this.setData({
      'formData.campusIndex': index,
      'formData.campus': this.data.campusList[index].name
    });
  },

  // 切换时间段选择
  toggleTimeSlot: function (e) {
    const id = e.currentTarget.dataset.id;
    const timeSlots = this.data.timeSlots.map(t => {
      if (t.id === id) {
        return { ...t, selected: !t.selected };
      }
      return t;
    });

    const availableTime = timeSlots.filter(t => t.selected).map(t => t.id);

    this.setData({
      timeSlots: timeSlots,
      'formData.availableTime': availableTime
    });
  },

  // 表单验证
  validateForm: function () {
    const { title, description, categoryIndex, campusIndex, availableTime } = this.data.formData;

    if (!title.trim()) {
      util.showToast('请输入标题');
      return false;
    }
    if (!description.trim()) {
      util.showToast('请输入详细描述');
      return false;
    }
    if (categoryIndex < 0) {
      util.showToast('请选择分类');
      return false;
    }
    if (campusIndex < 0) {
      util.showToast('请选择校区');
      return false;
    }
    if (availableTime.length === 0) {
      util.showToast('请选择可用时间');
      return false;
    }
    return true;
  },

  // 提交保存
  submitEdit: function () {
    if (!this.validateForm()) return;
    if (this.data.submitting) return;

    this.updateSkill();
  },

  // 更新技能
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
  }
});
