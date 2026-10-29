/**
 * TTLock / Sciener 门锁蓝牙开锁（Web Bluetooth）
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

const LOCK_SERVICE_UUID = '00001910-0000-1000-8000-00805f9b34fb'
const WRITE_CHAR_UUID = '0000fff2-0000-1000-8000-00805f9b34fb'
const READ_CHAR_UUID = '0000fff4-0000-1000-8000-00805f9b34fb'

const CMD = Object.freeze({
  CHECK_ADMIN: 0x41,
  CHECK_USERTIME: 0x55,
  CHECK_RANDOM: 0x30,
  CORRECT_LOCK_TIME: 0x43,
  UNLOCK: 0x47
})

const ERR = Object.freeze({
  OK: 0,
  CRC_CHECK_ERROR: 1,
  NOT_ADMIN_ERROR: 2,
  CHECK_ADMIN_FAILED: 3,
  LOCK_IN_SETTING_MODE_ERROR: 5,
  NO_ADMIN_ERROR: 6,
  LOW_BATTERY: 10,
  EKEY_EXPIRED: 14,
  UNEFFECT_EKEY: 17,
  NOT_LOGIN: 18,
  LOCK_FROZEN: 28,
  DOOR_LOCKED: 30,
  LOCK_OPERATING: 36,
  BT_CONNECT_TIMEOUT: 10002,
  BT_DISCONNECT: 10003,
  BT_WRITE_DATA_ERROR: 10004,
  DATA_PARSE_ERROR: 10006
})

const ERROR_MESSAGES = {
  [ERR.CRC_CHECK_ERROR]: '门锁通信校验失败，请重试',
  [ERR.NOT_ADMIN_ERROR]: '当前钥匙不是管理员权限',
  [ERR.CHECK_ADMIN_FAILED]: '管理员校验未通过',
  [ERR.LOCK_IN_SETTING_MODE_ERROR]: '门锁处于设置模式',
  [ERR.NO_ADMIN_ERROR]: '门锁未初始化',
  [ERR.LOW_BATTERY]: '门锁电量低',
  [ERR.EKEY_EXPIRED]: '门锁钥匙已过期',
  [ERR.UNEFFECT_EKEY]: '门锁钥匙未生效',
  [ERR.NOT_LOGIN]: '用户验证未通过',
  [ERR.LOCK_FROZEN]: '门锁钥匙已冻结',
  [ERR.DOOR_LOCKED]: '门已反锁',
  [ERR.LOCK_OPERATING]: '门锁正在操作中，请稍后重试',
  [ERR.BT_CONNECT_TIMEOUT]: '蓝牙连接超时，请靠近门锁后重试',
  [ERR.BT_DISCONNECT]: '蓝牙连接已断开',
  [ERR.BT_WRITE_DATA_ERROR]: '蓝牙写入失败',
  [ERR.DATA_PARSE_ERROR]: '门锁响应解析失败'
}

const CHUNK_SIZE = 20
const CONNECT_TIMEOUT = 10000
const COMMAND_TIMEOUT = 10000
const MAX_PAYLOAD_LENGTH = 255
const LIFT_SCENE = 12

/** TTLock 使用的 CRC8 查表 */
const CRC8_TABLE = [
  0, 94, 188, 226, 97, 63, 221, 131, 194, 156, 126, 32, 163, 253, 31, 65,
  157, 195, 33, 127, 252, 162, 64, 30, 95, 1, 227, 189, 62, 96, 130, 220,
  35, 7, 159, 193, 66, 28, 254, 160, 225, 191, 93, 3, 128, 222, 60, 98,
  190, 224, 2, 92, 223, 129, 99, 61, 124, 34, 192, 158, 29, 67, 161, 255,
  70, 24, 250, 164, 39, 121, 155, 197, 132, 218, 56, 102, 229, 187, 89, 7,
  219, 133, 103, 57, 186, 228, 6, 88, 25, 71, 165, 251, 120, 38, 196, 154,
  101, 59, 217, 135, 4, 90, 184, 230, 167, 249, 27, 69, 198, 152, 122, 36,
  248, 166, 68, 26, 153, 199, 37, 123, 58, 100, 134, 216, 91, 5, 231, 185,
  140, 210, 48, 110, 237, 179, 81, 15, 78, 16, 242, 172, 47, 113, 147, 205,
  17, 79, 173, 243, 112, 46, 204, 146, 211, 141, 111, 49, 178, 236, 14, 80,
  175, 241, 19, 77, 206, 144, 114, 44, 109, 51, 209, 143, 12, 82, 176, 238,
  50, 108, 142, 208, 83, 13, 239, 177, 240, 174, 76, 18, 145, 207, 45, 115,
  202, 148, 118, 40, 171, 245, 23, 73, 8, 86, 180, 234, 105, 55, 213, 139,
  87, 9, 235, 181, 54, 104, 138, 212, 149, 203, 41, 119, 244, 170, 72, 22,
  233, 183, 85, 11, 136, 214, 52, 106, 43, 117, 151, 201, 74, 20, 246, 168,
  116, 42, 200, 150, 21, 75, 169, 247, 182, 232, 10, 84, 215, 137, 107, 53
]

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

