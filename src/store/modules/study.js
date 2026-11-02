import { defineStore } from 'pinia'
import { studyConfigApi, studyTokenApi } from '@/api/study'
import {
  isTokenInvalidError,
  readLastSlot,
  readLastVenueId,
  toBool,
  writeLastSlot,
  writeLastVenueId
} from '@/utils/study/format'

/**
 * 自习室全局状态：小程序 token 绑定状态、全局配置、最近一次预约时段
 */

// 全局配置请求中的 Promise，避免多个页面同时初始化时重复请求
let configPromise = null

const useStudyStore = defineStore('study', {
  state: () => ({
    // 绑定状态是否请求完成
    statusLoaded: false,
    // 绑定状态是否请求中
    statusLoading: false,
    // 绑定状态请求失败信息
    statusError: '',
    // 是否已绑定小程序 token
    boundFlag: false,
    // token 是否仍有效（首次绑定视为有效，收到 40102 后置为失效）
    validFlag: false,
    // 小程序全局配置
    config: null,
    // 绑定/解绑成功后自增，页面监听后重新加载
    refreshKey: 0,
    // 绑定弹窗显隐
    bindModalVisible: false,
    // 最近一次预约时段
    lastSlot: readLastSlot(),
    // 最近一次选择的预约门店
    lastVenueId: readLastVenueId()
  }),

  getters: {
    isBound: state => state.boundFlag,
    isTokenValid: state => state.boundFlag && state.validFlag,
    showExpiredBanner: state => state.boundFlag && !state.validFlag && state.statusLoaded,
    isReady: state => state.statusLoaded && state.boundFlag && state.validFlag
  },

  actions: {
    /**
     * 确保绑定状态已加载（并发时只请求一次）
     */
    async ensureStatus() {
      if (this.statusLoaded || this.statusLoading) {
        return
      }
      await this.fetchStatus()
    },

    /**
     * 请求绑定状态；失败不抛出，仅记录 statusError
     */
    async fetchStatus() {
      if (this.statusLoading) {
        return
      }
      this.statusLoading = true
      this.statusError = ''
      try {
        const res = await studyTokenApi.detail()
        const data = res?.data || {}
        this.boundFlag = toBool(data.bound)
        this.validFlag = this.boundFlag
        this.statusLoaded = true
        if (this.boundFlag) {
          await this.fetchConfig()
        }
      } catch (e) {
        this.statusError = e?.msg || e?.message || '加载绑定状态失败'
        this.statusLoaded = true
      } finally {
        this.statusLoading = false
      }
    },

    /**
     * 请求全局配置；已存在则复用，请求中则复用同一个 Promise，失败静默
     */
    async fetchConfig(force = false) {
      if (this.config && !force) {
        return this.config
      }
      if (!force && configPromise) {
        return configPromise
      }
      const promise = (async () => {
        try {
          const res = await studyConfigApi.sys()
          this.config = res?.data || null
        } catch (e) {
          this.config = null
        }
        return this.config
      })()
      configPromise = promise
      try {
        return await promise
      } finally {
        if (configPromise === promise) {
          configPromise = null
        }
      }
    },

    /**
     * 绑定小程序 token
     */
    async bindToken(token) {
      const res = await studyTokenApi.bind(token)
      this.boundFlag = true
      this.validFlag = true
      this.statusLoaded = true
      this.statusError = ''
      this.refreshKey += 1
      await this.fetchConfig(true)
      return res
    },

    /**
     * 解绑小程序 token
     */
    async unbindToken() {
      const res = await studyTokenApi.unbind()
      this.boundFlag = false
      this.validFlag = false
      this.refreshKey += 1
      return res
    },

    /**
     * 标记 token 已失效（不改变绑定关系）
     */
    markTokenExpired() {
      this.validFlag = false
    },

    /**
     * 统一处理接口错误；token 失效时标记状态，并按需打开重新绑定弹窗
     * @param {Error} error
     * @param {{ openBind?: boolean }} options
     * @returns {boolean} 是否属于 token 失效
     */
    handleApiError(error, { openBind = false } = {}) {
      if (isTokenInvalidError(error)) {
        this.markTokenExpired()
        if (openBind) {
          this.openBindModal()
        }
        return true
      }
      return false
    },

    openBindModal() {
      this.bindModalVisible = true
    },

    /**
     * 校验 token 是否有效；无效时打开重新绑定弹窗
     * @returns {boolean} token 是否有效
     */
    requireToken() {
      if (this.isTokenValid) {
        return true
      }
      this.openBindModal()
      return false
    },

    closeBindModal() {
      this.bindModalVisible = false
    },

    rememberSlot(slot) {
      writeLastSlot(slot)
      this.lastSlot = slot
        ? { venueId: slot.venueId, startTime: slot.startTime, endTime: slot.endTime }
        : null
    },

    rememberVenue(venueId) {
      writeLastVenueId(venueId)
      const value = venueId === null || venueId === undefined || venueId === '' ? NaN : Number(venueId)
      this.lastVenueId = Number.isFinite(value) ? value : null
    }
  }
})

export default useStudyStore
