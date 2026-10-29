<template>
  <StudyShell>
    <div class="reserve-page">
      <header class="sr-page-head">
        <div>
          <p class="sr-eyebrow">自习室 · 选座</p>
          <h1 class="sr-title">预约</h1>
          <p class="sr-sub">先定日期与时段，再选一个完整覆盖该时段的座位。</p>
        </div>
        <div class="sr-actions">
          <span class="sr-updated">
            <span class="sr-live-dot" aria-hidden="true"></span>
            更新于 <span class="sr-mono">{{ updatedAt || '—' }}</span>
          </span>
          <el-button :disabled="ineligible || initializing" @click="refreshSeats">
            <el-icon class="refresh-icon"><Refresh /></el-icon>
            刷新座位
          </el-button>
        </div>
      </header>

      <div v-if="checkInfo" class="sr-eligibility" :class="{ 'is-warning': ineligible }" role="status">
        <el-icon class="eligibility-icon">
          <CircleCheck v-if="!ineligible" />
          <WarningFilled v-else />
        </el-icon>
        <span v-if="!ineligible">
          <strong>预约资格正常</strong>
          <template v-if="maxDaysText"> · {{ maxDaysText }}</template>
        </span>
        <span v-else><strong>暂不可预约</strong> · {{ checkInfo.reserveStateMsg || '当前账号暂不可预约' }}</span>
      </div>

      <ReserveFilter
        :venue-options="venueList"
        :venue-id="venueId"
        :date-options="dateOptions"
        :date-value="dateValue"
        :start-time="startTime"
        :end-time="endTime"
        :start-options="startOptions"
        :end-options="endOptions"
        :quick-hours="quickHours"
        :min-hours-text="minHoursText"
        :disabled="filtersDisabled"
        @venue-change="onVenueChange"
        @date-change="onDateChange"
        @start-change="onStartChange"
        @end-change="onEndChange"
        @quick="onQuickDuration"
      />

      <section v-if="loadError" class="sr-card reserve-feedback" role="alert">
        <div class="sr-empty">
          <el-empty :description="loadError" />
          <el-button type="primary" @click="retryPage">重新加载</el-button>
        </div>
      </section>

      <section v-else-if="!initializing && !venueList.length" class="sr-card reserve-feedback">
        <div class="sr-empty">
          <el-empty description="暂无可预约门店" />
          <el-button @click="retryPage">重新加载</el-button>
        </div>
      </section>

      <section v-else-if="!initializing && venueId && !dateOptions.length" class="sr-card reserve-feedback">
        <div class="sr-empty">
          <el-empty description="该门店暂无可预约日期" />
          <el-button @click="retryPage">重新加载</el-button>
        </div>
      </section>

      <section v-else-if="slotUnavailable" class="sr-card reserve-feedback" role="status">
        <div class="sr-empty">
          <el-empty description="今天已无可预约时段，请选择其他日期。" />
        </div>
      </section>

      <div v-else class="reserve-grid">
        <SeatMap
          :venue-name="venueName"
          :open-time="openTime"
          :close-time="closeTime"
          :updated-at="updatedAt"
          :areas="seatAreas"
          :start-time="startTime"
          :end-time="endTime"
          :selected-seat-id="selectedSeat ? selectedSeat.id : null"
          :loading="seatLoading || initializing"
          :error="seatError"
          :disabled="ineligible"
          @select="onSelectSeat"
          @retry="retrySeatMap"
        />

        <ReserveSummary
          :date-label="selectedDateLabel"
          :start-time="startTime"
          :end-time="endTime"
          :duration-text="durationText"
          :venue-name="venueName"
          :seat="selectedSeat"
          :rules="reserveRules"
          :submit-disabled="submitDisabled"
          :submitting="submitting"
          :ineligible="ineligible"
          @submit="submitReserve"
          @clear="clearSelection"
        />
      </div>
    </div>

    <el-dialog
      v-model="confirmVisible"
      class="sr-dialog"
      title="确认预约"
      width="440px"
      :close-on-click-modal="false"
      :close-on-press-escape="!submitting"
      :show-close="!submitting"
    >
      <div class="confirm-body">
        <p class="confirm-lead">请核对以下预约信息，提交后座位将为你保留。</p>

        <div class="confirm-kv">
          <div class="sr-kv"><span class="sr-kv-key">门店</span><span class="sr-kv-value">{{ venueName || '—' }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">日期</span><span class="sr-kv-value">{{ selectedDateLabel || '—' }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">时段</span><span class="sr-kv-value sr-mono">{{ confirmTimeRange }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">时长</span><span class="sr-kv-value">{{ durationText || '—' }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">座位</span><span class="sr-kv-value">{{ confirmSeatText }}</span></div>
        </div>

        <div v-if="holdMinutes" class="sr-dialog-note">
          预约成功后座位保留 {{ holdMinutes }} 分钟，请按时到店签到。
        </div>

        <div class="sr-dialog-foot confirm-actions">
          <el-button :disabled="submitting" @click="confirmVisible = false">返回修改</el-button>
          <el-button type="primary" :loading="submitting" @click="doSubmitReserve">确认预约</el-button>
        </div>
      </div>
    </el-dialog>

    <ReserveSuccessDialog
      :open="successVisible"
      :result="confirmResult"
      :fallback="successFallback"
      @close="handleSuccessClose(false)"
      @view="handleSuccessClose(true)"
    />
  </StudyShell>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import StudyShell from './components/study-shell.vue'
import ReserveFilter from './components/reserve-filter.vue'
import SeatMap from './components/seat-map.vue'
import ReserveSummary from './components/reserve-summary.vue'
import ReserveSuccessDialog from './components/reserve-success-dialog.vue'
import { studyReserveApi, studyVenueApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import {
  buildTimeOptions,
  clampTimeSlot,
  filterReserveVenues,
  formatDurationText,
  formatReserveRules,
  getSeatDisplayState,
  minutesToTime,
  nextWholeHour,
  parseApiDate,
  parseTimeToMinutes,
  parseVenueOpenClose
} from '@/utils/study/format'
import {
  DEFAULT_DURATION_MINUTES,
  PAGE_PATH,
  QUICK_HOURS,
  RESERVE_ANOTHER_FLAG,
  TIME_STEP_MINUTES
} from '@/utils/study/constants'

const store = useStudyStore()
const router = useRouter()

const DEFAULT_START_MINUTES = 10 * 60

const checkInfo = ref(null)
const venueList = ref([])
const venueId = ref(null)
const venueDetail = ref(null)
const dateOptions = ref([])
const dateValue = ref('')
const openTime = ref('')
const closeTime = ref('')
const startTime = ref('')
const endTime = ref('')
const seatMap = ref(null)
const selectedSeat = ref(null)
const updatedAt = ref('')
const initializing = ref(false)
const loadError = ref('')
const slotUnavailable = ref(false)
const seatLoading = ref(false)
const seatError = ref('')
const submitting = ref(false)
const confirmVisible = ref(false)
const successVisible = ref(false)
const confirmResult = ref(null)

let pageSeq = 0
let seatRequestSeq = 0
let seatReloadTimer = null
let lastInitKey = ''

const ineligible = computed(() => !!checkInfo.value && Number(checkInfo.value.reserveState) === 1)

const maxDaysText = computed(() => {
  const days = Number(store.config?.reserveMaxDays)
  return Number.isFinite(days) && days > 0 ? `可预约未来 ${days} 天` : ''
})

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

const venueName = computed(() => {
  if (venueDetail.value?.venueName) {
    return venueDetail.value.venueName
  }
  if (seatMap.value?.venue?.venueName) {
    return seatMap.value.venue.venueName
  }
  const matched = venueList.value.find(item => Number(item.id) === Number(venueId.value))
  return matched ? matched.venueName : ''
})

const seatAreas = computed(() => seatMap.value?.venueAreaList || [])

const durationMinutes = computed(() => {
  const start = parseTimeToMinutes(startTime.value)
  const end = parseTimeToMinutes(endTime.value)
  return start !== null && end !== null && end > start ? end - start : 0
})

const durationText = computed(() => (durationMinutes.value > 0 ? formatDurationText(durationMinutes.value) : ''))

const reserveRules = computed(() => {
  const map = seatMap.value || {}
  return formatReserveRules({
    ...(store.config || {}),
    reserveHoldMinutes: map.reserveHoldMinutes,
    reserveCancelMinutes: map.reserveCancelMinutes,
    reserveCancelLimit: map.reserveCancelLimit
  })
})

const filtersDisabled = computed(() => !store.isTokenValid || ineligible.value || initializing.value)

const submitDisabled = computed(
  () =>
    !selectedSeat.value ||
    ineligible.value ||
    seatLoading.value ||
    submitting.value ||
    !startTime.value ||
    !endTime.value
)

const successFallback = computed(() => ({
  dateValue: dateValue.value,
  dateLabel: selectedDateLabel.value,
  startTime: startTime.value,
  endTime: endTime.value,
  venueName: venueName.value,
  seatText: selectedSeat.value
    ? `${selectedSeat.value.seatNumber}${selectedSeat.value.areaName ? ` · ${selectedSeat.value.areaName}` : ''}`
    : ''
}))

const confirmTimeRange = computed(() =>
  startTime.value && endTime.value ? `${startTime.value} – ${endTime.value}` : '—'
)

const confirmSeatText = computed(() => {
  if (!selectedSeat.value) {
    return '—'
  }
  return [selectedSeat.value.seatNumber, selectedSeat.value.areaName].filter(Boolean).join(' · ')
})

const holdMinutes = computed(() => {
  const value = Number(seatMap.value?.reserveHoldMinutes ?? store.config?.reserveHoldMinutes)
  return Number.isFinite(value) && value > 0 ? value : null
})

function nowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function nowText() {
  return minutesToTime(nowMinutes()) || '--:--'
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

async function initialize() {
  if (!store.isTokenValid) {
    return
  }
  const seq = ++pageSeq
  initializing.value = true
  loadError.value = ''
  checkInfo.value = null
  venueList.value = []
  venueId.value = null
  venueDetail.value = null
  dateOptions.value = []
  dateValue.value = ''
  openTime.value = ''
  closeTime.value = ''
  startTime.value = ''
  endTime.value = ''
  seatMap.value = null
  seatLoading.value = false
  seatError.value = ''
  slotUnavailable.value = false
  selectedSeat.value = null
  updatedAt.value = ''

  try {
    const [checkRes, venueRes] = await Promise.all([
      studyReserveApi.check(),
      studyVenueApi.reserveSelect(),
      store.fetchConfig()
    ])
    if (seq !== pageSeq) {
      return
    }
    checkInfo.value = checkRes?.data || null
    venueList.value = filterReserveVenues(venueRes?.data?.venueList)

    if (!venueList.value.length) {
      return
    }

    const preferredVenueId = store.lastVenueId ?? store.lastSlot?.venueId
    const matched = preferredVenueId
      ? venueList.value.find(item => Number(item.id) === Number(preferredVenueId))
      : null
    const chosen = matched || venueList.value[0]
    venueId.value = chosen.id

    await loadVenueContext(seq)
  } catch (e) {
    if (seq !== pageSeq) {
      return
    }
    if (store.handleApiError(e)) {
      store.openBindModal()
      return
    }
    loadError.value = e?.msg || '预约信息加载失败，请稍后重试。'
  } finally {
    if (seq === pageSeq) {
      initializing.value = false
    }
  }
}

async function loadVenueContext(seq) {
  loadError.value = ''
  slotUnavailable.value = false
  seatLoading.value = true
  venueDetail.value = null
  dateOptions.value = []
  dateValue.value = ''
  startTime.value = ''
  endTime.value = ''
  seatMap.value = null
  seatError.value = ''

  try {
    const [detailRes, dateRes] = await Promise.all([
      studyVenueApi.reserveDetail(venueId.value),
      studyReserveApi.dateSelect(venueId.value)
    ])
    if (seq !== pageSeq) {
      return
    }

    venueDetail.value = detailRes?.data || null
    const openClose = parseVenueOpenClose(venueDetail.value)
    openTime.value = openClose.open || '00:00'
    closeTime.value = openClose.close || '23:59'

    const parsedDates = (dateRes?.data?.reserveDateList || []).map(parseApiDate).filter(Boolean)
    dateOptions.value = parsedDates
    if (!parsedDates.length) {
      seatLoading.value = false
      return
    }

    // 默认选中可预约日期中的最后一天（最远可约日期）
    const selectedDate = parsedDates[parsedDates.length - 1]
    const slot = resolveSlot(selectedDate, true)

    if (slot.unavailable) {
      slotUnavailable.value = true
      selectedSeat.value = null
      seatMap.value = null
      seatError.value = ''
      seatLoading.value = false
      return
    }

    dateValue.value = slot.dateValue
    startTime.value = slot.startTime
    endTime.value = slot.endTime

    await loadSeatMap(seq)
    if (seq === pageSeq) {
      seatLoading.value = false
    }
  } catch (e) {
    if (seq !== pageSeq) {
      return
    }
    seatLoading.value = false
    if (store.handleApiError(e)) {
      store.openBindModal()
      return
    }
    loadError.value = e?.msg || '门店或日期信息加载失败，请稍后重试。'
  }
}

async function loadSeatMap(seq = pageSeq) {
  if (!store.isTokenValid || ineligible.value) {
    return
  }
  if (!venueId.value || !dateValue.value || !startTime.value || !endTime.value) {
    return
  }

  const requestSeq = ++seatRequestSeq
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
    if (requestSeq !== seatRequestSeq || seq !== pageSeq) {
      return
    }
    seatMap.value = res?.data || null
    updatedAt.value = nowText()
    validateSelectedSeat()
  } catch (e) {
    if (requestSeq !== seatRequestSeq || seq !== pageSeq) {
      return
    }
    seatMap.value = null
    seatError.value = e?.msg || '座位图加载失败，请稍后重试。'
    if (store.handleApiError(e)) {
      store.openBindModal()
      return
    }
  } finally {
    if (requestSeq === seatRequestSeq && seq === pageSeq) {
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

async function onVenueChange(value) {
  if (filtersDisabled.value || value === null || value === undefined) {
    return
  }
  if (Number(value) === Number(venueId.value)) {
    return
  }
  const seq = ++pageSeq
  clearSeatReloadTimer()
  venueId.value = value
  store.rememberVenue(value)
  selectedSeat.value = null
  seatLoading.value = false
  await loadVenueContext(seq)
}

async function onDateChange(value) {
  if (filtersDisabled.value || !value || value === dateValue.value) {
    return
  }
  clearSeatReloadTimer()
  dateValue.value = value
  selectedSeat.value = null

  if (!startTime.value || !endTime.value) {
    const dateInfo = dateOptions.value.find(item => item.value === value)
    const slot = dateInfo ? resolveSlot(dateInfo, false) : { unavailable: true }
    if (slot.unavailable) {
      slotUnavailable.value = true
      dateValue.value = ''
      startTime.value = ''
      endTime.value = ''
      seatMap.value = null
      return
    }
    slotUnavailable.value = false
    startTime.value = slot.startTime
    endTime.value = slot.endTime
  }

  adjustTimesForToday()
  await loadSeatMap()
}

function onStartChange(value) {
  if (filtersDisabled.value || !value) {
    return
  }
  startTime.value = value
  const startMin = parseTimeToMinutes(value)
  const endMin = parseTimeToMinutes(endTime.value)
  if (endMin === null || (startMin !== null && endMin < startMin + minDurationMinutes.value)) {
    if (endOptions.value.length) {
      endTime.value = endOptions.value[0]
    }
  }
  selectedSeat.value = null
  scheduleSeatReload()
}

function onEndChange(value) {
  if (filtersDisabled.value || !value) {
    return
  }
  endTime.value = value
  selectedSeat.value = null
  scheduleSeatReload()
}

function onQuickDuration(hours) {
  if (filtersDisabled.value) {
    return
  }
  const startMin = parseTimeToMinutes(startTime.value)
  if (startMin === null || !endOptions.value.length) {
    return
  }
  const desired = startMin + hours * 60
  let chosen = endOptions.value.find(time => parseTimeToMinutes(time) === desired)
  if (!chosen) {
    const notAfter = endOptions.value.filter(time => {
      const value = parseTimeToMinutes(time)
      return value !== null && value <= desired
    })
    chosen = notAfter.length ? notAfter[notAfter.length - 1] : endOptions.value[0]
  }
  endTime.value = chosen
  selectedSeat.value = null
  scheduleSeatReload()
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

function retrySeatMap() {
  if (!venueId.value || !dateValue.value) {
    initialize()
    return
  }
  loadSeatMap()
}

function retryPage() {
  initialize()
}

async function submitReserve() {
  if (!store.isTokenValid) {
    store.openBindModal()
    return
  }
  if (ineligible.value) {
    ElMessage.warning(checkInfo.value?.reserveStateMsg || '当前账号暂不可预约')
    return
  }
  if (seatLoading.value) {
    ElMessage.warning('座位信息更新中，请稍候')
    return
  }
  if (submitting.value) {
    return
  }
  if (!selectedSeat.value) {
    ElMessage.warning('请先选择一个座位')
    return
  }
  if (!venueId.value || !dateValue.value || !startTime.value || !endTime.value) {
    ElMessage.warning('请先选择门店、日期与时段')
    return
  }

  confirmVisible.value = true
}

async function doSubmitReserve() {
  if (submitting.value) {
    return
  }
  if (!store.isTokenValid) {
    confirmVisible.value = false
    store.openBindModal()
    return
  }
  if (!selectedSeat.value || !venueId.value || !dateValue.value || !startTime.value || !endTime.value) {
    confirmVisible.value = false
    ElMessage.warning('预约信息已变化，请重新选择')
    loadSeatMap()
    return
  }
  if (seatLoading.value) {
    ElMessage.warning('座位信息更新中，请稍候')
    return
  }

  submitting.value = true
  try {
    const lng = Number(venueDetail.value?.venueLng)
    const lat = Number(venueDetail.value?.venueLat)
    const res = await studyReserveApi.seatConfirm({
      seatId: selectedSeat.value.id,
      reserveDateStr: dateValue.value,
      reserveStartTimeStr: startTime.value,
      reserveEndTimeStr: endTime.value,
      currentLng: Number.isFinite(lng) ? lng : 0,
      currentLat: Number.isFinite(lat) ? lat : 0,
      reserveAnotherFlag: RESERVE_ANOTHER_FLAG
    })
    confirmVisible.value = false
    store.rememberSlot({ venueId: venueId.value, startTime: startTime.value, endTime: endTime.value })
    confirmResult.value = res?.data || null
    successVisible.value = true
  } catch (e) {
    confirmVisible.value = false
    if (store.handleApiError(e)) {
      store.openBindModal()
      return
    }
    // 预约失败（如座位刚被占用）时刷新座位图，避免继续针对旧状态提交
    loadSeatMap()
  } finally {
    submitting.value = false
  }
}

function handleSuccessClose(gotoOverview) {
  successVisible.value = false
  confirmResult.value = null
  selectedSeat.value = null
  loadSeatMap()
  if (gotoOverview) {
    router.push(PAGE_PATH.OVERVIEW)
  }
}

watch(
  () => [store.isTokenValid, store.refreshKey],
  ([valid]) => {
    if (!valid) {
      lastInitKey = ''
      return
    }
    const key = String(store.refreshKey)
    if (key === lastInitKey) {
      return
    }
    lastInitKey = key
    initialize()
  },
  { immediate: true }
)

onMounted(() => {
  store.ensureStatus()
})

onBeforeUnmount(() => {
  pageSeq += 1
  seatRequestSeq += 1
  clearSeatReloadTimer()
})
</script>

<style lang="scss" scoped>
.reserve-page {
  min-width: 0;
}

.sr-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sr-green-3, #3e8468);
  flex: none;
}

.refresh-icon {
  margin-right: 4px;
}

.sr-eligibility {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  min-width: 0;
  margin-bottom: 14px;
  padding: 10px 14px;
  border: 1px solid var(--sr-green-line, #bfd3c5);
  border-radius: 10px;
  background: linear-gradient(90deg, var(--sr-green-soft, #e4ede6), rgba(247, 243, 233, 0.4));
  color: var(--sr-green-ink, #315a47);
  font-size: 12px;
  line-height: 1.55;

  strong {
    font-weight: 600;
  }

  &.is-warning {
    border-color: var(--sr-amber-line, #e7c98f);
    background: var(--sr-amber-soft, #fbf0dc);
    color: var(--sr-amber-ink, #6b4a12);
  }
}

.eligibility-icon {
  font-size: 15px;
  flex: none;
}

.reserve-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 318px;
  gap: 20px;
  align-items: start;
  min-width: 0;
}

.reserve-feedback {
  min-width: 0;
}

.reserve-feedback .sr-empty {
  padding: 44px 18px;
}

.confirm-body {
  padding: 2px 2px 0;
}

.confirm-lead {
  margin: 0;
  color: #5f6c64;
  font-size: 12.5px;
  line-height: 1.65;
}

.confirm-kv {
  margin-top: 12px;
  padding: 2px 12px;
  border: 1px solid #e4dcc9;
  border-radius: 10px;
  background: #fbf8ef;
}

.confirm-actions {
  margin-top: 18px;
}

@media (max-width: 1120px) {
  .reserve-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .sr-eligibility {
    padding: 10px 12px;
  }

  .reserve-grid {
    gap: 14px;
  }

  .confirm-actions :deep(.el-button) {
    flex: 1 1 auto;
  }
}
</style>
