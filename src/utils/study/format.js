/**
 * 自习室工具兼容入口。
 *
 * 新代码请直接从对应职责模块导入：
 * - ./time      时间、日期与时段
 * - ./seat      座位可约状态
 * - ./reserve   预约规则与结束判断
 * - ./venue     门店营业时间、过滤
 * - ./storage   最近预约时段/门店缓存
 * - ./location  浏览器定位
 * - ./value     通用值转换与格式化
 *
 * 保留此文件是为了兼容已有 import，后续可逐步移除。
 */

export {
  parseApiDate,
  parseTimeToMinutes,
  minutesToTime,
  formatDurationText,
  buildTimeOptions,
  nextWholeHour,
  clampTimeSlot,
  clockOf,
  currentClockText
} from './time'

export { getSeatDisplayState } from './seat'

export { isEndedReserve, formatReserveRules } from './reserve'

export { parseVenueOpenClose, isHiddenVenue, filterReserveVenues } from './venue'

export { readLastSlot, writeLastSlot, readLastVenueId, writeLastVenueId } from './storage'

export { getCurrentLocation, getCurrentLocationCoords } from './location'

export { toBool, maskMobile, formatMoney, formatTimestamp, isTokenInvalidError } from './value'
