import {
  HIDDEN_VENUE_KEYWORDS,
  LAST_SLOT_KEY,
  LAST_VENUE_KEY,
  RESERVE_ENDED_STATUS,
  SEAT_STATE,
  TIME_STEP_MINUTES,
  TOKEN_INVALID_CODE
} from './constants'

const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toFiniteNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeTimeText(time) {
  const minutes = parseTimeToMinutes(time)
  return minutes === null ? '' : minutesToTime(minutes)
}

function timePointToTime(point) {
  if (!point) {
    return ''
  }
  if (typeof point === 'string') {
    return normalizeTimeText(point)
  }
  if (typeof point === 'object') {
    if (typeof point.timeStr === 'string') {
      const text = normalizeTimeText(point.timeStr)
      if (text) {
        return text
      }
    }
    const hour = toFiniteNumber(point.hour)
    const minute = toFiniteNumber(point.minute)
    if (hour === null || minute === null) {
      return ''
    }
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return ''
    }
    return `${pad2(hour)}:${pad2(minute)}`
  }
  return ''
}

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
 * 解析接口返回的日期文本
 * '2026-10-27 (周二)' / '2026.10.27' / '2026/10/27' -> { value, weekday, isToday, label }
 */
export function parseApiDate(dateStr) {
  if (typeof dateStr !== 'string') {
    return null
  }
  // 上游日期分隔符不统一，横线、点、斜杠都需要兼容
  const match = dateStr.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s*[（(]\s*(周[一二三四五六日天])\s*[）)])?/)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  const weekday = match[4] || WEEKDAY_TEXT[date.getDay()]
  const now = new Date()
  const isToday = now.getFullYear() === year && now.getMonth() === month - 1 && now.getDate() === day
  const value = `${year}-${pad2(month)}-${pad2(day)}`
  const label = `${month}月${day}日 ${weekday}${isToday ? ' · 今天' : ''}`
  return { value, weekday, isToday, label }
}

/**
 * 'HH:mm' 转当天分钟数，非法返回 null
 */
export function parseTimeToMinutes(time) {
  if (typeof time !== 'string') {
    return null
  }
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return null
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }
  return hour * 60 + minute
}

/**
 * 当天分钟数转 'HH:mm'
 */
export function minutesToTime(minutes) {
  const value = toFiniteNumber(minutes)
  if (value === null) {
    return ''
  }
  const total = Math.round(value)
  if (total < 0 || total > 1439) {
    return ''
  }
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
}

/**
 * 时长文案：180 -> '3 小时'，200 -> '3 小时 20 分'
 */
