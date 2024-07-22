import axios from 'axios'
// import store from '@/store'

// 取消请求
const CancelToken = axios.CancelToken
const source = CancelToken.source()

// 创建 axios 实例
const request = axios.create({
  // API 请求的默认前缀
  baseURL: 'http://localhost:3003',
  timeout: 1000 * 60 * 10, // 请求超时时间
  cancelToken: source.token
})

// 异常拦截处理器
const errorHandler = (error) => {
  if (error.response) {
    const data = error.response.data
    console.log('请求报错', data)
  }
  return Promise.reject(error)
}

// request interceptor
request.interceptors.request.use(config => {
  // 取消请求
  // if (config.url == '/api/file/uploadFile') {
  //   config.cancelToken = new axios.CancelToken((cancel) => {
  //     store.commit('pushToken', {
  //       cancelToken: cancel
  //     })
  //   })
  // }
  // const token = storage.get(ACCESS_TOKEN)
  // // 如果 token 存在
  // // 让每个请求携带自定义 token 请根据实际情况自行修改
  // if (token) {
  //   config.headers['Authorization'] = token
  // }
  return config
}, errorHandler)

// response interceptor
request.interceptors.response.use((response) => {
  return response.data
}, errorHandler)

// const cancelRequest = () => {
//   source.cancel()
// }

export default request