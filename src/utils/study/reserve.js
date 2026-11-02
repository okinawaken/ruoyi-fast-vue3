import { RESERVE_ENDED_STATUS } from './constants'
import { toFiniteNumber } from './internal'

/**
 * 解析预约的结束时间（本地时区）
 * reserveDateStr 为 yyyy-MM-dd，reserveTimeStr 为 HH:mm-HH:mm
 * @returns {Date|null}
 */
function parseReserveEndTime(reserve) {
  if (!reserve || typeof reserve !== 'object') {
    return null
  }
  const dateMatch = String(reserve.reserveDateStr || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!dateMatch) {
    return null
  }
  const timeMatch = String(reserve.reserveTimeStr || '').match(/(\d{1,2}):(\d{2})\s*[-–—~至]\s*(\d{1,2}):(\d{2})/)
  if (!timeMatch) {
    return null
  }
  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const endHour = Number(timeMatch[3])
  const endMinute = Number(timeMatch[4])
  if (month < 1 || month > 12 || day < 1 || day > 31 || endHour > 23 || endMinute > 59) {
    return null
  }
  const end = new Date(year, month - 1, day, endHour, endMinute, 59, 999)
  return Number.isNaN(end.getTime()) ? null : end
}

/**
 * 预约是否已结束
 * 1. 状态明确为已取消/已完成等 -> 已结束
 * 2. 否则按预约结束时间判断：结束时间已过即为已结束
 *    （上游「已签到」既可能是正在学习，也可能是历史记录，不能只看状态）
 * @param {object} reserve 我的预约列表元素
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
export function isEndedReserve(reserve, now = new Date()) {
  const status = String(reserve?.reserveStatusDesc || '').trim()
  if (RESERVE_ENDED_STATUS.some(keyword => status.includes(keyword))) {
    return true
  }
  const end = parseReserveEndTime(reserve)
  if (end && end.getTime() < (now instanceof Date ? now.getTime() : Date.now())) {
    return true
  }
  return false
}

/**
 * 生成预约规则文案（只输出后端真实返回的字段）
 */
export function formatReserveRules(config) {
  if (!config || typeof config !== 'object') {
    return []
  }
  const rules = []
  const minHours = toFiniteNumber(config.reserveMinHours)
  const holdMinutes = toFiniteNumber(config.reserveHoldMinutes)
  const cancelMinutes = toFiniteNumber(config.reserveCancelMinutes)
  const cancelLimit = toFiniteNumber(config.reserveCancelLimit)

  if (minHours !== null && minHours > 0) {
    rules.push(`单次预约至少 ${minHours} 小时`)
  }
  if (holdMinutes !== null && holdMinutes > 0) {
    rules.push(`预约成功后保留座位 ${holdMinutes} 分钟`)
  }
  if (cancelMinutes !== null && cancelMinutes > 0) {
    rules.push(`需提前 ${cancelMinutes} 分钟取消预约`)
  }
  if (cancelLimit !== null && cancelLimit > 0) {
    rules.push(`最多可取消 ${cancelLimit} 次`)
  }
  return rules
}
