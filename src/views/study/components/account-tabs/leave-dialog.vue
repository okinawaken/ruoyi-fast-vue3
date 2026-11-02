<template>
  <el-dialog
    :model-value="visible"
    class="sr-dialog"
    title="套餐请假"
    width="480px"
    :close-on-click-modal="false"
    @update:model-value="value => emit('update:visible', value)"
  >
    <div v-loading="leaveLoading" class="form-body">
      <div v-if="leaveInfo" class="leave-info">
        <div class="sr-kv">
          <span class="sr-kv-key">剩余可请假</span>
          <span class="sr-kv-value">{{ leaveInfo.leftLeaveDays ?? '—' }} 天</span>
        </div>
        <div class="sr-kv">
          <span class="sr-kv-key">请假状态</span>
          <span class="sr-kv-value">{{ Number(leaveInfo.canLeaveState) === 1 ? '可请假' : '不可请假' }}</span>
        </div>
      </div>
      <div v-if="leaveInfo && Number(leaveInfo.canLeaveState) !== 1 && leaveInfo.canNotLeaveMsg" class="sr-dialog-note is-warning">
        {{ leaveInfo.canNotLeaveMsg }}
      </div>

      <div v-if="leaveInfo?.leaveList?.length" class="leave-records">
        <span class="sr-field-label">已请假记录</span>
        <div v-for="record in leaveInfo.leaveList" :key="record.id" class="leave-record">
          <span class="sr-mono">{{ record.startDate }} – {{ record.endDate }}</span>
          <span class="sr-chip sr-chip-muted">{{ record.leaveStateDesc || '已请假' }}</span>
        </div>
      </div>

      <template v-if="leaveInfo && Number(leaveInfo.canLeaveState) === 1">
        <div class="form-field">
          <label class="sr-field-label">请假日期</label>
          <el-date-picker
            v-model="leaveForm.range"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="–"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </div>
        <div class="form-field">
          <label class="sr-field-label" for="leaveReason">请假原因</label>
          <el-input id="leaveReason" v-model="leaveForm.reason" type="textarea" :rows="2" maxlength="120" show-word-limit placeholder="请填写请假原因" />
        </div>
      </template>

      <div class="sr-dialog-foot form-actions">
        <el-button :disabled="submittingLeave" @click="emit('update:visible', false)">关闭</el-button>
        <el-button
          v-if="leaveInfo && Number(leaveInfo.canLeaveState) === 1"
          type="primary"
          :loading="submittingLeave"
          @click="submitLeave"
        >确认请假</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { studyLeaveApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import { useLatestRequest } from '@/composables/study/useLatestRequest'

const props = defineProps({
  visible: { type: Boolean, default: false },
  userPackageId: { type: [String, Number], default: null }
})

const emit = defineEmits(['update:visible', 'saved'])

const store = useStudyStore()

const leaveLoading = ref(false)
const leaveInfo = ref(null)
const submittingLeave = ref(false)
const leaveForm = reactive({ range: [], reason: '' })
const leaveRequest = useLatestRequest()

async function enterLeave(userPackageId) {
  const seq = leaveRequest.next()
  leaveLoading.value = true
  try {
    const res = await studyLeaveApi.enter(userPackageId)
    if (!leaveRequest.isLatest(seq)) {
      return
    }
    leaveInfo.value = res?.data || null
  } catch (e) {
    if (!leaveRequest.isLatest(seq)) {
      return
    }
    leaveInfo.value = null
    store.handleApiError(e)
  } finally {
    if (leaveRequest.isLatest(seq)) {
      leaveLoading.value = false
    }
  }
}

/**
 * 上游请假接口要求日期格式为 yyyy-M-d（月、日不补零）
 */
function toLeaveDate(value) {
  const [year, month, day] = String(value).split('-').map(Number)
  return `${year}-${month}-${day}`
}

async function submitLeave() {
  if (submittingLeave.value || !leaveInfo.value?.userPackageId) {
    return
  }
  if (!leaveForm.range || leaveForm.range.length !== 2) {
    ElMessage.warning('请选择请假日期')
    return
  }
  const reason = leaveForm.reason.trim()
  if (!reason) {
    ElMessage.warning('请填写请假原因')
    return
  }
  submittingLeave.value = true
  try {
    await studyLeaveApi.confirm({
      userPackageId: leaveInfo.value.userPackageId,
      leaveStartTimeStr: toLeaveDate(leaveForm.range[0]),
      leaveEndTimeStr: toLeaveDate(leaveForm.range[1]),
      leaveReason: reason
    })
    ElMessage.success('请假成功')
    leaveForm.range = []
    leaveForm.reason = ''
    emit('saved')
    await enterLeave(leaveInfo.value.userPackageId)
  } catch (e) {
    store.handleApiError(e)
  } finally {
    submittingLeave.value = false
  }
}

watch(
  () => props.visible,
  visible => {
    if (!visible) {
      leaveRequest.invalidate()
      return
    }
    leaveForm.range = []
    leaveForm.reason = ''
    leaveInfo.value = null
    if (props.userPackageId !== null && props.userPackageId !== undefined) {
      enterLeave(props.userPackageId)
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.form-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.form-field :deep(.el-select) {
  width: 100%;
}

.form-actions {
  margin-top: 18px;
}

.leave-info {
  margin-top: 4px;
  padding: 2px 12px;
  border: 1px solid var(--sr-line);
  border-radius: 9px;
  background: var(--sr-card-2);
}

.leave-records {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
}

.leave-record {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid var(--sr-line);
  border-radius: 8px;
  background: var(--sr-card-2);
  font-size: 11.5px;
}
</style>
