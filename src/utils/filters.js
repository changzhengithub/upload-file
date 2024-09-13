/**
 * @description 定义全局过滤器，main自动引入注册为全局
 * @author changz
 * */

import Vue from 'vue'

/**
 * @description 文件大小格式过滤器
 * @param {Number} value 文件大小 Byte字节
 * @example {{fileSize | formatSize}}
 * @return 3MB
 * @author changz
 * */
Vue.filter('formatSize', function(value) {
  if (!value) return '0B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const unitIndex = Math.floor((Math.log(value) / Math.log(1024)));
  const readableSize = (value / Math.pow(1024, unitIndex)).toFixed(2);

  return `${readableSize}${units[unitIndex]}`;
})

/**
 * @description 时间多少格式过滤器
 * 将秒转成分钟小时或者天
 * @param {Number} value 多少秒
 * @example {{time | calcTime}}
 * @return 10分钟
 * @author changz
 * */
Vue.filter('calcTime', function(value) {
  if (!value) return '0秒';

  const units = ['秒', '分钟', '小时', '天'];
  const unitIndex = Math.floor((Math.log(value) / Math.log(60)));
  const readableSize = unitIndex < 2 ? parseInt(value / Math.pow(60, unitIndex)) : (value / Math.pow(60, unitIndex)).toFixed(2);

  return `${readableSize}${units[unitIndex]}`;
})