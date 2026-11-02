import { watch } from 'vue'
import useStudyStore from '@/store/modules/study'

/**
 * 监听自习室小程序 token 状态，token 有效时按 refreshKey 去重触发刷新。
 *
 * - 首次进入页面（token 已有效）或重新绑定 token 后调用 onRefresh
 * - token 失效时重置去重标记，并按需执行 onInvalid
 *
 * @param {Function} onRefresh
 * @param {{ immediate?: boolean, onInvalid?: Function }} options
 * @returns {ReturnType<typeof useStudyStore>} 自习室 store，便于页面直接使用
 */
export function useStudyRefresh(onRefresh, { immediate = true, onInvalid } = {}) {
  const store = useStudyStore()
  let lastRefreshKey = ''

  watch(
    () => [store.isTokenValid, store.refreshKey],
    ([valid]) => {
      if (!valid) {
        lastRefreshKey = ''
        if (onInvalid) {
          onInvalid()
        }
        return
      }
      const key = String(store.refreshKey)
      if (key === lastRefreshKey) {
        return
      }
      lastRefreshKey = key
      onRefresh()
    },
    { immediate }
  )

  return store
}
