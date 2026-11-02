import {
  aesDecrypt,
  asciiBytes,
  base64ToBytes,
  bytesToMacString,
  bytesToUtf8
} from './bytes'

/**
 * 解析后端下发的门锁钥匙（configJsonTwo）。
 */
export async function parseLockEkey(ekey) {
  if (typeof ekey !== 'string' || !ekey.trim()) {
    throw new Error('后台未下发门锁钥匙')
  }

  let raw
  try {
    raw = base64ToBytes(ekey.trim())
  } catch {
    throw new Error('门锁钥匙格式错误')
  }
  if (raw.length <= 6) {
    throw new Error('门锁钥匙格式错误')
  }

  // ekey = AES 密文 + 6 字节锁 MAC；密钥由锁 MAC 去掉第 10 个字符后得到
  const macString = bytesToMacString(raw.slice(-6))
  const key = asciiBytes(macString.slice(0, 9) + macString.slice(10))
  if (key.length !== 16) {
    throw new Error('门锁钥匙格式错误')
  }

  let lock
  try {
    const plain = await aesDecrypt(raw.slice(0, raw.length - 6), key, key)
    lock = JSON.parse(bytesToUtf8(plain))
  } catch {
    throw new Error('门锁钥匙解析失败')
  }
  if (!lock || typeof lock !== 'object') {
    throw new Error('门锁钥匙解析失败')
  }

  const version = lock.lockVersion || {}
  if (Number(version.protocolType) !== 5 || Number(version.protocolVersion) !== 3) {
    throw new Error('当前门锁协议不受支持（仅支持 TTLock V3）')
  }

  const adjust = (Number(lock.timezoneRawOffset) || 0) + 60000 * new Date().getTimezoneOffset()
  const min = new Date(2000, 0, 1, 0, 0, 0).getTime()
  const max = new Date(2099, 11, 31, 23, 59, 0).getTime()
  const clamp = value => Math.min(max, Math.max(min, value))

  const start = clamp(
    Number.isFinite(lock.startDate) && lock.startDate !== 0
      ? lock.startDate + adjust
      : min
  )

  let end = max
  if (Number.isFinite(lock.endDate)) {
    if (lock.endDate === 1) {
      end = start + 60 * 60 * 1000
    } else if (lock.endDate !== 0) {
      end = lock.endDate + adjust
    }
  }
  end = clamp(end)

  if (start > end) {
    throw new Error('门锁钥匙有效期错误')
  }
  const now = Date.now()
  if (now < start) {
    throw new Error('门锁钥匙未生效')
  }
  if (now > end) {
    throw new Error('门锁钥匙已过期')
  }

  lock.formatStartDate = start
  lock.formatEndDate = end
  lock.aesKeyBytes = parseAesKey(lock.aesKeyStr)
  return lock
}

function parseAesKey(aesKeyStr) {
  if (typeof aesKeyStr !== 'string' || !aesKeyStr) {
    throw new Error('门锁钥匙缺少加密密钥')
  }
  const bytes = aesKeyStr.split(',').map(item => parseInt(item, 16))
  if (bytes.length !== 16 || bytes.some(item => !Number.isFinite(item))) {
    throw new Error('门锁加密密钥格式错误')
  }
  return Uint8Array.from(bytes)
}

/**
 * 按门锁时区计算用于校准的服务器时间。
 */
export function getAdjustedServerTime(lock) {
  const adjust = (Number(lock.timezoneRawOffset) || 0) + 60000 * new Date().getTimezoneOffset()
  const value = Date.now() + adjust
  const min = new Date(2000, 0, 1, 0, 0, 0).getTime()
  const max = new Date(2099, 11, 31, 23, 59, 0).getTime()
  if (value < min || value > max) {
    throw new Error('本机时间异常，无法校准门锁时间')
  }
  return value
}
