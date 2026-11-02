import { TIME_STEP_MINUTES } from './constants'
import { pad2, toFiniteNumber } from './internal'

const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

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

/**
 * 当前时间 HH:mm，用于「更新于」等页面文案
 */
export function currentClockText(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now)
  return minutesToTime(date.getHours() * 60 + date.getMinutes()) || '--:--'
}