/* ------------------------------------------------------------------ */
/* ekey 解析                                                           */
/* ------------------------------------------------------------------ */

async function parseLockEkey(ekey) {
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

function getAdjustedServerTime(lock) {
  const adjust = (Number(lock.timezoneRawOffset) || 0) + 60000 * new Date().getTimezoneOffset()
  const value = Date.now() + adjust
  const min = new Date(2000, 0, 1, 0, 0, 0).getTime()
  const max = new Date(2099, 11, 31, 23, 59, 0).getTime()
  if (value < min || value > max) {
    throw new Error('本机时间异常，无法校准门锁时间')
  }
  return value
}

/* ------------------------------------------------------------------ */
/* BLE 会话                                                            */
/* ------------------------------------------------------------------ */

class TTLockSession {
  constructor(device) {
    this.device = device
    this.writeChar = null
    this.readChar = null
    this.buffer = []
    this.expectedLength = 0
    this.pending = null
    this.onNotificationBound = null
    this.onDisconnectBound = null
  }

  async connect() {
    if (!this.device?.gatt) {
      throw makeBleError('当前设备不支持 GATT', ERR.BT_CONNECT_TIMEOUT)
    }

    if (!this.device.gatt.connected) {
      await withGattError(
        this.device.gatt.connect(),
        CONNECT_TIMEOUT,
        '无法连接门锁，请确认门锁在附近且蓝牙已开启',
        ERR.BT_CONNECT_TIMEOUT
      )
    }

    const service = await withGattError(
      this.device.gatt.getPrimaryService(LOCK_SERVICE_UUID),
      CONNECT_TIMEOUT,
      '未找到门锁蓝牙服务，请确认选择的设备是否正确',
      ERR.BT_CONNECT_TIMEOUT
    )

    this.writeChar = await withGattError(
      service.getCharacteristic(WRITE_CHAR_UUID),
      CONNECT_TIMEOUT,
      '未找到门锁写入特征',
      ERR.BT_CONNECT_TIMEOUT
    )
    this.readChar = await withGattError(
      service.getCharacteristic(READ_CHAR_UUID),
      CONNECT_TIMEOUT,
      '未找到门锁通知特征',
      ERR.BT_CONNECT_TIMEOUT
    )

    if (!this.writeChar.properties.write && !this.writeChar.properties.writeWithoutResponse) {
      throw makeBleError('门锁写入特征不支持写入', ERR.BT_WRITE_DATA_ERROR)
    }

    this.onNotificationBound = event => this.onNotification(event)
    this.readChar.addEventListener('characteristicvaluechanged', this.onNotificationBound)

    await withGattError(
      this.readChar.startNotifications(),
      CONNECT_TIMEOUT,
      '开启门锁通知失败',
      ERR.BT_CONNECT_TIMEOUT
    )

    this.onDisconnectBound = () => {
      this.failPending(makeBleError('蓝牙连接已断开', ERR.BT_DISCONNECT))
    }
    this.device.addEventListener('gattserverdisconnected', this.onDisconnectBound)
  }

  disconnect() {
    this.failPending(makeBleError('蓝牙操作已结束', ERR.BT_DISCONNECT))

    if (this.readChar && this.onNotificationBound) {
      try {
        this.readChar.removeEventListener('characteristicvaluechanged', this.onNotificationBound)
      } catch {
        /* ignore */
      }
      try {
        Promise.resolve(this.readChar.stopNotifications()).catch(() => {})
      } catch {
        /* ignore */
      }
    }

    if (this.device && this.onDisconnectBound) {
      try {
        this.device.removeEventListener('gattserverdisconnected', this.onDisconnectBound)
      } catch {
        /* ignore */
      }
    }

    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect()
      }
    } catch {
      /* ignore */
    }

    this.writeChar = null
    this.readChar = null
    this.buffer = []
    this.expectedLength = 0
  }

  async authenticate(lock, { ignoreValidity = false, verifyRandom = false } = {}) {
    const random = await this.checkIdentity(lock, ignoreValidity)
    if (verifyRandom) {
      await this.checkRandom(lock, random)
    }
    return random
  }

  async checkIdentity(lock, ignoreValidity) {
    if (lock.adminPwd) {
      const payload = concatBytes(
        numberToBytes(crcNumber(lock.adminPwd, '管理员密码'), 4),
        numberToBytes(lock.lockFlagPos || 0, 3),
        numberToBytes(lock.uid || 0, 4)
      )
      const response = await this.sendCommand(lock, CMD.CHECK_ADMIN, payload)
      return bytesToNumber(response.slice(2))
    }

    const min = new Date(2000, 0, 1, 0, 0, 0).getTime()
    const max = new Date(2099, 11, 31, 23, 59, 0).getTime()
    const start = ignoreValidity ? min : lock.formatStartDate
    const end = ignoreValidity ? max : lock.formatEndDate
    const payload = concatBytes(
      timestampToBytes(start, false),
      timestampToBytes(end, false),
      numberToBytes(lock.lockFlagPos || 0, 3),
      numberToBytes(lock.uid || 0, 4)
    )
    const response = await this.sendCommand(lock, CMD.CHECK_USERTIME, payload)
    return bytesToNumber(response.slice(2))
  }

  async checkRandom(lock, random) {
    const payload = numberToBytes(crcNumber(lock.lockKey, '开锁密钥') + random, 4)
    await this.sendCommand(lock, CMD.CHECK_RANDOM, payload)
  }

  async correctLockTime(lock, serverTime) {
    await this.sendCommand(lock, CMD.CORRECT_LOCK_TIME, timestampToBytes(serverTime, true))
  }

  async open(lock, random) {
    const scene = Number(lock.lockVersion?.scene) || 0
    if (scene === LIFT_SCENE) {
      throw new Error('暂不支持电梯门锁的楼层控制')
    }

    const now = Date.now()
    const payload = concatBytes(
      numberToBytes(crcNumber(lock.lockKey, '开锁密钥') + random, 4),
      numberToBytes(Math.floor(now / 1000), 4),
      timestampToBytes(now, true)
    )

    const response = await this.sendCommand(lock, CMD.UNLOCK, payload)
    return {
      electricQuantity: response[2],
      uid: bytesToNumber(response.slice(3, 7)),
      uniqueId: bytesToNumber(response.slice(7, 11))
    }
  }

  async sendCommand(lock, command, payload) {
    if (payload.length > MAX_PAYLOAD_LENGTH) {
      throw makeBleError('门锁指令过长', ERR.DATA_PARSE_ERROR)
    }

    const encrypted = await aesEncrypt(payload, lock.aesKeyBytes, lock.aesKeyBytes)
    if (encrypted.length > MAX_PAYLOAD_LENGTH) {
      throw makeBleError('门锁指令过长', ERR.DATA_PARSE_ERROR)
    }

    const frame = buildFrame(lock, command, encrypted)
    const responsePromise = this.expectResponse()

    try {
      await this.writeFrame(frame)
    } catch (e) {
      this.failPending(e)
      // 消费掉被拒绝的响应 Promise，避免 unhandled rejection
      await responsePromise.catch(() => {})
      throw e
    }

    const responseFrame = await responsePromise
    const responsePayload = responseFrame.slice(12, responseFrame.length - 3)
    const decrypted = await aesDecrypt(responsePayload, lock.aesKeyBytes, lock.aesKeyBytes)
    this.assertResponse(decrypted, command)
    return decrypted
  }

  async writeFrame(frame) {
    const useWithResponse = !!this.writeChar.properties.write
    for (let offset = 0; offset < frame.length; offset += CHUNK_SIZE) {
      const chunk = frame.slice(offset, offset + CHUNK_SIZE)
      const writePromise = useWithResponse
        ? this.writeChar.writeValue(chunk)
        : this.writeChar.writeValueWithoutResponse(chunk)
      try {
        await withTimeout(
          writePromise,
          COMMAND_TIMEOUT,
          '蓝牙写入超时',
          ERR.BT_WRITE_DATA_ERROR
        )
      } catch (e) {
        if (e?.code) {
          throw e
        }
        throw makeBleError('蓝牙写入失败，请重试', ERR.BT_WRITE_DATA_ERROR)
      }
      if (!useWithResponse) {
        // 无响应写入没有流控，留一点时间给门锁处理
        await delay(15)
      }
    }
  }

  expectResponse(timeout = COMMAND_TIMEOUT) {
    this.failPending(makeBleError('上一次门锁操作已取消', ERR.BT_DISCONNECT))
    this.buffer = []
    this.expectedLength = 0

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.timer !== timer) {
          return
        }
        this.pending = null
        reject(makeBleError('等待门锁响应超时', ERR.BT_DISCONNECT))
      }, timeout)
      this.pending = { resolve, reject, timer }
    })
  }

  failPending(error) {
    const pending = this.pending
    if (!pending) {
      return
    }
    this.pending = null
    clearTimeout(pending.timer)
    pending.reject(error)
  }

  onNotification(event) {
    if (!this.pending) {
      return
    }

    let bytes = toUint8Array(event.target.value)

    if (this.buffer.length === 0) {
      const headerIndex = findFrameHeader(bytes)
      if (headerIndex < 0) {
        return
      }
      if (headerIndex > 0) {
        bytes = bytes.slice(headerIndex)
      }
    }

    for (const byte of bytes) {
      this.buffer.push(byte)
    }

    if (!this.expectedLength && this.buffer.length >= 12) {
      this.expectedLength = this.buffer[11] + 15
    }

    if (!this.expectedLength || this.buffer.length < this.expectedLength) {
      return
    }

    const frame = Uint8Array.from(this.buffer.slice(0, this.expectedLength))
    this.buffer = []
    this.expectedLength = 0

    const pending = this.pending
    this.pending = null
    clearTimeout(pending.timer)

    if (!checkFrameCrc(frame)) {
      pending.reject(makeBleError('门锁响应校验失败', ERR.CRC_CHECK_ERROR))
      return
    }
    pending.resolve(frame)
  }

  assertResponse(decrypted, command) {
    if (!decrypted || decrypted.length === 0) {
      throw makeBleError('门锁响应为空', ERR.DATA_PARSE_ERROR)
    }
    if (decrypted[0] !== command) {
      throw makeBleError('门锁响应指令不匹配', ERR.DATA_PARSE_ERROR)
    }
    if (decrypted[1] === 1) {
      return
    }
    const code = decrypted[2] || 99999
    throw makeBleError(ERROR_MESSAGES[code] || `门锁返回错误（${code}）`, code)
  }
}

