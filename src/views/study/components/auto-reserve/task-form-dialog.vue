<template>
  <el-dialog
    :model-value="visible"
    class="sr-dialog ar-form-dialog"
    :title="editingId ? '编辑自动预约任务' : '新建自动预约任务'"
    width="min(720px, 94vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    @update:model-value="value => emit('update:visible', value)"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="ar-form"
      @submit.prevent
    >
      <el-form-item label="门店" prop="venueId">
        <el-select
          v-model="form.venueId"
          placeholder="请选择门店"
          filterable
          style="width: 100%"
          :loading="venueLoading"
          @change="onFormVenueChange"
        >
          <el-option
            v-for="venue in venueList"
            :key="venue.id"
            :label="venue.venueName"
            :value="venue.id"
          />
        </el-select>
      </el-form-item>

      <div class="ar-form-row">
        <el-form-item label="开始时间" prop="startTime">
          <el-select
            v-model="form.startTime"
            placeholder="开始时间"
            style="width: 100%"
            :disabled="!form.venueId || venueDetailLoading"
            @change="onFormStartChange"
          >
            <el-option v-for="time in startTimeOptions" :key="time" :label="time" :value="time" />
          </el-select>
        </el-form-item>

        <el-form-item label="结束时间" prop="endTime">
          <el-select
            v-model="form.endTime"
            placeholder="结束时间"
            style="width: 100%"
            :disabled="!form.venueId || venueDetailLoading"
            @change="onFormEndChange"
          >
            <el-option v-for="time in endTimeOptions" :key="time" :label="time" :value="time" />
          </el-select>
        </el-form-item>
      </div>

      <p class="ar-form-hint">
        <template v-if="formDurationText">目标时段 {{ form.startTime }} – {{ form.endTime }}，共 {{ formDurationText }}。</template>
        <template v-else>请选择完整的目标时段。</template>
        <template v-if="formOpenCloseText"> 门店营业时间 {{ formOpenCloseText }}。</template>
      </p>

      <el-form-item label="执行星期" prop="weekDays">
        <el-checkbox-group v-model="form.weekDays" class="ar-week-group">
          <el-checkbox-button
            v-for="day in AUTO_RESERVE_WEEKDAYS"
            :key="day.value"
            :label="day.value"
          >{{ day.label }}</el-checkbox-button>
        </el-checkbox-group>
        <p class="ar-form-hint in-item">只在这些星期尝试预约；没有勾选任何一天时任务不会执行。</p>
      </el-form-item>

      <el-form-item label="指定座位（可选）" prop="seatId">
        <div v-if="form.seatId" class="ar-seat-picked">
          <span class="sr-chip sr-chip-green">
            <span class="sr-dot"></span>
            {{ form.seatNumber || '已选座位' }}<template v-if="form.seatAreaName"> · {{ form.seatAreaName }}</template>
          </span>
          <el-button link type="primary" size="small" @click="openSeatPicker">重新选择</el-button>
          <el-button link size="small" @click="clearSeatSelection">清除</el-button>
          <el-button
            v-if="seatAreaFallbackHint"
            link
            type="primary"
            size="small"
            @click="applySeatAreaAsPreferred"
          >把「{{ form.seatAreaName }}」设为偏好区域</el-button>
        </div>
        <el-button v-else @click="openSeatPicker" :disabled="!form.venueId">
          <el-icon><Location /></el-icon>
          从座位图选择
        </el-button>
      </el-form-item>

      <el-form-item label="偏好区域（可选）" prop="areaId">
        <el-select
          v-model="form.areaId"
          placeholder="选择偏好区域"
          clearable
          filterable
          style="width: 100%"
          :loading="areaLoading"
          :disabled="!form.venueId || venueDetailLoading"
          @change="onAreaChange"
        >
          <el-option
            v-for="area in areaList"
            :key="area.id"
            :label="area.areaName"
            :value="area.id"
          >
            <span>{{ area.areaName }}</span>
            <span v-if="area.seatCount" class="ar-area-count">{{ area.seatCount }} 座</span>
          </el-option>
        </el-select>
        <p v-if="areaError" class="ar-form-hint in-item is-error">
          {{ areaError }}
          <el-button link type="primary" size="small" @click="retryAreas">重试</el-button>
        </p>
        <p v-else-if="areaNote" class="ar-form-hint in-item">{{ areaNote }}</p>
        <p v-else-if="areaLoading" class="ar-form-hint in-item">正在读取门店区域…</p>
        <p v-else-if="!form.venueId" class="ar-form-hint in-item">请先选择门店，再选择该门店的区域。</p>
      </el-form-item>

      <p class="ar-form-hint ar-pref-summary">
        两项可同时设置，选座顺序：<strong>{{ seatPreferenceChain }}</strong>，都不可约时本轮记为失败。
      </p>
    </el-form>

    <template #footer>
      <div class="sr-dialog-foot">
        <el-button :disabled="saving" @click="emit('update:visible', false)">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveTask">
          {{ editingId ? '保存修改' : '创建任务' }}
        </el-button>
      </div>
    </template>
  </el-dialog>

  <SeatPickerDialog
    v-model:visible="pickerVisible"
    :venue-id="form.venueId"
    :start-time="form.startTime"
    :end-time="form.endTime"
    :selected-seat="pickedSeat"
    @select="applyPickedSeat"
    @clear="onPickerClear"
  />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import SeatPickerDialog from './seat-picker-dialog.vue'
