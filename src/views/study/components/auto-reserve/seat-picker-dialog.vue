<template>
  <el-dialog
    :model-value="visible"
    class="sr-dialog ar-picker-dialog"
    title="选择优先座位"
    width="min(880px, 96vw)"
    :close-on-click-modal="false"
    @update:model-value="value => emit('update:visible', value)"
  >
    <div class="ar-picker-toolbar">
      <span class="ar-picker-sub">
        参考<template v-if="pickerDate"> {{ pickerDate }} </template>的座位图，仅用于确定优先座位；实际预约以放号当天为准。
      </span>
      <el-input
        v-model="pickerKeyword"
        placeholder="搜索座位号"
        clearable
        style="width: 180px"
      />
    </div>

    <div v-loading="pickerLoading" class="ar-picker-body">
      <div v-if="pickerError" class="ar-picker-feedback" role="alert">
        <el-empty :description="pickerError" :image-size="48" />
        <el-button size="small" @click="loadPickerSeats">重试</el-button>
      </div>
      <div v-else-if="!pickerLoading && !pickerAreas.length" class="ar-picker-feedback">
        <el-empty description="暂无可参考的座位" :image-size="48" />
      </div>
      <div v-else-if="!filteredPickerAreas.length && pickerAreas.length" class="ar-picker-feedback">
        <el-empty description="没有匹配的座位号" :image-size="48" />
      </div>
      <section
        v-for="area in filteredPickerAreas"
        :key="area.id"
        class="ar-picker-area"
      >
        <h4 class="ar-picker-area-title">
          {{ area.areaName }}
          <span class="ar-picker-count">{{ area.seats.length }}</span>
        </h4>
        <div class="ar-picker-seats">
          <button
            v-for="seat in area.seats"
            :key="seat.id"
            type="button"
            class="ar-picker-seat"
            :class="{
              'is-selected': pickerDraft && String(pickerDraft.id) === String(seat.id),
              'is-busy': !isSeatFreeNow(seat)
            }"
            :title="isSeatFreeNow(seat) ? '当前时段可约' : '当前时段不可约，仍可设为优先目标'"
            :aria-pressed="pickerDraft && String(pickerDraft.id) === String(seat.id)"
            @click="choosePickerSeat(area, seat)"
          >
            {{ seat.seatNumber || seat.id }}
          </button>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="sr-dialog-foot">
        <el-button v-if="selectedSeat" @click="clearPickerDraft">清除指定座位</el-button>
        <el-button @click="emit('update:visible', false)">取消</el-button>
        <el-button type="primary" :disabled="!pickerDraft" @click="confirmPicker">确定选择</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { studyReserveApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import { getSeatDisplayState, parseApiDate } from '@/utils/study/format'
import { SEAT_STATE } from '@/utils/study/constants'
import { useLatestRequest } from '@/composables/study/useLatestRequest'

const props = defineProps({
  visible: { type: Boolean, default: false },
  venueId: { type: [String, Number], default: null },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  selectedSeat: { type: Object, default: null }
})

const emit = defineEmits(['update:visible', 'select', 'clear'])

const store = useStudyStore()

const pickerLoading = ref(false)
const pickerError = ref('')
const pickerDate = ref('')
const pickerAreas = ref([])
const pickerKeyword = ref('')
const pickerDraft = ref(null)
const loadRequest = useLatestRequest()

const filteredPickerAreas = computed(() => {
  const keyword = pickerKeyword.value.trim()
  if (!keyword) {
    return pickerAreas.value
  }
  return pickerAreas.value
    .map(area => ({
      ...area,
      seats: area.seats.filter(seat => String(seat.seatNumber || seat.id).includes(keyword))
    }))
    .filter(area => area.seats.length)
})

function isSeatFreeNow(seat) {
  return getSeatDisplayState(seat, props.startTime, props.endTime).selectable
}

async function loadPickerSeats() {
  const seq = loadRequest.next()
  pickerLoading.value = true
  pickerError.value = ''
  pickerAreas.value = []
  pickerDate.value = ''
  try {
    const dateRes = await studyReserveApi.dateSelect(props.venueId)
    if (!loadRequest.isLatest(seq)) {
      return
    }
    const dates = (dateRes?.data?.reserveDateList || []).map(parseApiDate).filter(Boolean)
    if (!dates.length) {
      pickerError.value = '该门店暂无可预约日期，暂时无法加载座位图。'
      return
    }
    const latest = dates[dates.length - 1]
    pickerDate.value = latest.value

    const res = await studyReserveApi.seatList({
      venueId: props.venueId,
      reserveDateStr: latest.value,
      reserveStartTimeStr: props.startTime,
      reserveEndTimeStr: props.endTime,
      reserveAnotherFlag: 0
    })
    if (!loadRequest.isLatest(seq)) {
      return
    }

    pickerAreas.value = (res?.data?.venueAreaList || [])
      .map(area => ({
        id: area.id,
        areaName: area.areaName || `区域 ${area.id}`,
        seats: (area.venueAreaSeatList || []).filter(
          seat => seat && seat.id && Number(seat.seatReserveState) !== SEAT_STATE.UNAVAILABLE
        )
      }))
      .filter(area => area.seats.length)
  } catch (e) {
    if (!loadRequest.isLatest(seq)) {
      return
    }
    if (store.handleApiError(e, { openBind: true })) {
      pickerError.value = e?.msg || '小程序 token 已失效，请重新绑定后再试。'
      return
    }
    pickerError.value = e?.msg || '座位图加载失败，请稍后重试。'
  } finally {
    if (loadRequest.isLatest(seq)) {
      pickerLoading.value = false
    }
  }
}

function choosePickerSeat(area, seat) {
  pickerDraft.value = {
    id: seat.id,
    seatNumber: seat.seatNumber || String(seat.id),
    areaId: area.id,
    areaName: area.areaName || ''
  }
}

function clearPickerDraft() {
  pickerDraft.value = null
  emit('clear')
}

function confirmPicker() {
  if (!pickerDraft.value) {
    ElMessage.warning('请选择一个座位')
    return
  }
  emit('select', { ...pickerDraft.value })
  emit('update:visible', false)
}

watch(
  () => props.visible,
  visible => {
    if (!visible) {
      loadRequest.invalidate()
      return
    }
    pickerKeyword.value = ''
    pickerDraft.value = props.selectedSeat ? { ...props.selectedSeat } : null
    loadPickerSeats()
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.ar-picker-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.ar-picker-sub {
  flex: 1 1 320px;
  min-width: 0;
  color: var(--sr-muted);
  font-size: 11.5px;
  line-height: 1.55;
}

.ar-picker-body {
  min-height: 220px;
  max-height: 54vh;
  overflow: auto;
  padding-right: 4px;
}

.ar-picker-feedback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
}

.ar-picker-area + .ar-picker-area {
  margin-top: 16px;
}

.ar-picker-area-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  color: var(--sr-ink-2);
  font-size: 12.5px;
  font-weight: 600;
}

.ar-picker-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--sr-green-soft);
  color: var(--sr-green-ink);
  font-family: var(--sr-font-mono);
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1;
}

.ar-picker-seats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ar-picker-seat {
  min-width: 44px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--sr-green-line);
  border-radius: 7px;
  background: var(--sr-green-soft);
  color: var(--sr-green-ink);
  font-family: var(--sr-font-mono);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;

  &:hover {
    border-color: var(--sr-green-2);
  }

  &:focus-visible {
    outline: 2px solid var(--sr-green-2);
    outline-offset: 2px;
  }

  &.is-busy {
    border-color: var(--sr-line);
    background: var(--sr-card-2);
    color: var(--sr-muted-2);
  }

  &.is-selected {
    border-color: var(--sr-green);
    background: var(--sr-green);
    color: #fff;
    font-weight: 600;
  }
}

@media (max-width: 640px) {
  .ar-picker-toolbar :deep(.el-input) {
    width: 100% !important;
  }
}
</style>
