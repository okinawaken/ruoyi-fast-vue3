<template>
  <article class="sr-card ar-task" :class="{ 'is-paused': !isEnabled }">
    <div class="ar-task-head">
      <div class="ar-task-identity">
        <h2 class="ar-task-venue">{{ task.venueName || '未命名门店' }}</h2>
        <p class="ar-task-time sr-mono">{{ task.reserveStartTime }} – {{ task.reserveEndTime }}</p>
      </div>
      <span class="sr-chip" :class="chipClass">
        <span class="sr-dot"></span>{{ isEnabled ? '启用中' : '已暂停' }}
      </span>
    </div>

    <div
      class="ar-task-week"
      role="group"
      :aria-label="'执行星期：' + weekDaySummary"
    >
      <span
        v-for="day in AUTO_RESERVE_WEEKDAYS"
        :key="day.value"
        class="ar-day"
        :class="{ 'is-on': isDayOn(day.value) }"
        :title="day.label"
      >{{ day.label }}</span>
    </div>

    <div class="ar-task-meta">
      <div class="sr-kv">
        <span class="sr-kv-key">选座偏好</span>
        <span class="sr-kv-value">{{ seatPreference }}</span>
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

    <p v-if="pauseText" class="ar-task-pause" :class="{ 'is-danger': task.pauseReason === 'TOKEN' }">
      {{ pauseText }}
    </p>

    <div class="ar-task-actions">
      <el-button size="small" @click="emit('records')">执行记录</el-button>
      <el-button
        size="small"
        type="primary"
        plain
        :loading="executing"
        :disabled="!isEnabled || !tokenValid"
        @click="emit('execute')"
      >
        立即执行
      </el-button>
      <el-button
        size="small"
        :loading="actionLoading"
        :disabled="!tokenValid"
        @click="emit('toggle')"
      >{{ isEnabled ? '暂停' : '恢复' }}</el-button>
      <el-dropdown trigger="click" @command="command => emit('command', command)">
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
</template>

<script setup>
import { computed } from 'vue'
import { AUTO_RESERVE_ENABLE_STATUS, AUTO_RESERVE_WEEKDAYS } from '@/utils/study/constants'

const props = defineProps({
  task: { type: Object, required: true },
  executing: { type: Boolean, default: false },
  actionLoading: { type: Boolean, default: false },
  tokenValid: { type: Boolean, default: false }
})

const emit = defineEmits(['records', 'execute', 'toggle', 'command'])

const isEnabled = computed(
  () => Number(props.task?.enableStatus) === AUTO_RESERVE_ENABLE_STATUS.ENABLED
)

const chipClass = computed(() => {
  if (isEnabled.value) {
    return 'sr-chip-green'
  }
  return props.task?.pauseReason === 'TOKEN' ? 'sr-chip-danger' : 'sr-chip-amber'
})

const pauseText = computed(() => {
  if (!props.task || isEnabled.value) {
    return ''
  }
  if (props.task.pauseReason === 'TOKEN') {
    return '小程序 token 失效，任务已自动暂停；重新绑定 token 后请手动恢复。'
  }
  return props.task.pauseReason ? `暂停原因：${props.task.pauseReason}` : ''
})

const seatPreference = computed(() => {
  const parts = []
  if (Number(props.task?.seatId) > 0) {
    parts.push(`座位 ${props.task.seatNumber || props.task.seatId}`)
  }
  if (Number(props.task?.areaId) > 0) {
    parts.push(`区域 ${props.task.areaName || props.task.areaId}`)
  }
  if (!parts.length) {
    return '全馆任意可用座位'
  }
  return parts.length > 1 ? `${parts.join(' → ')}（依次优先）` : `${parts[0]}（优先）`
})

const weekDaySummary = computed(() => {
  const values = (Array.isArray(props.task?.weekDays) ? props.task.weekDays : [])
    .map(day => Number(day))
    .filter(day => AUTO_RESERVE_WEEKDAYS.some(item => item.value === day))
    .sort((a, b) => a - b)
  const labels = values.map(value => AUTO_RESERVE_WEEKDAYS.find(item => item.value === value).label)
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
})

function isDayOn(value) {
  return Array.isArray(props.task?.weekDays)
    && props.task.weekDays.some(day => Number(day) === Number(value))
}
</script>

<style lang="scss" scoped>
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

@media (max-width: 640px) {
  .ar-task-actions {
    gap: 6px;

    .el-button,
    :deep(.el-dropdown) {
      flex: 1 1 auto;
      margin-left: 0;
    }
  }
}
</style>
