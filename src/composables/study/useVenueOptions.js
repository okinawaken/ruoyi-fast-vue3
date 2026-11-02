import { ref } from 'vue'
import { studyVenueApi } from '@/api/study'
import { filterReserveVenues } from '@/utils/study/format'

async function loadReserveSelect() {
  const res = await studyVenueApi.reserveSelect()
  return res?.data?.venueList || []
}

/**
 * 门店下拉列表：统一加载状态、过滤规则与数据来源。
 *
 * 默认调用 venue/reserve/select；需要其他接口时通过 loader 覆盖。
 *
 * @param {{
 *   filter?: boolean,
 *   loader?: () => Promise<Array>
 * }} options
 */
export function useVenueOptions({ filter = true, loader = loadReserveSelect } = {}) {
  const venues = ref([])
  const loading = ref(false)

  async function load(options = {}) {
    const runLoader = options.loader || loader
    const shouldFilter = options.filter ?? filter
    loading.value = true
    try {
      const list = await runLoader()
      const normalized = Array.isArray(list) ? list : []
      venues.value = shouldFilter ? filterReserveVenues(normalized) : normalized
      return venues.value
    } catch (e) {
      venues.value = []
      throw e
    } finally {
      loading.value = false
    }
  }

  return { venues, loading, load }
}
