import { toFiniteNumber } from './internal'

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

/**
 * 获取定位并补齐默认坐标，调用方无需再判断 null
 * @returns {Promise<{ lng: number, lat: number }>}
 */
export async function getCurrentLocationCoords(options = {}) {
  const location = await getCurrentLocation(options)
  return {
    lng: location ? location.lng : 0,
    lat: location ? location.lat : 0
  }
}
