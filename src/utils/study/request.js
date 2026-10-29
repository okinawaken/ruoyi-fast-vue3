import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getToken } from '@/utils/auth'
import { TOKEN_INVALID_CODE } from './constants'

/**
 * 自习室模块专用请求实例。
 *
 * 与全局 request.js 的区别：保留后端错误码（如 40102 token 失效），
 * 便于页面统一识别并展示「重新绑定」引导；其余错误直接 toast。
 */
const service = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 30000
})

service.interceptors.request.use(
  config => {
    const token = getToken()
    if (token) {
      config.headers['Authorization'] = 'Bearer ' + token
    }
    return config
  },
  error => Promise.reject(error)
)

service.interceptors.response.use(
  response => {
    const body = response.data
    if (!body || typeof body !== 'object') {
      const err = new Error('接口返回为空')
      err.code = -1
      ElMessage.error(err.message)
      return Promise.reject(err)
    }
    const code = Number(body.code)
    if (code === 200) {
      return body
    }
    const message = body.msg || '接口调用失败'
    const err = new Error(message)
    err.code = code
    err.msg = message
    err.data = body
    // token 失效由页面展示横幅引导重新绑定，避免重复弹窗
    if (code !== TOKEN_INVALID_CODE) {
      ElMessage.error(message)
    }
    return Promise.reject(err)
  },
  error => {
    let message = error.message || '网络异常'
    if (message === 'Network Error') {
      message = '后端接口连接异常'
    } else if (message.includes('timeout')) {
      message = '请求超时，请稍后重试'
    } else if (message.includes('Request failed with status code')) {
      message = '接口' + message.substr(message.length - 3) + '异常'
    }
    ElMessage.error(message)
    const err = new Error(message)
    err.code = -1
    return Promise.reject(err)
  }
)

export default service
