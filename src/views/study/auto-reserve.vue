<template>
  <StudyShell>
    <div class="auto-reserve-page">
      <header class="sr-page-head">
        <div>
          <p class="sr-eyebrow">自习室 · 自动预约</p>
          <h1 class="sr-title">自动预约</h1>
          <p class="sr-sub">按放号时刻自动抢座；只在勾选的星期执行，冲突或没有新放号日期时本轮记为失败。</p>
        </div>
        <div class="sr-actions">
          <span v-if="releaseTime" class="sr-updated">
            放号时刻 <span class="sr-mono">{{ releaseTime }}</span>
          </span>
          <el-button @click="goSetting">
            <el-icon><Setting /></el-icon>
            放号配置
          </el-button>
          <el-button :loading="loading" @click="reloadAll">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
          <el-button type="primary" :disabled="!store.isTokenValid" @click="openCreate">
            <el-icon><Plus /></el-icon>
            新建任务
          </el-button>
        </div>
      </header>

      <div class="ar-tip sr-note" role="note">
        <el-icon><InfoFilled /></el-icon>
        <span v-if="releaseTime">
          每天 <strong class="sr-mono">{{ releaseTime }}</strong> 触发启用中的任务；小程序 token 失效时任务会自动暂停，重新绑定后需手动恢复。
        </span>
        <span v-else>
          还没有读取到放号时刻，<el-button link type="primary" @click="goSetting">先去配置</el-button>后再创建任务。
        </span>
      </div>

      <section v-if="loadError" class="sr-card ar-feedback" role="alert">
        <div class="sr-empty">
          <el-empty :description="loadError" :image-size="56" />
          <el-button type="primary" @click="reloadAll">重新加载</el-button>
        </div>
      </section>

      <template v-else>
        <section class="ar-list" v-loading="loading">
          <div v-if="tasks.length" class="ar-task-grid">
            <article
              v-for="task in tasks"
              :key="task.id"
              class="sr-card ar-task"
              :class="{ 'is-paused': !isEnabled(task) }"
            >
              <div class="ar-task-head">
                <div class="ar-task-identity">
                  <h2 class="ar-task-venue">{{ task.venueName || '未命名门店' }}</h2>
                  <p class="ar-task-time sr-mono">{{ task.reserveStartTime }} – {{ task.reserveEndTime }}</p>
                </div>
                <span class="sr-chip" :class="taskChipClass(task)">
                  <span class="sr-dot"></span>{{ isEnabled(task) ? '启用中' : '已暂停' }}
                </span>
              </div>

              <div
                class="ar-task-week"
                role="group"
                :aria-label="'执行星期：' + weekDaySummary(task.weekDays)"
              >
                <span
                  v-for="day in AUTO_RESERVE_WEEKDAYS"
                  :key="day.value"
                  class="ar-day"
                  :class="{ 'is-on': isDayOn(task, day.value) }"
                  :title="day.label"
                >{{ day.label }}</span>
              </div>

              <div class="ar-task-meta">
                <div class="sr-kv">
                  <span class="sr-kv-key">选座偏好</span>
                  <span class="sr-kv-value">{{ seatPreferenceText(task) }}</span>
                </div>
                <div class="sr-kv">
                  <span class="sr-kv-key">放号基线</span>
                  <span class="sr-kv-value sr-mono">{{ task.lastMaxReserveDate || '—' }}</span>
                </div>
                <div class="sr-kv">
                  <span class="sr-kv-key">创建时间</span>
                  <span class="sr-kv-value sr-mono">{{ task.createTime || '—' }}</span>
                </div>
              </div>

              <p v-if="pauseText(task)" class="ar-task-pause" :class="{ 'is-danger': task.pauseReason === 'TOKEN' }">
                {{ pauseText(task) }}
              </p>

              <div class="ar-task-actions">
                <el-button size="small" @click="openRecords(task)">执行记录</el-button>
                <el-button
                  size="small"
                  type="primary"
                  plain
                  :loading="executingId === task.id"
                  :disabled="!isEnabled(task) || !store.isTokenValid"
                  @click="executeTask(task)"
                >
                  立即执行
                </el-button>
                <el-button
                  size="small"
                  :loading="actionLoadingId === task.id"
                  :disabled="!store.isTokenValid"
                  @click="toggleTask(task)"
                >{{ isEnabled(task) ? '暂停' : '恢复' }}</el-button>
                <el-dropdown trigger="click" @command="command => onTaskCommand(command, task)">
                  <el-button size="small">
                    更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit">
                        <el-icon><Edit /></el-icon>编辑任务
                      </el-dropdown-item>
                      <el-dropdown-item command="delete" divided>
                        <el-icon><Delete /></el-icon>删除任务
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </article>
          </div>

          <div v-else-if="loaded" class="sr-card ar-feedback">
            <div class="sr-empty">
              <el-empty description="还没有自动预约任务" :image-size="64" />
              <p class="ar-empty-hint">创建任务后，系统会在每天的放号时刻为你抢座。</p>
              <el-button type="primary" :disabled="!store.isTokenValid" @click="openCreate">新建第一个任务</el-button>
            </div>
          </div>
        </section>

        <div v-if="total > pageSize" class="ar-pagination">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :total="total"
            :page-size="pageSize"
            :current-page="pageNum"
            @current-change="onPageChange"
          />
        </div>
      </template>
    </div>

    <!-- 新建 / 编辑任务 -->
    <el-dialog
      v-model="formVisible"
      class="sr-dialog ar-form-dialog"
      :title="editingId ? '编辑自动预约任务' : '新建自动预约任务'"
      width="min(720px, 94vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
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
          <el-button :disabled="saving" @click="formVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveTask">
            {{ editingId ? '保存修改' : '创建任务' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 座位选择 -->
    <el-dialog
      v-model="pickerVisible"
      class="sr-dialog ar-picker-dialog"
      title="选择优先座位"
      width="min(880px, 96vw)"
      :close-on-click-modal="false"
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
          <el-button v-if="form.seatId" @click="clearPickerDraft">清除指定座位</el-button>
          <el-button @click="pickerVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!pickerDraft" @click="confirmPicker">确定选择</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 执行记录 -->
    <el-dialog
      v-model="recordsVisible"
      class="sr-dialog ar-records-dialog"
      :title="recordsTitle"
      width="min(960px, 96vw)"
    >
      <div class="ar-records-head">
        <div class="ar-records-summary">
          <span v-if="recordsTask" class="sr-chip sr-chip-muted">
            <span class="sr-dot"></span>{{ recordsTask.venueName || '门店' }}
          </span>
          <span v-if="recordsTask" class="sr-mono">{{ recordsTask.reserveStartTime }} – {{ recordsTask.reserveEndTime }}</span>
          <span class="ar-records-count">共 {{ recordTotal }} 条记录</span>
        </div>
        <el-button size="small" :loading="recordLoading" @click="loadRecords(recordPage)">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>

      <div v-if="recordsError" class="ar-records-error" role="alert">
        <span>{{ recordsError }}</span>
        <el-button size="small" @click="loadRecords(recordPage)">重试</el-button>
      </div>

      <el-table
        v-else
        v-loading="recordLoading"
        :data="records"
        size="small"
        empty-text="暂无执行记录"
        class="ar-records-table"
      >
        <el-table-column label="执行时间" width="158">
          <template #default="{ row }"><span class="ar-mono">{{ row.createTime || '—' }}</span></template>
        </el-table-column>
        <el-table-column label="目标日期" width="106">
          <template #default="{ row }"><span class="ar-mono">{{ row.targetDate || '—' }}</span></template>
        </el-table-column>
        <el-table-column label="触发" width="84">
          <template #default="{ row }">{{ triggerTypeText(row.triggerType) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <span class="sr-chip" :class="recordChipClass(row.status)">
              <span class="sr-dot"></span>{{ recordStatusText(row.status) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="座位" width="96">
          <template #default="{ row }"><span class="ar-mono">{{ row.seatNumber || '—' }}</span></template>
        </el-table-column>
        <el-table-column label="时段" width="124">
          <template #default="{ row }"><span class="ar-mono">{{ row.timeRange || '—' }}</span></template>
        </el-table-column>
        <el-table-column label="说明" min-width="190">
          <template #default="{ row }">
            <span :class="{ 'ar-fail-msg': !!row.failMsg }">{{ row.failMsg || '—' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="recordTotal > recordPageSize" class="ar-records-pagination">
        <el-pagination
          small
          background
          layout="prev, pager, next"
          :total="recordTotal"
          :page-size="recordPageSize"
          :current-page="recordPage"
          @current-change="loadRecords"
        />
      </div>
    </el-dialog>
  </StudyShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import StudyShell from './components/study-shell.vue'
import { studyAutoReserveApi, studyReserveApi, studyVenueApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import {
  buildTimeOptions,
  clockOf,
  formatDurationText,
  getSeatDisplayState,
  minutesToTime,
  parseApiDate,
  parseTimeToMinutes,
  parseVenueOpenClose
} from '@/utils/study/format'
import {
  AUTO_RESERVE_ENABLE_STATUS,
  AUTO_RESERVE_RECORD_STATUS,
  AUTO_RESERVE_TRIGGER_TYPE,
  AUTO_RESERVE_WEEKDAYS,
  PAGE_PATH,
  SEAT_STATE,
  TIME_STEP_MINUTES
} from '@/utils/study/constants'
import { useLatestRequest } from '@/composables/study/useLatestRequest'
import { useStudyRefresh } from '@/composables/study/useStudyRefresh'
import { useVenueOptions } from '@/composables/study/useVenueOptions'

const store = useStudyStore()
const router = useRouter()

const ALL_WEEK_DAYS = AUTO_RESERVE_WEEKDAYS.map(day => day.value)

/* ---------- 任务列表 ---------- */
const tasks = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')
const releaseTime = ref('')
const executingId = ref(null)
const actionLoadingId = ref(null)

const listRequest = useLatestRequest()
const recordRequest = useLatestRequest()
const venueRequest = useLatestRequest()

/* ---------- 任务表单 ---------- */
const formVisible = ref(false)
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

/* ---------- 座位选择 ---------- */
const pickerVisible = ref(false)
const pickerLoading = ref(false)
const pickerError = ref('')
const pickerDate = ref('')
const pickerAreas = ref([])
const pickerKeyword = ref('')
const pickerDraft = ref(null)

/* ---------- 执行记录 ---------- */
const recordsVisible = ref(false)
const recordsTask = ref(null)
const records = ref([])
const recordTotal = ref(0)
const recordPage = ref(1)
const recordPageSize = ref(10)
const recordLoading = ref(false)
const recordsError = ref('')

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

const recordsTitle = computed(() =>
  recordsTask.value ? `执行记录 · ${recordsTask.value.venueName || '门店'}` : '执行记录'
)

function isEnabled(task) {
  return Number(task?.enableStatus) === AUTO_RESERVE_ENABLE_STATUS.ENABLED
}

function taskChipClass(task) {
  if (isEnabled(task)) {
    return 'sr-chip-green'
  }
  return task?.pauseReason === 'TOKEN' ? 'sr-chip-danger' : 'sr-chip-amber'
}

function isDayOn(task, value) {
  return Array.isArray(task?.weekDays) && task.weekDays.some(day => Number(day) === Number(value))
}

function weekDayLabels(days) {
  const values = (Array.isArray(days) ? days : [])
    .map(day => Number(day))
    .filter(day => AUTO_RESERVE_WEEKDAYS.some(item => item.value === day))
    .sort((a, b) => a - b)
  return values.map(value => AUTO_RESERVE_WEEKDAYS.find(item => item.value === value).label)
}

function weekDaySummary(days) {
  const labels = weekDayLabels(days)
  if (!labels.length) {
    return '未设置'
  }
  if (labels.length === 7) {
    return '每天'
  }
  if (labels.join('、') === '周一、周二、周三、周四、周五') {
    return '工作日'
  }
  if (labels.join('、') === '周六、周日') {
    return '周末'
  }
  return labels.join('、')
}

function seatPreferenceText(task) {
  const parts = []
  if (Number(task?.seatId) > 0) {
    parts.push(`座位 ${task.seatNumber || task.seatId}`)
  }
  if (Number(task?.areaId) > 0) {
    parts.push(`区域 ${task.areaName || task.areaId}`)
  }
  if (!parts.length) {
    return '全馆任意可用座位'
  }
  return parts.length > 1 ? `${parts.join(' → ')}（依次优先）` : `${parts[0]}（优先）`
}

function pauseText(task) {
  if (!task || isEnabled(task)) {
    return ''
  }
  if (task.pauseReason === 'TOKEN') {
    return '小程序 token 失效，任务已自动暂停；重新绑定 token 后请手动恢复。'
  }
  return task.pauseReason ? `暂停原因：${task.pauseReason}` : ''
}

function recordChipClass(status) {
  const value = Number(status)
  if (value === AUTO_RESERVE_RECORD_STATUS.SUCCESS) {
    return 'sr-chip-green'
  }
  if (value === AUTO_RESERVE_RECORD_STATUS.FAILED) {
    return 'sr-chip-danger'
  }
  if (value === AUTO_RESERVE_RECORD_STATUS.SKIPPED) {
    return 'sr-chip-muted'
  }
  return 'sr-chip-muted'
}

function triggerTypeText(triggerType) {
  const value = Number(triggerType)
  if (value === AUTO_RESERVE_TRIGGER_TYPE.SCHEDULED) {
    return '定时执行'
  }
  if (value === AUTO_RESERVE_TRIGGER_TYPE.MANUAL) {
    return '手动执行'
  }
  return '—'
}

function recordStatusText(status) {
  const value = Number(status)
  if (value === AUTO_RESERVE_RECORD_STATUS.SUCCESS) {
    return '成功'
  }
  if (value === AUTO_RESERVE_RECORD_STATUS.FAILED) {
    return '失败'
  }
  if (value === AUTO_RESERVE_RECORD_STATUS.SKIPPED) {
    return '跳过'
  }
  return '—'
}

/* ---------- 列表加载 ---------- */
async function loadTasks({ quiet = false } = {}) {
  if (!store.isTokenValid) {
    return
  }
  const seq = listRequest.next()
  if (!quiet) {
    loading.value = true
  }
  loadError.value = ''
  try {
    const res = await studyAutoReserveApi.taskList({ pageNum: pageNum.value, pageSize: pageSize.value })
    if (!listRequest.isLatest(seq)) {
      return
    }
    tasks.value = Array.isArray(res?.rows) ? res.rows : []
    total.value = Number(res?.total) || 0
    loaded.value = true
    // 当前页被删空时回退一页
    if (!tasks.value.length && pageNum.value > 1) {
      pageNum.value -= 1
      await loadTasks({ quiet })
    }
  } catch (e) {
    if (!listRequest.isLatest(seq)) {
      return
    }
    if (store.handleApiError(e, { openBind: true })) {
      return
    }
    tasks.value = []
    total.value = 0
    loadError.value = e?.msg || '任务加载失败，请稍后重试。'
  } finally {
    if (listRequest.isLatest(seq)) {
      loading.value = false
    }
  }
}

async function loadReleaseTime() {
  try {
    const res = await studyAutoReserveApi.setting()
    releaseTime.value = clockOf(res?.data?.releaseTime) || ''
  } catch (e) {
    releaseTime.value = ''
  }
}

function reloadAll() {
  if (!store.requireToken()) {
    return
  }
  loadTasks()
  loadReleaseTime()
}

function onPageChange(page) {
  pageNum.value = page
  loadTasks()
}

/* ---------- 任务操作 ---------- */
async function executeTask(task) {
  if (!store.requireToken()) {
    return
  }
  if (!isEnabled(task)) {
    ElMessage.warning('任务已暂停，请先恢复')
    return
  }
  try {
    await ElMessageBox.confirm(
      '立即执行会马上发起一次抢座，最长约 1 分钟，结果写入执行记录。确定继续？',
      '立即执行',
      { confirmButtonText: '开始抢座', cancelButtonText: '取消', type: 'warning', customClass: 'sr-message-box' }
    )
  } catch (e) {
    return
  }

  executingId.value = task.id
  try {
    await studyAutoReserveApi.executeTask(task.id)
    ElMessage.success('已执行，可在「执行记录」查看结果')
    await loadTasks({ quiet: true })
    if (recordsVisible.value && recordsTask.value?.id === task.id) {
      loadRecords(recordPage.value)
    }
  } catch (e) {
    store.handleApiError(e, { openBind: true })
  } finally {
    executingId.value = null
  }
}

async function toggleTask(task) {
  if (!store.requireToken()) {
    return
  }
  actionLoadingId.value = task.id
  try {
    if (isEnabled(task)) {
      await studyAutoReserveApi.pauseTask(task.id)
      ElMessage.success('任务已暂停')
    } else {
      await studyAutoReserveApi.resumeTask(task.id)
      ElMessage.success('任务已恢复')
    }
    await loadTasks({ quiet: true })
  } catch (e) {
    store.handleApiError(e, { openBind: true })
  } finally {
    actionLoadingId.value = null
  }
}

async function removeTask(task) {
  try {
    await ElMessageBox.confirm(
      `删除后「${task.venueName || '该门店'}」的任务及全部执行记录会一并删除，且无法恢复。`,
      '删除任务',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning', customClass: 'sr-message-box' }
    )
  } catch (e) {
    return
  }

  try {
    await studyAutoReserveApi.removeTask(task.id)
    ElMessage.success('任务已删除')
    if (recordsTask.value?.id === task.id) {
      recordsVisible.value = false
      recordsTask.value = null
    }
    await loadTasks()
  } catch (e) {
    store.handleApiError(e, { openBind: true })
  }
}

function onTaskCommand(command, task) {
  if (command === 'edit') {
    openEdit(task)
  } else if (command === 'delete') {
    removeTask(task)
  }
}

/* ---------- 表单 ---------- */
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

async function openCreate() {
  if (!store.requireToken()) {
    return
  }
  editingId.value = null
  resetForm()
  formVisible.value = true
  await ensureVenueOptions()

  const preferred = store.lastVenueId
    ? venueList.value.find(venue => Number(venue.id) === Number(store.lastVenueId))
    : null
  if (preferred) {
    form.venueId = preferred.id
    await loadFormVenue(preferred.id)
    await ensureAreaOptions(preferred.id)
  }
}

async function openEdit(task) {
  editingId.value = task.id
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
  formVisible.value = true
  await ensureVenueOptions()
  // 任务门店可能已被预约页的过滤器隐藏，编辑时仍要能正常显示
  if (task.venueId && !venueList.value.some(venue => Number(venue.id) === Number(task.venueId))) {
    venueList.value.unshift({
      id: task.venueId,
      venueName: task.venueName || `门店 ${task.venueId}`
    })
  }
  await loadFormVenue(task.venueId, { keepTimes: true })
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
    formVisible.value = false
    await loadTasks()
    loadReleaseTime()
  } catch (e) {
    if (store.handleApiError(e, { openBind: true })) {
      formVisible.value = false
    }
  } finally {
    saving.value = false
  }
}

/* ---------- 座位图 ---------- */
function isSeatFreeNow(seat) {
  return getSeatDisplayState(seat, form.startTime, form.endTime).selectable
}

async function openSeatPicker() {
  if (!form.venueId || !form.startTime || !form.endTime) {
    ElMessage.warning('请先选择门店和时段')
    return
  }
  pickerKeyword.value = ''
  pickerDraft.value = Number(form.seatId) > 0
    ? {
        id: form.seatId,
        seatNumber: form.seatNumber,
        areaId: form.seatAreaId,
        areaName: form.seatAreaName
      }
    : null
  pickerVisible.value = true
  await loadPickerSeats()
}

async function loadPickerSeats() {
  pickerLoading.value = true
  pickerError.value = ''
  pickerAreas.value = []
  pickerDate.value = ''
  try {
    const dateRes = await studyReserveApi.dateSelect(form.venueId)
    const dates = (dateRes?.data?.reserveDateList || []).map(parseApiDate).filter(Boolean)
    if (!dates.length) {
      pickerError.value = '该门店暂无可预约日期，暂时无法加载座位图。'
      return
    }
    const latest = dates[dates.length - 1]
    pickerDate.value = latest.value

    const res = await studyReserveApi.seatList({
      venueId: form.venueId,
      reserveDateStr: latest.value,
      reserveStartTimeStr: form.startTime,
      reserveEndTimeStr: form.endTime,
      reserveAnotherFlag: 0
    })

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
    if (store.handleApiError(e, { openBind: true })) {
      pickerError.value = e?.msg || '小程序 token 已失效，请重新绑定后再试。'
      return
    }
    pickerError.value = e?.msg || '座位图加载失败，请稍后重试。'
  } finally {
    pickerLoading.value = false
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
  clearSeatSelection()
  if (formRef.value) {
    formRef.value.clearValidate('seatId')
  }
}

function confirmPicker() {
  if (!pickerDraft.value) {
    ElMessage.warning('请选择一个座位')
    return
  }
  form.seatId = pickerDraft.value.id
  form.seatNumber = pickerDraft.value.seatNumber || ''
  form.seatAreaId = pickerDraft.value.areaId || null
  form.seatAreaName = pickerDraft.value.areaName || ''
  pickerVisible.value = false
  if (formRef.value) {
    formRef.value.clearValidate('seatId')
  }
}

/* ---------- 执行记录 ---------- */
async function openRecords(task) {
  recordsTask.value = task
  recordPage.value = 1
  records.value = []
  recordTotal.value = 0
  recordsError.value = ''
  recordsVisible.value = true
  await loadRecords(1)
}

async function loadRecords(page = recordPage.value) {
  if (!recordsTask.value) {
    return
  }
  const seq = recordRequest.next()
  const taskId = recordsTask.value.id
  recordLoading.value = true
  recordsError.value = ''
  try {
    const res = await studyAutoReserveApi.recordList(taskId, {
      pageNum: page,
      pageSize: recordPageSize.value
    })
    if (!recordRequest.isLatest(seq)) {
      return
    }
    records.value = Array.isArray(res?.rows) ? res.rows : []
    recordTotal.value = Number(res?.total) || 0
    recordPage.value = page
  } catch (e) {
    if (!recordRequest.isLatest(seq)) {
      return
    }
    if (store.handleApiError(e, { openBind: true })) {
      recordsError.value = e?.msg || '小程序 token 已失效，请重新绑定后再试。'
      return
    }
    records.value = []
    recordTotal.value = 0
    recordsError.value = e?.msg || '执行记录加载失败，请稍后重试。'
  } finally {
    if (recordRequest.isLatest(seq)) {
      recordLoading.value = false
    }
  }
}

function goSetting() {
  router.push(PAGE_PATH.AUTO_RESERVE_SETTING)
}

useStudyRefresh(() => {
  pageNum.value = 1
  loadTasks()
  loadReleaseTime()
})

onMounted(() => {
  store.ensureStatus()
})
</script>

<style lang="scss" scoped>
.auto-reserve-page {
  min-width: 0;
}

.ar-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 16px;

  .el-icon {
    flex: none;
    margin-top: 1px;
    color: var(--sr-green-2);
    font-size: 14px;
  }

  strong {
    font-weight: 600;
    color: var(--sr-green-ink);
  }
}

.ar-list {
  min-height: 220px;
}

.ar-task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  min-width: 0;
}

.ar-task {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px 18px 14px;

  &.is-paused {
    background: var(--sr-card-2);
  }
}

.ar-task-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.ar-task-identity {
  min-width: 0;
}

.ar-task-venue {
  margin: 0;
  font-family: var(--sr-font-display);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.ar-task-time {
  margin: 3px 0 0;
  color: var(--sr-green-2);
  font-size: 12.5px;
}

.ar-task-week {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 12px 0;
}

.ar-day {
  display: inline-grid;
  place-items: center;
  min-width: 32px;
  height: 24px;
  padding: 0 5px;
  border: 1px solid var(--sr-line);
  border-radius: 7px;
  background: var(--sr-card-2);
  color: var(--sr-muted-2);
  font-size: 10.5px;
  line-height: 1;

  &.is-on {
    border-color: var(--sr-green-line);
    background: var(--sr-green-soft);
    color: var(--sr-green-ink);
    font-weight: 600;
  }
}

.ar-task-meta {
  min-width: 0;
}

.ar-task-pause {
  margin: 8px 0 0;
  padding: 8px 10px;
  border: 1px solid var(--sr-amber-line);
  border-radius: 8px;
  background: var(--sr-amber-soft);
  color: var(--sr-amber-ink);
  font-size: 11px;
  line-height: 1.55;

  &.is-danger {
    border-color: #e2b8b1;
    background: var(--sr-danger-soft);
    color: var(--sr-danger);
  }
}

.ar-task-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--sr-line);

  .el-button + .el-button {
    margin-left: 0;
  }
}

.ar-feedback .sr-empty {
  padding: 44px 18px;
}

.ar-empty-hint {
  margin: 0;
  color: var(--sr-muted);
  font-size: 12px;
}

.ar-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* ---------- dialog 内样式 ---------- */
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

.ar-records-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.ar-records-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
  color: var(--sr-ink-2);
  font-size: 12px;
}

.ar-records-count {
  color: var(--sr-muted);
  font-size: 11.5px;
}

.ar-records-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e2b8b1;
  border-radius: 9px;
  background: #f9e8e4;
  color: #a64035;
  font-size: 12px;
}

.ar-records-table {
  width: 100%;
  --el-table-border-color: var(--sr-line);
  --el-table-header-bg-color: var(--sr-card-2);
  --el-table-row-hover-bg-color: var(--sr-paper-2);
  --el-table-bg-color: var(--sr-card);
  --el-table-tr-bg-color: var(--sr-card);
  --el-table-text-color: var(--sr-ink-2);
  --el-table-header-text-color: var(--sr-muted);
  font-size: 12.5px;
}

.ar-mono {
  font-family: var(--sr-font-mono);
  font-variant-numeric: tabular-nums;
}

.ar-fail-msg {
  color: #a64035;
}

.ar-records-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

@media (max-width: 900px) {
  .ar-task-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .ar-form-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .ar-task-actions {
    gap: 6px;

    .el-button,
    :deep(.el-dropdown) {
      flex: 1 1 auto;
      margin-left: 0;
    }
  }

  .ar-picker-toolbar :deep(.el-input) {
    width: 100% !important;
  }
}
</style>
