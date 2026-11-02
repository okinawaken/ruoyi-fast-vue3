import {
  CHUNK_SIZE,
  CMD,
  COMMAND_TIMEOUT,
  CONNECT_TIMEOUT,
  ERROR_MESSAGES,
  ERR,
  LIFT_SCENE,
  LOCK_SERVICE_UUID,
  MAX_PAYLOAD_LENGTH,
  READ_CHAR_UUID,
  WRITE_CHAR_UUID
} from './constants'
import {
  aesDecrypt,
  aesEncrypt,
  buildFrame,
  bytesToNumber,
  checkFrameCrc,
  concatBytes,
  crcNumber,
  delay,
  findFrameHeader,
  makeBleError,
  numberToBytes,
  timestampToBytes,
  toUint8Array,
  withGattError,
  withTimeout
} from './bytes'

/**
 * 单次门锁 BLE 会话：连接、鉴权、开锁与断开。
 */
export class TTLockSession {
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