export function formatDurationText(minutes) {
  const value = toFiniteNumber(minutes)
  if (value === null) {
    return ''
  }
  const total = Math.max(0, Math.round(value))
  const hour = Math.floor(total / 60)
  const minute = total % 60
  if (hour > 0 && minute > 0) {
    return `${hour} 小时 ${minute} 分`
  }
  if (hour > 0) {
    return `${hour} 小时`
  }
  return `${minute} 分`
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
 * 从门店信息中提取营业时间，优先 venueOpenTime，其次 minTime/maxTime
 */
export function parseVenueOpenClose(venue) {
  const empty = { open: '', close: '' }
  if (!venue || typeof venue !== 'object') {
    return empty
  }
  if (typeof venue.venueOpenTime === 'string') {
    const match = venue.venueOpenTime.match(/(\d{1,2}:\d{2})\s*(?:-|~|—|－|至)\s*(\d{1,2}:\d{2})/)
    if (match) {
      const open = normalizeTimeText(match[1])
      const close = normalizeTimeText(match[2])
      if (open && close) {
        return { open, close }
      }
    }
  }
  const open = timePointToTime(venue.minTime)
  const close = timePointToTime(venue.maxTime)
  if (open && close) {
    return { open, close }
  }
  return empty
}

/**
 * 生成时间下拉选项（含 open，不超过 close）
 */
export function buildTimeOptions(open, close, step = TIME_STEP_MINUTES) {
  const openMinutes = parseTimeToMinutes(open)
  const closeMinutes = parseTimeToMinutes(close)
  const stepValue = toFiniteNumber(step)
  if (openMinutes === null || closeMinutes === null || stepValue === null || closeMinutes < openMinutes) {
    return []
  }
  const stepMinutes = Math.max(1, Math.round(stepValue))
  const options = []
  for (let current = openMinutes; current <= closeMinutes; current += stepMinutes) {
    const text = minutesToTime(current)
    if (text) {
      options.push(text)
    }
  }
  return options
}

/**
 * 座位在指定时段内是否可预约
 */
export function isSeatSelectable(seat, startTime, endTime) {
  if (!seat || typeof seat !== 'object') {
    return false
  }
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  const state = Number(seat.seatReserveState)
  // 签到 / 换座场景没有时段概念，空闲座位即可选择
  if (start === null || end === null) {
    return state === SEAT_STATE.FREE
  }
  if (state === SEAT_STATE.FREE) {
    return true
  }
  if (state !== SEAT_STATE.PARTIAL) {
    return false
  }
  const validList = seat.validTimeStrList
  if (!Array.isArray(validList) || validList.length === 0) {
    return false
  }
  return validList.some(item => {
    if (!item || typeof item !== 'object') {
      return false
    }
    const validStart = parseTimeToMinutes(item.validStartTimeStr)
    const validEnd = parseTimeToMinutes(item.validEndTimeStr)
    if (validStart === null || validEnd === null) {
      return false
    }
    return validStart <= start && validEnd >= end
  })
}

/**
 * 座位展示状态
 */
export function getSeatDisplayState(seat, startTime, endTime) {
  const selectable = isSeatSelectable(seat, startTime, endTime)
  const stateCode = seat ? Number(seat.seatReserveState) : NaN
  if (stateCode === SEAT_STATE.FREE && selectable) {
    return { selectable: true, state: 'free', description: '可约' }
  }
  if (stateCode === SEAT_STATE.PARTIAL && selectable) {
    return { selectable: true, state: 'partial', description: '覆盖所选时段' }
  }
  if (stateCode === SEAT_STATE.PARTIAL || (stateCode === SEAT_STATE.FREE && !selectable)) {
    const description = seat?.minStartTimeStr ? `${seat.minStartTimeStr} 后才可约` : '该时段不可约'
    return { selectable: false, state: 'locked', description }
  }
  const description = (seat && (seat.seatReserveDescReal || seat.seatReserveDesc)) || '不可预约'
  return { selectable: false, state: 'unavailable', description }
}

/**
 * 解析预约的结束时间（本地时区）
 * reserveDateStr 为 yyyy-MM-dd，reserveTimeStr 为 HH:mm-HH:mm
 * @returns {Date|null}
 */
export function parseReserveEndTime(reserve) {
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
 * 是否属于 token 失效错误
 */
export function isTokenInvalidError(error) {
  return !!error && Number(error.code) === TOKEN_INVALID_CODE
}

/**
 * 读取上次选择的预约时段
 */
export function readLastSlot() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null
    }
    const raw = window.localStorage.getItem(LAST_SLOT_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const venueId = toFiniteNumber(parsed.venueId)
    if (venueId === null || parseTimeToMinutes(parsed.startTime) === null || parseTimeToMinutes(parsed.endTime) === null) {
      return null
    }
    return { venueId, startTime: parsed.startTime, endTime: parsed.endTime }
  } catch (e) {
    return null
  }
}

/**
 * 保存上次选择的预约时段
 */
export function writeLastSlot(slot) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false
    }
    if (!slot || typeof slot !== 'object') {
      return false
    }
    const venueId = toFiniteNumber(slot.venueId)
    if (venueId === null || parseTimeToMinutes(slot.startTime) === null || parseTimeToMinutes(slot.endTime) === null) {
      return false
    }
    window.localStorage.setItem(LAST_SLOT_KEY, JSON.stringify({ venueId, startTime: slot.startTime, endTime: slot.endTime }))
    return true
  } catch (e) {
    return false
  }
}

/**
 * 读取上次选择的预约门店
 */
export function readLastVenueId() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null
    }
    const raw = window.localStorage.getItem(LAST_VENUE_KEY)
    return raw ? toFiniteNumber(raw) : null
  } catch (e) {
    return null
  }
}

/**
 * 保存上次选择的预约门店
 */
export function writeLastVenueId(venueId) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false
    }
    const value = toFiniteNumber(venueId)
    if (value === null) {
      window.localStorage.removeItem(LAST_VENUE_KEY)
      return true
    }
    window.localStorage.setItem(LAST_VENUE_KEY, String(value))
    return true
  } catch (e) {
    return false
  }
}

/**
 * 门店名称是否命中隐藏关键词
 */
