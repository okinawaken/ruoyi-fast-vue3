<template>
  <el-dialog
    :model-value="visible"
    class="sr-dialog ar-records-dialog"
    :title="recordsTitle"
    width="min(960px, 96vw)"
    @update:model-value="value => emit('update:visible', value)"
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
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { studyAutoReserveApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import {
  AUTO_RESERVE_RECORD_STATUS,
  AUTO_RESERVE_TRIGGER_TYPE
} from '@/utils/study/constants'
import { useLatestRequest } from '@/composables/study/useLatestRequest'

const props = defineProps({
  visible: { type: Boolean, default: false },
  task: { type: Object, default: null }
})

const emit = defineEmits(['update:visible'])

const store = useStudyStore()

const records = ref([])
const recordTotal = ref(0)
const recordPage = ref(1)
const recordPageSize = ref(10)
const recordLoading = ref(false)
const recordsError = ref('')

const recordRequest = useLatestRequest()

const recordsTask = computed(() => props.task)

const recordsTitle = computed(() =>
  recordsTask.value ? `执行记录 · ${recordsTask.value.venueName || '门店'}` : '执行记录'
)

function recordChipClass(status) {
  const value = Number(status)
  if (value === AUTO_RESERVE_RECORD_STATUS.SUCCESS) {
    return 'sr-chip-green'
  }
  if (value === AUTO_RESERVE_RECORD_STATUS.FAILED) {
    return 'sr-chip-danger'
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

watch(
  () => props.visible,
  visible => {
    if (!visible) {
      recordRequest.invalidate()
      return
    }
    recordPage.value = 1
    records.value = []
    recordTotal.value = 0
    recordsError.value = ''
    loadRecords(1)
  },
  { immediate: true }
)

defineExpose({ refresh: () => loadRecords(recordPage.value) })
</script>

<style lang="scss" scoped>
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
</style>
