import { computed, onBeforeUnmount, ref } from 'vue'
import { studyReserveApi } from '@/api/study/reserve'
import useStudyStore from '@/store/modules/study'
import { currentClockText } from '@/utils/study/time'
import { getSeatDisplayState } from '@/utils/study/seat'
import { RESERVE_ANOTHER_FLAG } from '@/utils/study/constants'
import { useLatestRequest } from './useLatestRequest'

/**
 * 预约页座位图状态：加载、选中校验、刷新防抖与座位保留时长。
 *
 * @param {{
 *   venueId: import('vue').Ref<number|null>,
 *   dateValue: import('vue').Ref<string>,
 *   startTime: import('vue').Ref<string>,
 *   endTime: import('vue').Ref<string>,
 *   ineligible: import('vue').ComputedRef<boolean>
 * }} options
 */
export function useReserveSeatMap({ venueId, dateValue, startTime, endTime, ineligible }) {
  const store = useStudyStore()

  const seatMap = ref(null)
  const selectedSeat = ref(null)
  const updatedAt = ref('')
  const seatLoading = ref(false)
  const seatError = ref('')

  const seatRequest = useLatestRequest()
  let seatReloadTimer = null

  const seatAreas = computed(() => seatMap.value?.venueAreaList || [])

  const holdMinutes = computed(() => {
    const value = Number(seatMap.value?.reserveHoldMinutes ?? store.config?.reserveHoldMinutes)
    return Number.isFinite(value) && value > 0 ? value : null
  })

  async function loadSeatMap() {
    if (!store.isTokenValid || ineligible.value) {
      return
    }
    if (!venueId.value || !dateValue.value || !startTime.value || !endTime.value) {
      return
    }

    const seq = seatRequest.next()
    seatLoading.value = true
    seatError.value = ''

    try {
      const res = await studyReserveApi.seatList({
        venueId: venueId.value,
        reserveDateStr: dateValue.value,
        reserveStartTimeStr: startTime.value,
        reserveEndTimeStr: endTime.value,
        reserveAnotherFlag: RESERVE_ANOTHER_FLAG
      })
      if (!seatRequest.isLatest(seq)) {
        return
      }
      seatMap.value = res?.data || null
      updatedAt.value = currentClockText()
      validateSelectedSeat()
    } catch (e) {
      if (!seatRequest.isLatest(seq)) {
        return
      }
      seatMap.value = null
      seatError.value = e?.msg || '座位图加载失败，请稍后重试。'
      if (store.handleApiError(e, { openBind: true })) {
        return
      }
    } finally {
      if (seatRequest.isLatest(seq)) {
        seatLoading.value = false
      }
    }
  }

  function findSeatById(seatId) {
    const areas = seatMap.value?.venueAreaList || []
    for (let i = 0; i < areas.length; i += 1) {
      const seats = areas[i].venueAreaSeatList || []
      const matched = seats.find(seat => String(seat.id) === String(seatId))
      if (matched) {
        return matched
      }
    }
    return null
  }

  function validateSelectedSeat() {
    if (!selectedSeat.value) {
      return
    }
    const seat = findSeatById(selectedSeat.value.id)
    if (!seat || !getSeatDisplayState(seat, startTime.value, endTime.value).selectable) {
      selectedSeat.value = null
    }
  }

  function onSelectSeat(payload) {
    if (!store.isTokenValid) {
      store.openBindModal()
      return
    }
    if (ineligible.value || !payload || !payload.seat) {
      return
    }
    const display = getSeatDisplayState(payload.seat, startTime.value, endTime.value)
    if (!display.selectable) {
      return
    }
    selectedSeat.value = {
      id: payload.seat.id,
      seatNumber: payload.seat.seatNumber || '',
      areaName: payload.areaName || ''
    }
  }

  function clearSelection() {
    selectedSeat.value = null
  }

  function clearSeatReloadTimer() {
    if (seatReloadTimer) {
      clearTimeout(seatReloadTimer)
      seatReloadTimer = null
    }
  }

  function scheduleSeatReload() {
    clearSeatReloadTimer()
    seatReloadTimer = setTimeout(() => {
      seatReloadTimer = null
      loadSeatMap()
    }, 220)
  }

  function refreshSeats() {
    if (!store.isTokenValid) {
      store.openBindModal()
      return
    }
    if (ineligible.value) {
      return
    }
    clearSeatReloadTimer()
    loadSeatMap()
  }

  function resetSeatState() {
    seatRequest.invalidate()
    clearSeatReloadTimer()
    seatMap.value = null
    selectedSeat.value = null
    updatedAt.value = ''
    seatLoading.value = false
    seatError.value = ''
  }

  onBeforeUnmount(() => {
    clearSeatReloadTimer()
  })

  return {
    seatMap,
    selectedSeat,
    updatedAt,
    seatLoading,
    seatError,
    seatAreas,
    holdMinutes,
    loadSeatMap,
    findSeatById,
    validateSelectedSeat,
    onSelectSeat,
    clearSelection,
    clearSeatReloadTimer,
    scheduleSeatReload,
    refreshSeats,
    resetSeatState
  }
}
