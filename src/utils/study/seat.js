import { SEAT_STATE } from './constants'
import { parseTimeToMinutes } from './time'

/**
 * 座位在指定时段内是否可预约
 */
function isSeatSelectable(seat, startTime, endTime) {
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
