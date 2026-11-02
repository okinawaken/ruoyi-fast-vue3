import { TOKEN_INVALID_CODE } from './constants'
import { pad2, toFiniteNumber } from './internal'

/**
 * 宽松布尔值转换，支持 true/false、'true'/'false'、1/0、'1'/'0'
 */
export function toBool(value) {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value === 1
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
  }
  return false
}

/**
 * 手机号脱敏：13812346021 -> 138****6021
 */
export function maskMobile(mobile) {
  if (mobile === null || mobile === undefined) {
    return ''
  }
  const value = String(mobile).trim()
  if (!value) {
    return ''
  }
  if (value.length >= 7) {
    return `${value.slice(0, 3)}****${value.slice(-4)}`
  }
  if (value.length >= 2) {
    return `${value.slice(0, 1)}****${value.slice(-1)}`
  }
  return '*'
}

/**
 * 金额展示：保留两位小数
 */
export function formatMoney(value) {
  const num = toFiniteNumber(value)
  return num === null ? '—' : num.toFixed(2)
}

/**
 * 毫秒时间戳转 yyyy-MM-dd HH:mm
 */
export function formatTimestamp(value) {
  const num = toFiniteNumber(value)
  if (num === null || num <= 0) {
    return ''
  }
  const date = new Date(num)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/**
 * 是否属于 token 失效错误
 */
export function isTokenInvalidError(error) {
  return !!error && Number(error.code) === TOKEN_INVALID_CODE
}
