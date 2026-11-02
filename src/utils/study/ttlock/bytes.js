import { CRC8_TABLE } from './constants'

/**
 * 计算 TTLock 帧的 CRC8。
 */
function computeCrc(bytes) {
  let crc = 0
  for (const byte of bytes) {
    crc = CRC8_TABLE[255 & (crc ^ byte)]
  }
  return 255 & crc
}

/**
 * 构造门锁指令帧。
 */
export function buildFrame(lock, command, encryptedPayload) {
  const version = lock.lockVersion || {}
  const protocolType = Number(version.protocolType) || 5
  const protocolVersion = Number(version.protocolVersion) || 3
  const scene = Number(version.scene) || 0
  const groupId = Number.isFinite(Number(version.groupId)) ? Number(version.groupId) : 1
  const orgId = Number.isFinite(Number(version.orgId)) ? Number(version.orgId) : 1

  const frame = [
    0x7f,
    0x5a,
    protocolType,
    protocolVersion,
    scene,
    (groupId >> 8) & 0xff,
    groupId & 0xff,
    (orgId >> 8) & 0xff,
    orgId & 0xff,
    command,
    0xaa,
    encryptedPayload.length
  ]

  for (const byte of encryptedPayload) {
    frame.push(byte)
  }

  frame.push(computeCrc(frame), 0x13, 0x10)
  return Uint8Array.from(frame)
}

/**
 * 校验门锁响应帧的 CRC。
 */
export function checkFrameCrc(frame) {
  if (frame.length < 2) {
    return false
  }
  // 帧尾是 CRC + 0x13 + 0x10，CRC 位于倒数第 3 字节
  const body = frame.subarray(0, frame.length - 2)
  return computeCrc(body.subarray(0, body.length - 1)) === body[body.length - 1]
}

/**
 * 查找帧头 0x7f 0x5a。
 */
export function findFrameHeader(bytes) {
  for (let i = 0; i < bytes.length - 1; i += 1) {
    if (bytes[i] === 0x7f && bytes[i + 1] === 0x5a) {
      return i
    }
  }
  return -1
}

/**
 * TTLock 的 CRC 混淆：Base64 -> ASCII 十进制串 -> 用末字节作 key 解码。
 */
function decodeCrc(encoded) {
  const bytes = base64ToBytes(encoded)
  const values = bytesToAscii(bytes)
    .split(',')
    .map(item => parseInt(item, 10))
  if (values.length < 2 || values.some(item => !Number.isFinite(item))) {
    throw new Error('CRC 数据格式错误')
  }
  const length = values.length - 1
  const key = values[length]
  const table = CRC8_TABLE[length % 256]
  const out = new Uint8Array(length)
  for (let i = 0; i < length; i += 1) {
    out[i] = (values[i] ^ key) ^ table
  }
  return bytesToAscii(out)
}

/**
 * 解析 ekey 字段中的 CRC 编码数字。
 */
export function crcNumber(encoded, label) {
  const value = parseInt(decodeCrc(encoded), 10)
  if (!Number.isFinite(value)) {
    throw new Error(`${label}格式错误`)
  }
  return value
}

export function numberToBytes(value, size) {
  let remaining = Math.trunc(Number(value))
  if (!Number.isFinite(remaining)) {
    remaining = 0
  }
  if (remaining < 0) {
    remaining += Math.pow(2, size * 8)
  }
  const out = new Uint8Array(size)
  for (let i = size - 1; i >= 0; i -= 1) {
    out[i] = remaining & 0xff
    remaining = Math.floor(remaining / 256)
  }
  return out
}

export function bytesToNumber(bytes) {
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex ? parseInt(hex, 16) : 0
}

export function timestampToBytes(value, withSeconds = false) {
  const date = new Date(value)
  const out = [
    date.getFullYear() - 2000,
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes()
  ]
  if (withSeconds) {
    out.push(date.getSeconds())
  }
  return Uint8Array.from(out)
}

export function concatBytes(...parts) {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const out = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function pkcs7Pad(data, blockSize = 16) {
  const padding = blockSize - (data.length % blockSize)
  const out = new Uint8Array(data.length + padding)
  out.set(data)
  out.fill(padding, data.length)
  return out
}

function pkcs7Unpad(data) {
  if (!data.length) {
    return data
  }
  const padding = data[data.length - 1]
  if (padding < 1 || padding > 16 || data.length < padding) {
    return data
  }
  for (let i = data.length - padding; i < data.length; i += 1) {
    if (data[i] !== padding) {
      return data
    }
  }
  return data.slice(0, data.length - padding)
}

export async function aesEncrypt(data, key, iv) {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  )
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    pkcs7Pad(data)
  )
  return new Uint8Array(encrypted)
}

export async function aesDecrypt(data, key, iv) {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  )
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    data
  )
  return pkcs7Unpad(new Uint8Array(decrypted))
}

export function base64ToBytes(value) {
  let normalized = String(value)
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const remainder = normalized.length % 4
  if (remainder) {
    normalized += '='.repeat(4 - remainder)
  }
  const binary = atob(normalized)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

export function bytesToUtf8(bytes) {
  return new TextDecoder('utf-8').decode(bytes)
}

function bytesToAscii(bytes) {
  let out = ''
  for (const byte of bytes) {
    out += String.fromCharCode(byte)
  }
  return out
}

export function asciiBytes(value) {
  const out = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i += 1) {
    out[i] = value.charCodeAt(i) & 0xff
  }
  return out
}

export function bytesToMacString(bytes) {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase()
}

export function toUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value
  }
  if (value instanceof DataView) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }
  return Uint8Array.from(value || [])
}

export function makeBleError(message, code) {
  const error = new Error(message)
  error.code = code
  return error
}

const GATT_ERROR_NAMES = new Set([
  'NotFoundError',
  'NetworkError',
  'NotSupportedError',
  'SecurityError',
  'InvalidStateError',
  'AbortError'
])

export function withGattError(promise, timeout, message, code) {
  return withTimeout(promise, timeout, message, code).catch(error => {
    if (error?.code) {
      throw error
    }
    if (error && GATT_ERROR_NAMES.has(error.name)) {
      throw makeBleError(message, code)
    }
    throw error
  })
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function withTimeout(promise, timeout, message, code) {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      reject(makeBleError(message, code))
    }, timeout)

    Promise.resolve(promise).then(
      value => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}
