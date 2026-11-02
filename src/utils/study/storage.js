import { LAST_SLOT_KEY, LAST_VENUE_KEY } from './constants'
import { toFiniteNumber } from './internal'
import { parseTimeToMinutes } from './time'

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