export function isHiddenVenue(venue) {
  // 不同接口的门店字段不统一：预约接口用 venueName，套餐接口用 name
  const name = typeof venue?.venueName === 'string'
    ? venue.venueName
    : (typeof venue?.name === 'string' ? venue.name : '')
  return HIDDEN_VENUE_KEYWORDS.some(keyword => name.includes(keyword))
}

/**
 * 过滤预约页默认隐藏的门店
 */
export function filterReserveVenues(venueList) {
  return (Array.isArray(venueList) ? venueList : []).filter(venue => !isHiddenVenue(venue))
}

/**
 * 下一个整点（严格晚于当前时间）
 */
export function nextWholeHour(now = new Date()) {
  const base = now instanceof Date ? new Date(now.getTime()) : new Date(now)
  if (Number.isNaN(base.getTime())) {
    return ''
  }
  base.setMinutes(0, 0, 0)
  base.setHours(base.getHours() + 1)
  return `${pad2(base.getHours())}:00`
}

/**
 * 把时段限制在营业时间内，并保证不短于最小时长
 */
export function clampTimeSlot(slot, options = {}) {
  const current = slot && typeof slot === 'object' ? slot : {}
  const openMinutes = parseTimeToMinutes(options.open)
  const closeMinutes = parseTimeToMinutes(options.close)
  const minValue = toFiniteNumber(options.minMinutes)
  const minMinutes = minValue !== null && minValue > 0 ? Math.round(minValue) : 0
  let start = parseTimeToMinutes(current.startTime)
  let end = parseTimeToMinutes(current.endTime)

  if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
    if (start === null) {
      return {
        startTime: typeof current.startTime === 'string' ? current.startTime : '',
        endTime: typeof current.endTime === 'string' ? current.endTime : ''
      }
    }
    if (end === null) {
      end = start + minMinutes
    }
    if (end - start < minMinutes) {
      end = start + minMinutes
    }
    return {
      startTime: minutesToTime(start) || current.startTime || '',
      endTime: minutesToTime(end) || current.endTime || ''
    }
  }

  if (start === null) {
    start = openMinutes
  }
  if (end === null || end < start) {
    end = start + minMinutes
  }
  start = Math.min(Math.max(start, openMinutes), closeMinutes)
  if (end - start < minMinutes) {
    end = start + minMinutes
  }
  if (end > closeMinutes) {
    end = closeMinutes
  }
  if (end - start < minMinutes) {
    start = Math.max(openMinutes, closeMinutes - minMinutes)
    end = closeMinutes
  }
  return {
    startTime: minutesToTime(start) || current.startTime || '',
    endTime: minutesToTime(end) || current.endTime || ''
  }
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

/**
 * 提取时间段中的时钟部分，兼容 'yyyy-MM-dd HH:mm:ss' 与 'HH:mm'
 */
export function clockOf(value) {
  if (typeof value !== 'string') {
    return ''
  }
  const match = value.trim().match(/(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) {
    return ''
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) {
    return ''
  }
  return `${pad2(hour)}:${match[2]}`
}

// 定位结果缓存 5 分钟，避免每次刷新重复授权
const LOCATION_TTL = 5 * 60 * 1000
let locationCache = null
let locationPending = null

/**
 * 获取浏览器定位；不支持、拒绝授权、超时都返回 null，不阻塞业务流程
 */
export function getCurrentLocation(options = {}) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null)
  }
  if (locationCache && Date.now() - locationCache.time < LOCATION_TTL) {
    return Promise.resolve({ lng: locationCache.lng, lat: locationCache.lat })
  }
  if (locationPending) {
    return locationPending
  }
  const pending = new Promise(resolve => {
    try {
      navigator.geolocation.getCurrentPosition(
        position => {
          const lng = toFiniteNumber(position?.coords?.longitude)
          const lat = toFiniteNumber(position?.coords?.latitude)
          if (lng === null || lat === null) {
            resolve(null)
            return
          }
          locationCache = { lng, lat, time: Date.now() }
          resolve({ lng, lat })
        },
        () => resolve(null),
        {
          enableHighAccuracy: false,
          timeout: toFiniteNumber(options.timeout) ?? 3000,
          maximumAge: toFiniteNumber(options.maximumAge) ?? 60000
        }
      )
    } catch (e) {
      resolve(null)
    }
  })
  locationPending = pending
  pending.catch(() => null).then(() => {
    if (locationPending === pending) {
      locationPending = null
    }
  })
  return pending
}