/* ------------------------------------------------------------------ */
/* 协议工具                                                            */
/* ------------------------------------------------------------------ */

function buildFrame(lock, command, encryptedPayload) {
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

function checkFrameCrc(frame) {
  if (frame.length < 2) {
    return false
  }
  // 帧尾是 CRC + 0x13 + 0x10，CRC 位于倒数第 3 字节
  const body = frame.subarray(0, frame.length - 2)
  return computeCrc(body.subarray(0, body.length - 1)) === body[body.length - 1]
}

function computeCrc(bytes) {
  let crc = 0
  for (const byte of bytes) {
    crc = CRC8_TABLE[255 & (crc ^ byte)]
  }
  return 255 & crc
}

function findFrameHeader(bytes) {
  for (let i = 0; i < bytes.length - 1; i += 1) {
    if (bytes[i] === 0x7f && bytes[i + 1] === 0x5a) {
      return i
    }
  }
  return -1
}

function crcNumber(encoded, label) {
  const value = parseInt(decodeCrc(encoded), 10)
  if (!Number.isFinite(value)) {
    throw new Error(`${label}格式错误`)
  }
  return value
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

function numberToBytes(value, size) {
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

function bytesToNumber(bytes) {
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex ? parseInt(hex, 16) : 0
}

function timestampToBytes(value, withSeconds = false) {
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

function concatBytes(...parts) {
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

async function aesEncrypt(data, key, iv) {
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

async function aesDecrypt(data, key, iv) {
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

function base64ToBytes(value) {
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

function bytesToUtf8(bytes) {
  return new TextDecoder('utf-8').decode(bytes)
}

function bytesToAscii(bytes) {
  let out = ''
  for (const byte of bytes) {
    out += String.fromCharCode(byte)
  }
  return out
}

function asciiBytes(value) {
  const out = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i += 1) {
    out[i] = value.charCodeAt(i) & 0xff
  }
  return out
}

function bytesToMacString(bytes) {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase()
}

function toUint8Array(value) {
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

function makeBleError(message, code) {
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

function withGattError(promise, timeout, message, code) {
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function withTimeout(promise, timeout, message, code) {
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
