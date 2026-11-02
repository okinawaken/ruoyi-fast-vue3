/**
 * TTLock / Sciener 门锁蓝牙开锁（Web Bluetooth）对外入口。
 *
 * 协议来源：小程序 wx97ec90d8480be46e 的 myPlugin（wx43d5971c94455481 v3.0.4）。
 * 逆向说明见后端文档 studyroom-guard-ble.md。
 *
 * 浏览器限制：仅 Chromium 系（Chrome / Edge）、HTTPS 或 localhost、必须由用户手势触发，
 * 且电脑需要处于门锁的蓝牙范围内。
 *
 * 安全：ekey（configJsonTwo）属于门锁钥匙，只允许在内存中短暂持有，
 * 禁止写入 localStorage / sessionStorage / 日志。
 */
import { ERR, LOCK_SERVICE_UUID } from './constants'
import { parseLockEkey, getAdjustedServerTime } from './ekey'
import { TTLockSession } from './session'

export function isWebBluetoothSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

export function assertBluetoothReady() {
  if (!isWebBluetoothSupported()) {
    throw new Error('当前浏览器不支持蓝牙开门，请使用 Chrome 或 Edge')
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error('蓝牙开门需要 HTTPS 环境')
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前环境不支持 WebCrypto，无法解析门锁钥匙')
  }
}

/**
 * 弹出浏览器设备选择框。
 * 必须在用户点击手势中同步调用，await 服务端接口之后再调用可能丢失用户激活态。
 */
export async function requestLockDevice() {
  assertBluetoothReady()
  try {
    return await navigator.bluetooth.requestDevice({
      filters: [{ services: [LOCK_SERVICE_UUID] }],
      optionalServices: [LOCK_SERVICE_UUID]
    })
  } catch (e) {
    if (e?.name === 'NotFoundError' || e?.name === 'AbortError') {
      const cancelled = new Error('已取消选择门锁，或附近没有可用的门锁设备')
      cancelled.cancelled = true
      throw cancelled
    }
    throw e
  }
}

/**
 * 连接门锁并开锁。
 *
 * @param {BluetoothDevice} device 浏览器选择的设备
 * @param {string} ekey 后端下发的 configJsonTwo
 * @param {{ onProgress?: (text: string) => void }} [options]
 * @returns {Promise<{ electricQuantity: number, uid: number, uniqueId: number }>}
 */
export async function openLockByBle(device, ekey, options = {}) {
  assertBluetoothReady()
  if (!device?.gatt) {
    throw new Error('未选择门锁设备')
  }
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {}
  const lock = await parseLockEkey(ekey)
  const session = new TTLockSession(device)

  try {
    onProgress('正在连接门锁...')
    await session.connect()

    const serverTime = getAdjustedServerTime(lock)
    let random

    onProgress('正在校验门锁钥匙...')
    try {
      random = await session.authenticate(lock)
    } catch (e) {
      if (e?.code !== ERR.EKEY_EXPIRED && e?.code !== ERR.UNEFFECT_EKEY) {
        throw e
      }
      // 锁时间偏差会把有效钥匙判成过期/未生效：忽略有效期再验一次，校准锁时间后重试。
      onProgress('正在校准门锁时间...')
      await session.authenticate(lock, { ignoreValidity: true, verifyRandom: true })
      await session.correctLockTime(lock, serverTime)
      random = await session.authenticate(lock)
    }

    onProgress('正在开锁...')
    const result = await session.open(lock, random)
    onProgress('开门成功')
    return result
  } finally {
    session.disconnect()
  }
}
