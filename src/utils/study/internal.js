/**
 * 自习室工具模块内部共享的小工具，不对外导出。
 */

export function pad2(value) {
  return String(value).padStart(2, '0')
}

export function toFiniteNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}
