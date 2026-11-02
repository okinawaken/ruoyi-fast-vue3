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
import { computed, onMounted, ref } from 'vue'
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
  filterReserveVenues,
  formatReserveRules,
  parseApiDate,
  parseTimeToMinutes,
  parseVenueOpenClose
} from '@/utils/study/format'
import { PAGE_PATH, RESERVE_ANOTHER_FLAG } from '@/utils/study/constants'
import { useLatestRequest } from '@/composables/study/useLatestRequest'
import { useStudyRefresh } from '@/composables/study/useStudyRefresh'
import { useReserveSlot } from '@/composables/study/useReserveSlot'
import { useReserveSeatMap } from '@/composables/study/useReserveSeatMap'

const store = useStudyStore()
const router = useRouter()

const checkInfo = ref(null)
const venueList = ref([])
const venueId = ref(null)
const venueDetail = ref(null)
const initializing = ref(false)
const loadError = ref('')
const submitting = ref(false)
const confirmVisible = ref(false)
const successVisible = ref(false)
const confirmResult = ref(null)

const pageRequest = useLatestRequest()

const ineligible = computed(() => !!checkInfo.value && Number(checkInfo.value.reserveState) === 1)

const {
  dateOptions,
  dateValue,
  openTime,
  closeTime,
  startTime,
  endTime,
  slotUnavailable,
  minDurationMinutes,
  minHoursText,
  startOptions,
  endOptions,
  quickHours,
  selectedDateLabel,
  durationText,
  resolveSlot,
  adjustTimesForToday,
  resetSlotState
} = useReserveSlot({ venueId })

const {
  seatMap,
  selectedSeat,
  updatedAt,
  seatLoading,
  seatError,
  seatAreas,
  holdMinutes,
  loadSeatMap,
  onSelectSeat,
  clearSelection,
  clearSeatReloadTimer,
  scheduleSeatReload,
  refreshSeats,
  resetSeatState
} = useReserveSeatMap({ venueId, dateValue, startTime, endTime, ineligible })

const maxDaysText = computed(() => {
  const days = Number(store.config?.reserveMaxDays)
  return Number.isFinite(days) && days > 0 ? `可预约未来 ${days} 天` : ''
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

async function initialize() {
  if (!store.isTokenValid) {
    return
  }
  const seq = pageRequest.next()
  initializing.value = true
  loadError.value = ''
  checkInfo.value = null
  venueList.value = []
  venueId.value = null
  venueDetail.value = null
  resetSlotState()
  resetSeatState()

  try {
    const [checkRes, venueRes] = await Promise.all([
      studyReserveApi.check(),
      studyVenueApi.reserveSelect(),
      store.fetchConfig()
    ])
    if (!pageRequest.isLatest(seq)) {
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
    if (!pageRequest.isLatest(seq)) {
      return
    }
    if (store.handleApiError(e, { openBind: true })) {
      return
    }
    loadError.value = e?.msg || '预约信息加载失败，请稍后重试。'
  } finally {
    if (pageRequest.isLatest(seq)) {
      initializing.value = false
    }
  }
}

async function loadVenueContext(seq) {
  loadError.value = ''
  slotUnavailable.value = false
  venueDetail.value = null
  dateOptions.value = []
  dateValue.value = ''
  startTime.value = ''
  endTime.value = ''
  resetSeatState()
  seatLoading.value = true

  try {
    const [detailRes, dateRes] = await Promise.all([
      studyVenueApi.reserveDetail(venueId.value),
      studyReserveApi.dateSelect(venueId.value)
    ])
    if (!pageRequest.isLatest(seq)) {
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
      resetSeatState()
      return
    }

    dateValue.value = slot.dateValue
    startTime.value = slot.startTime
    endTime.value = slot.endTime

    await loadSeatMap()
  } catch (e) {
    if (!pageRequest.isLatest(seq)) {
      return
    }
    seatLoading.value = false
    if (store.handleApiError(e, { openBind: true })) {
      return
    }
    loadError.value = e?.msg || '门店或日期信息加载失败，请稍后重试。'
  }
}

async function onVenueChange(value) {
  if (filtersDisabled.value || value === null || value === undefined) {
    return
  }
  if (Number(value) === Number(venueId.value)) {
    return
  }
  const seq = pageRequest.next()
  clearSeatReloadTimer()
  venueId.value = value
  store.rememberVenue(value)
  clearSelection()
  await loadVenueContext(seq)
}

async function onDateChange(value) {
  if (filtersDisabled.value || !value || value === dateValue.value) {
    return
  }
  clearSeatReloadTimer()
  dateValue.value = value
  clearSelection()

  if (!startTime.value || !endTime.value) {
    const dateInfo = dateOptions.value.find(item => item.value === value)
    const slot = dateInfo ? resolveSlot(dateInfo, false) : { unavailable: true }
    if (slot.unavailable) {
      slotUnavailable.value = true
      dateValue.value = ''
      startTime.value = ''
      endTime.value = ''
      resetSeatState()
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
  clearSelection()
  scheduleSeatReload()
}

function onEndChange(value) {
  if (filtersDisabled.value || !value) {
    return
  }
  endTime.value = value
  clearSelection()
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
  clearSelection()
  scheduleSeatReload()
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
  if (!store.requireToken()) {
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
  if (!store.requireToken()) {
    confirmVisible.value = false
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
    if (store.handleApiError(e, { openBind: true })) {
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
  clearSelection()
  loadSeatMap()
  if (gotoOverview) {
    router.push(PAGE_PATH.OVERVIEW)
  }
}

useStudyRefresh(() => initialize())

onMounted(() => {
  store.ensureStatus()
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