import { studyAutoReserveApi, studyReserveApi, studyVenueApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import {
  buildTimeOptions,
  clockOf,
  formatDurationText,
  minutesToTime,
  parseApiDate,
  parseTimeToMinutes,
  parseVenueOpenClose
} from '@/utils/study/format'
import {
  AUTO_RESERVE_WEEKDAYS,
  TIME_STEP_MINUTES
} from '@/utils/study/constants'
import { useLatestRequest } from '@/composables/study/useLatestRequest'
import { useVenueOptions } from '@/composables/study/useVenueOptions'

const props = defineProps({
  visible: { type: Boolean, default: false },
  task: { type: Object, default: null }
})

const emit = defineEmits(['update:visible', 'saved'])

const store = useStudyStore()

const ALL_WEEK_DAYS = AUTO_RESERVE_WEEKDAYS.map(day => day.value)

const editingId = ref(null)
const formRef = ref(null)
const saving = ref(false)
const form = reactive({
  venueId: null,
  startTime: '',
  endTime: '',
  weekDays: [...ALL_WEEK_DAYS],
  areaId: null,
  areaName: '',
  seatId: 0,
  seatNumber: '',
  seatAreaId: null,
  seatAreaName: ''
})

const { venues: venueList, loading: venueLoading, load: loadVenueOptions } = useVenueOptions()
const venueDetail = ref(null)
const venueDetailLoading = ref(false)
const baseOpen = ref('00:00')
const baseClose = ref('23:59')
const areaList = ref([])
const areaLoading = ref(false)
const areaError = ref('')
const areaNote = ref('')
let areaVenueId = null
const areaRequest = useLatestRequest()
const venueRequest = useLatestRequest()
const initRequest = useLatestRequest()

const pickerVisible = ref(false)

const rules = {
  venueId: [{ required: true, message: '请选择门店', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [
    { required: true, message: '请选择结束时间', trigger: 'change' },
    {
      validator: (rule, value, callback) => {
        const start = parseTimeToMinutes(form.startTime)
        const end = parseTimeToMinutes(value)
        if (start !== null && end !== null && end <= start) {
          callback(new Error('结束时间需晚于开始时间'))
          return
        }
        callback()
      },
      trigger: 'change'
    }
  ],
  weekDays: [
    {
      validator: (rule, value, callback) => {
        if (Array.isArray(value) && value.length) {
          callback()
          return
        }
        callback(new Error('至少选择一个执行星期'))
      },
      trigger: 'change'
    }
  ]
}

const formTimeOptions = computed(() => buildTimeOptions(baseOpen.value, baseClose.value, TIME_STEP_MINUTES))

const startTimeOptions = computed(() => {
  const closeMin = parseTimeToMinutes(baseClose.value)
  return formTimeOptions.value.filter(time => {
    const value = parseTimeToMinutes(time)
    return value !== null && (closeMin === null || value < closeMin)
  })
})

const endTimeOptions = computed(() => {
  const startMin = parseTimeToMinutes(form.startTime)
  if (startMin === null) {
    return formTimeOptions.value
  }
  return formTimeOptions.value.filter(time => {
    const value = parseTimeToMinutes(time)
    return value !== null && value > startMin
  })
})

const formDurationText = computed(() => {
  const start = parseTimeToMinutes(form.startTime)
  const end = parseTimeToMinutes(form.endTime)
  return start !== null && end !== null && end > start ? formatDurationText(end - start) : ''
})

const formOpenCloseText = computed(() => {
  const open = clockOf(baseOpen.value)
  const close = clockOf(baseClose.value)
  return open && close && !(open === '00:00' && close === '23:59') ? `${open} – ${close}` : ''
})

// 指定座位与偏好区域可以同时设置，按此顺序逐级降级
const seatPreferenceChain = computed(() => {
  const parts = []
  if (Number(form.seatId) > 0) {
    parts.push(`座位 ${form.seatNumber || form.seatId}`)
  }
  if (form.areaId) {
    parts.push(`区域 ${form.areaName || form.areaId}`)
  }
  parts.push('全场任选')
  return parts.join(' → ')
})

const seatAreaFallbackHint = computed(
  () => Number(form.seatId) > 0 && Number(form.seatAreaId) > 0 && Number(form.seatAreaId) !== Number(form.areaId)
)

const pickedSeat = computed(() => (
  Number(form.seatId) > 0
    ? {
        id: form.seatId,
        seatNumber: form.seatNumber,
        areaId: form.seatAreaId,
        areaName: form.seatAreaName
      }
    : null
))

function resetForm() {
  Object.assign(form, {
    venueId: null,
    startTime: '',
    endTime: '',
    weekDays: [...ALL_WEEK_DAYS],
    areaId: null,
    areaName: '',
    seatId: 0,
    seatNumber: '',
    seatAreaId: null,
    seatAreaName: ''
  })
  venueDetail.value = null
  venueDetailLoading.value = false
  venueRequest.invalidate()
  baseOpen.value = '00:00'
  baseClose.value = '23:59'
  clearAreaOptions()
}

async function ensureVenueOptions() {
  if (venueList.value.length || venueLoading.value) {
    return
  }
  try {
    await loadVenueOptions()
  } catch (e) {
    store.handleApiError(e)
  }
}

/**
 * 偏好区域取自门店座位图的 venueAreaList，区域 ID 与后端抢座时匹配的一致。
 * 座位图接口必须带日期与时段，这里用最远可约日期和当前时段探测一次。
 */
async function ensureAreaOptions(venueId, { force = false } = {}) {
  if (!venueId) {
    return
  }
  if (!force && Number(areaVenueId) === Number(venueId) && areaList.value.length) {
    return
  }
  if (!force && areaLoading.value && Number(areaVenueId) === Number(venueId)) {
    return
  }
  const seq = areaRequest.next()
  areaVenueId = Number(venueId)
  areaLoading.value = true
  areaError.value = ''
  areaNote.value = ''
  areaList.value = []
  try {
    const dateRes = await studyReserveApi.dateSelect(venueId)
    if (!areaRequest.isLatest(seq)) {
      return
    }
    const dates = (dateRes?.data?.reserveDateList || []).map(parseApiDate).filter(Boolean)
    if (!dates.length) {
      areaError.value = '该门店暂无可预约日期，暂时无法读取区域。'
      return
    }
    const latest = dates[dates.length - 1]
    const res = await studyReserveApi.seatList({
      venueId,
      reserveDateStr: latest.value,
      reserveStartTimeStr: form.startTime || baseOpen.value,
      reserveEndTimeStr: form.endTime || baseClose.value,
      reserveAnotherFlag: 0
    })
    if (!areaRequest.isLatest(seq)) {
      return
    }
    const areas = (res?.data?.venueAreaList || [])
      .filter(area => area && area.id)
      .map(area => ({
        id: area.id,
        areaName: area.areaName || `区域 ${area.id}`,
        seatCount: (area.venueAreaSeatList || []).length
      }))
    if (!areas.length) {
      areaNote.value = '该门店暂无区域信息，可选择「不指定」。'
    }
    // 编辑历史任务时，上游区域可能已调整，保留已保存的区域以便展示
    if (
      form.areaId &&
      !areas.some(area => Number(area.id) === Number(form.areaId))
    ) {
      areas.unshift({
        id: form.areaId,
        areaName: form.areaName || `区域 ${form.areaId}`,
        seatCount: 0
      })
    }
    areaList.value = areas
  } catch (e) {
    if (!areaRequest.isLatest(seq)) {
      return
    }
    if (store.handleApiError(e, { openBind: true })) {
      areaError.value = e?.msg || '小程序 token 已失效，请重新绑定后再试。'
      return
    }
    areaError.value = e?.msg || '区域读取失败，请稍后重试。'
  } finally {
    if (areaRequest.isLatest(seq)) {
      areaLoading.value = false
    }
  }
}

function retryAreas() {
  ensureAreaOptions(form.venueId, { force: true })
}

function clearAreaOptions() {
  areaRequest.invalidate()
  areaVenueId = null
  areaList.value = []
  areaLoading.value = false
  areaError.value = ''
  areaNote.value = ''
}

function defaultSlot() {
  const openMin = parseTimeToMinutes(baseOpen.value)
  const closeMin = parseTimeToMinutes(baseClose.value)
  const fallback = { start: '10:00', end: '17:00' }
  if (openMin === null || closeMin === null || closeMin - openMin < TIME_STEP_MINUTES) {
    return fallback
  }
  let start = Math.max(openMin, 10 * 60)
  if (start >= closeMin) {
    start = openMin
  }
  let end = Math.min(closeMin, start + 5 * 60)
  if (end <= start) {
    end = Math.min(closeMin, start + 60)
  }
  if (end <= start) {
    end = closeMin
  }
  return { start: minutesToTime(start) || fallback.start, end: minutesToTime(end) || fallback.end }
}

async function loadFormVenue(venueId, { keepTimes = false } = {}) {
  venueDetail.value = null
  if (!venueId) {
    return
  }
  const seq = venueRequest.next()
  venueDetailLoading.value = true
  try {
    const res = await studyVenueApi.reserveDetail(venueId)
    if (!venueRequest.isLatest(seq)) {
      return
    }
    venueDetail.value = res?.data || null
    const openClose = parseVenueOpenClose(venueDetail.value)
    baseOpen.value = openClose.open || '00:00'
    baseClose.value = openClose.close || '23:59'
    if (!keepTimes || !form.startTime || !form.endTime) {
      const slot = defaultSlot()
      form.startTime = slot.start
      form.endTime = slot.end
      clearSeatSelection()
    }
  } catch (e) {
    if (!venueRequest.isLatest(seq)) {
      return
    }
    baseOpen.value = '00:00'
    baseClose.value = '23:59'
    if (!keepTimes) {
      form.startTime = '10:00'
      form.endTime = '17:00'
      clearSeatSelection()
    }
    store.handleApiError(e, { openBind: true })
  } finally {
    if (venueRequest.isLatest(seq)) {
      venueDetailLoading.value = false
    }
  }
}

async function prepareCreate() {
  const seq = initRequest.next()
  editingId.value = null
  pickerVisible.value = false
  resetForm()
  await ensureVenueOptions()
  if (!initRequest.isLatest(seq)) {
    return
  }

  const preferred = store.lastVenueId
    ? venueList.value.find(venue => Number(venue.id) === Number(store.lastVenueId))
    : null
  if (preferred) {
    form.venueId = preferred.id
    await loadFormVenue(preferred.id)
    if (!initRequest.isLatest(seq)) {
      return
    }
    await ensureAreaOptions(preferred.id)
  }
}

async function fillForm(task) {
  const seq = initRequest.next()
  editingId.value = task.id
  pickerVisible.value = false
  resetForm()
  form.venueId = task.venueId
  form.startTime = task.reserveStartTime || ''
  form.endTime = task.reserveEndTime || ''
  const normalizedDays = (Array.isArray(task.weekDays) ? task.weekDays : [])
    .map(day => Number(day))
    .filter(day => ALL_WEEK_DAYS.includes(day))
  form.weekDays = normalizedDays.length ? normalizedDays : [...ALL_WEEK_DAYS]
  // 指定座位与偏好区域可同时存在，编辑时原样回填
  if (Number(task.seatId) > 0) {
    form.seatId = task.seatId
    form.seatNumber = task.seatNumber || ''
  }
  if (Number(task.areaId) > 0) {
    form.areaId = task.areaId
    form.areaName = task.areaName || ''
  }
  await ensureVenueOptions()
  if (!initRequest.isLatest(seq)) {
    return
  }
  // 任务门店可能已被预约页的过滤器隐藏，编辑时仍要能正常显示
  if (task.venueId && !venueList.value.some(venue => Number(venue.id) === Number(task.venueId))) {
    venueList.value.unshift({
      id: task.venueId,
      venueName: task.venueName || `门店 ${task.venueId}`
    })
  }
  await loadFormVenue(task.venueId, { keepTimes: true })
  if (!initRequest.isLatest(seq)) {
    return
  }
  await ensureAreaOptions(task.venueId)
}

async function onFormVenueChange(venueId) {
  clearSeatSelection()
  form.areaId = null
  form.areaName = ''
  clearAreaOptions()
  if (venueId) {
    store.rememberVenue(venueId)
    await loadFormVenue(venueId)
    await ensureAreaOptions(venueId)
  }
}

function onFormStartChange() {
  const startMin = parseTimeToMinutes(form.startTime)
  const endMin = parseTimeToMinutes(form.endTime)
  if (startMin === null) {
    return
  }
  if (endMin === null || endMin <= startMin) {
    const next = endTimeOptions.value.find(time => {
      const value = parseTimeToMinutes(time)
      return value !== null && value > startMin
    })
    form.endTime = next || ''
  }
  if (formRef.value) {
    formRef.value.validateField('endTime').catch(() => null)
  }
}

function onFormEndChange() {
  if (formRef.value) {
    formRef.value.validateField('endTime').catch(() => null)
  }
}

function onAreaChange(areaId) {
  const matched = areaList.value.find(area => Number(area.id) === Number(areaId))
  form.areaName = matched ? matched.areaName || '' : ''
  if (formRef.value) {
    formRef.value.validateField('areaId').catch(() => null)
  }
}

function applySeatAreaAsPreferred() {
  const areaId = Number(form.seatAreaId)
  if (!(areaId > 0)) {
    return
  }
  const matched = areaList.value.find(area => Number(area.id) === areaId)
  form.areaId = areaId
  form.areaName = matched ? matched.areaName || '' : form.seatAreaName || ''
  if (formRef.value) {
    formRef.value.validateField('areaId').catch(() => null)
  }
}

function clearSeatSelection() {
  form.seatId = 0
  form.seatNumber = ''
  form.seatAreaId = null
  form.seatAreaName = ''
}

function onPickerClear() {
  clearSeatSelection()
  if (formRef.value) {
    formRef.value.clearValidate('seatId')
  }
}

function openSeatPicker() {
  if (!form.venueId || !form.startTime || !form.endTime) {
    ElMessage.warning('请先选择门店和时段')
    return
  }
  pickerVisible.value = true
}

function applyPickedSeat(seat) {
  form.seatId = seat.id
  form.seatNumber = seat.seatNumber || ''
  form.seatAreaId = seat.areaId || null
  form.seatAreaName = seat.areaName || ''
  if (formRef.value) {
    formRef.value.clearValidate('seatId')
  }
}

async function saveTask() {
  if (saving.value) {
    return
  }
  if (!store.requireToken()) {
    return
  }

  let valid = false
  if (formRef.value) {
    try {
      valid = await formRef.value.validate()
    } catch (e) {
      valid = false
    }
  }
  if (!valid) {
    return
  }

  const start = parseTimeToMinutes(form.startTime)
  const end = parseTimeToMinutes(form.endTime)
  if (start === null || end === null || end <= start) {
    ElMessage.warning('结束时间需晚于开始时间')
    return
  }

  const payload = {
    venueId: Number(form.venueId),
    seatId: Number(form.seatId) > 0 ? Number(form.seatId) : 0,
    seatNumber: Number(form.seatId) > 0 ? form.seatNumber || '' : '',
    areaId: form.areaId ? Number(form.areaId) : 0,
    areaName: form.areaId ? form.areaName || '' : '',
    reserveStartTime: form.startTime,
    reserveEndTime: form.endTime,
    weekDays: [...form.weekDays].sort((a, b) => a - b)
  }

  saving.value = true
  try {
    if (editingId.value) {
      await studyAutoReserveApi.updateTask(editingId.value, payload)
      ElMessage.success('任务已更新')
    } else {
      await studyAutoReserveApi.createTask(payload)
      ElMessage.success('任务已创建')
    }
    emit('update:visible', false)
    emit('saved')
  } catch (e) {
    if (store.handleApiError(e, { openBind: true })) {
      emit('update:visible', false)
    }
  } finally {
    saving.value = false
  }
}

watch(
  () => props.visible,
  visible => {
    if (!visible) {
      initRequest.invalidate()
      venueRequest.invalidate()
      areaRequest.invalidate()
      pickerVisible.value = false
      return
    }
    if (props.task) {
      fillForm(props.task)
    } else {
      prepareCreate()
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.ar-form-hint {
  margin: -10px 0 16px;
  color: var(--sr-muted);
  font-size: 11px;
  line-height: 1.6;

  &.in-item {
    width: 100%;
    margin: 6px 0 0;
  }

  &.is-error {
    color: #a64035;
  }
}

/* 选项内容会被渲染到 body 下的下拉浮层，使用字面量颜色 */
.ar-area-count {
  float: right;
  margin-left: 12px;
  color: #75827a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.ar-form-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0 14px;
}

.ar-week-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;

  :deep(.el-checkbox-button__inner) {
    border: 1px solid var(--sr-line);
    border-radius: 7px;
    padding: 6px 11px;
    font-size: 12px;
    box-shadow: none;
  }

  :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
    border-color: var(--sr-green);
    background: var(--sr-green);
    color: #fff;
  }
}

.ar-seat-picked {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

@media (max-width: 640px) {
  .ar-form-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
