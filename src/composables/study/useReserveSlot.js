import { computed, ref } from 'vue'
import {
  buildTimeOptions,
  clampTimeSlot,
  formatDurationText,
  minutesToTime,
  nextWholeHour,
  parseTimeToMinutes
} from '@/utils/study/time'
import {
  DEFAULT_DURATION_MINUTES,
  QUICK_HOURS,
  TIME_STEP_MINUTES
} from '@/utils/study/constants'
import useStudyStore from '@/store/modules/study'

const DEFAULT_START_MINUTES = 10 * 60

/**
 * 预约页的日期/时段状态与计算。
 *
 * 负责营业时间、可选项、最近一次预约时段回填，以及「今天」场景下的时段顺延。
 *
 * @param {{ venueId: import('vue').Ref<number|null> }} options
 */
export function useReserveSlot({ venueId }) {
  const store = useStudyStore()

  const dateOptions = ref([])
  const dateValue = ref('')
  const openTime = ref('')
  const closeTime = ref('')
  const startTime = ref('')
  const endTime = ref('')
  const slotUnavailable = ref(false)

  const minDurationMinutes = computed(() => {
    const hours = Number(store.config?.reserveMinHours)
    return (Number.isFinite(hours) && hours > 0 ? hours : 1) * 60
  })

  const minHoursText = computed(() => formatDurationText(minDurationMinutes.value))

  const timeOptions = computed(() => buildTimeOptions(openTime.value, closeTime.value, TIME_STEP_MINUTES))

  const startOptions = computed(() => {
    const closeMin = parseTimeToMinutes(closeTime.value)
    return timeOptions.value.filter(time => {
      const value = parseTimeToMinutes(time)
      return value !== null && (closeMin === null || value + minDurationMinutes.value <= closeMin)
    })
  })

  const endOptions = computed(() => {
    const startMin = parseTimeToMinutes(startTime.value)
    if (startMin === null) {
      return []
    }
    const minEnd = startMin + minDurationMinutes.value
    const closeMin = parseTimeToMinutes(closeTime.value)
    return timeOptions.value.filter(time => {
      const value = parseTimeToMinutes(time)
      return value !== null && value >= minEnd && (closeMin === null || value <= closeMin)
    })
  })

  const quickHours = QUICK_HOURS

  const selectedDateLabel = computed(() => {
    const matched = dateOptions.value.find(item => item.value === dateValue.value)
    return matched ? matched.label : ''
  })

  const durationMinutes = computed(() => {
    const start = parseTimeToMinutes(startTime.value)
    const end = parseTimeToMinutes(endTime.value)
    return start !== null && end !== null && end > start ? end - start : 0
  })

  const durationText = computed(() => (durationMinutes.value > 0 ? formatDurationText(durationMinutes.value) : ''))

  function nowMinutes() {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  }

  function defaultSlot() {
    const openMin = parseTimeToMinutes(openTime.value)
    const closeMin = parseTimeToMinutes(closeTime.value)
    let start = Math.max(DEFAULT_START_MINUTES, openMin === null ? DEFAULT_START_MINUTES : openMin)
    if (closeMin !== null && start > closeMin) {
      start = closeMin
    }
    let end = start + DEFAULT_DURATION_MINUTES
    if (closeMin !== null && end > closeMin) {
      end = closeMin
    }
    return clampTimeSlot(
      { startTime: minutesToTime(start), endTime: minutesToTime(end) },
      { open: openTime.value, close: closeTime.value, minMinutes: minDurationMinutes.value }
    )
  }

  function baseSlot(openMin, closeMin) {
    const last = store.lastSlot
    if (last && Number(last.venueId) === Number(venueId.value)) {
      const lastStart = parseTimeToMinutes(last.startTime)
      const lastEnd = parseTimeToMinutes(last.endTime)
      if (lastStart !== null && lastEnd !== null && lastEnd > lastStart && lastStart >= openMin && lastEnd <= closeMin) {
        return clampTimeSlot(
          { startTime: last.startTime, endTime: last.endTime },
          { open: openTime.value, close: closeTime.value, minMinutes: minDurationMinutes.value }
        )
      }
    }
    return defaultSlot()
  }

  function resolveSlot(dateInfo, allowNextDate) {
    const openMin = parseTimeToMinutes(openTime.value) ?? 0
    const closeMin = parseTimeToMinutes(closeTime.value) ?? 1439
    const base = baseSlot(openMin, closeMin)

    if (dateInfo.isToday) {
      const startMin = parseTimeToMinutes(base.startTime)
      const endMin = parseTimeToMinutes(base.endTime)
      const now = nowMinutes()
      if (startMin !== null && startMin <= now) {
        const duration = Math.max(minDurationMinutes.value, (endMin === null ? startMin : endMin) - startMin)
        const nextHour = parseTimeToMinutes(nextWholeHour())
        const candidate = nextHour !== null && nextHour > now ? Math.max(nextHour, openMin) : null

        if (candidate === null || candidate + duration > closeMin) {
          if (allowNextDate) {
            const index = dateOptions.value.findIndex(item => item.value === dateInfo.value)
            const nextDate = index >= 0 ? dateOptions.value[index + 1] : null
            if (nextDate) {
              const fresh = defaultSlot()
              return { dateValue: nextDate.value, startTime: fresh.startTime, endTime: fresh.endTime }
            }
          }
          return { dateValue: '', startTime: '', endTime: '', unavailable: true }
        }
        const clamped = clampTimeSlot(
          { startTime: minutesToTime(candidate), endTime: minutesToTime(candidate + duration) },
          { open: openTime.value, close: closeTime.value, minMinutes: minDurationMinutes.value }
        )
        return { dateValue: dateInfo.value, startTime: clamped.startTime, endTime: clamped.endTime }
      }
    }

    return { dateValue: dateInfo.value, startTime: base.startTime, endTime: base.endTime }
  }

  function adjustTimesForToday() {
    const dateInfo = dateOptions.value.find(item => item.value === dateValue.value)
    if (!dateInfo || !dateInfo.isToday) {
      return
    }
    const now = nowMinutes()
    const startMin = parseTimeToMinutes(startTime.value)
    if (startMin === null || startMin > now) {
      return
    }
    const endMin = parseTimeToMinutes(endTime.value)
    const duration = Math.max(minDurationMinutes.value, (endMin === null ? startMin : endMin) - startMin)
    const openMin = parseTimeToMinutes(openTime.value) ?? 0
    const nextHour = parseTimeToMinutes(nextWholeHour())
    if (nextHour === null || nextHour <= now) {
      return
    }
    const candidate = Math.max(nextHour, openMin)
    const clamped = clampTimeSlot(
      { startTime: minutesToTime(candidate), endTime: minutesToTime(candidate + duration) },
      { open: openTime.value, close: closeTime.value, minMinutes: minDurationMinutes.value }
    )
    startTime.value = clamped.startTime
    endTime.value = clamped.endTime
  }

  function resetSlotState() {
    dateOptions.value = []
    dateValue.value = ''
    openTime.value = ''
    closeTime.value = ''
    startTime.value = ''
    endTime.value = ''
    slotUnavailable.value = false
  }

  return {
    dateOptions,
    dateValue,
    openTime,
    closeTime,
    startTime,
    endTime,
    slotUnavailable,
    minDurationMinutes,
    minHoursText,
    timeOptions,
    startOptions,
    endOptions,
    quickHours,
    selectedDateLabel,
    durationMinutes,
    durationText,
    defaultSlot,
    baseSlot,
    resolveSlot,
    adjustTimesForToday,
    resetSlotState
  }
}
