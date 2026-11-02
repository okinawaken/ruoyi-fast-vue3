import { HIDDEN_VENUE_KEYWORDS } from './constants'
import { pad2, toFiniteNumber } from './internal'
import { minutesToTime, parseTimeToMinutes } from './time'

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
