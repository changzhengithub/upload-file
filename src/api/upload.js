/**
 * @description 接口API
 */

import request from '@/utils/request'

const api = {
  upload: '/upload',
  verify: '/verify',
  merge: '/merge'
}

export default api

// 切片上传
export function uploadApi(data, {
  signal, // 取消上传
  onUploadProgress // 进度条
}) {
  return request({
    url: api.upload,
    method: 'post',
    data,
    onUploadProgress,
    signal
  })
}

// 验证是否上传
export function verifyApi(data) {
  return request({
    url: api.verify,
    method: 'post',
    data
  })
}

// 合并接口
export function mergeApi(data) {
  return request({
    url: api.merge,
    method: 'post',
    data
  })
}