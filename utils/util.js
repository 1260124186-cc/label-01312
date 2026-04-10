/**
 * 工具函数集合
 */

// 格式化时间
const formatTime = date => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`;
};

// 格式化日期
const formatDate = date => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${formatNumber(month)}-${formatNumber(day)}`;
};

// 格式化数字（补零）
const formatNumber = n => {
  n = n.toString();
  return n[1] ? n : `0${n}`;
};

// 相对时间
const relativeTime = timestamp => {
  const now = new Date().getTime();
  const diff = now - timestamp;
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return Math.floor(diff / minute) + '分钟前';
  } else if (diff < day) {
    return Math.floor(diff / hour) + '小时前';
  } else if (diff < week) {
    return Math.floor(diff / day) + '天前';
  } else if (diff < month) {
    return Math.floor(diff / week) + '周前';
  } else {
    const date = new Date(timestamp);
    return formatDate(date);
  }
};

// 显示加载提示
const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title: title,
    mask: true
  });
};

// 隐藏加载提示
const hideLoading = () => {
  wx.hideLoading();
};

// 显示成功提示
const showSuccess = (title) => {
  wx.showToast({
    title: title,
    icon: 'success',
    duration: 2000
  });
};

// 显示错误提示
const showError = (title) => {
  wx.showToast({
    title: title,
    icon: 'error',
    duration: 2000
  });
};

// 显示普通提示
const showToast = (title) => {
  wx.showToast({
    title: title,
    icon: 'none',
    duration: 2000
  });
};

// 显示确认对话框
const showConfirm = (content, title = '提示') => {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: title,
      content: content,
      success: res => {
        if (res.confirm) {
          resolve(true);
        } else {
          resolve(false);
        }
      },
      fail: err => {
        reject(err);
      }
    });
  });
};

// 检查是否登录
const checkLogin = () => {
  const app = getApp();
  return app.globalData.isLogin;
};

// 获取当前用户openid
const getOpenid = () => {
  const app = getApp();
  return app.globalData.openid || wx.getStorageSync('openid');
};

// 跳转到登录
const goLogin = () => {
  wx.navigateTo({
    url: '/pages/profile/profile'
  });
};

// 防抖函数
const debounce = (fn, delay = 500) => {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

// 节流函数
const throttle = (fn, delay = 500) => {
  let lastTime = 0;
  return function (...args) {
    const nowTime = Date.now();
    if (nowTime - lastTime > delay) {
      fn.apply(this, args);
      lastTime = nowTime;
    }
  };
};

// 生成唯一ID
const generateId = () => {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

module.exports = {
  formatTime,
  formatDate,
  formatNumber,
  relativeTime,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showToast,
  showConfirm,
  checkLogin,
  getOpenid,
  goLogin,
  debounce,
  throttle,
  generateId
};
