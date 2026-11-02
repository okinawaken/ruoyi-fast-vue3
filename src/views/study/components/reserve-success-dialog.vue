<template>
  <el-dialog
    v-model="visible"
    class="sr-dialog"
    width="460px"
    :show-close="false"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="success-body">
      <div class="success-mark" aria-hidden="true">
        <el-icon><Check /></el-icon>
      </div>
      <h2 class="success-title">预约成功</h2>
      <p class="success-lead">座位已为你保留，请按预约时段到店签到。</p>

      <div class="success-summary">
        <div class="success-row">
          <span class="success-key">日期</span>
          <span class="success-value">{{ dateText }}</span>
        </div>
        <div class="success-row">
          <span class="success-key">时段</span>
          <span class="success-value sr-mono">{{ timeText }}</span>
        </div>
        <div class="success-row">
          <span class="success-key">门店</span>
          <span class="success-value">{{ venueText }}</span>
        </div>
        <div class="success-row">
          <span class="success-key">座位</span>
          <span class="success-value">{{ seatText }}</span>
        </div>
      </div>

      <div class="success-actions">
        <el-button @click="emit('close')">继续预约</el-button>
        <el-button type="primary" @click="emit('view')">查看我的预约</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { parseApiDate } from '@/utils/study/time'

const props = defineProps({
  open: { type: Boolean, default: false },
  result: { type: Object, default: null },
  fallback: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['close', 'view'])

const visible = computed({
  get: () => props.open,
  set: value => {
    if (!value) {
      emit('close')
    }
  }
})

const dateText = computed(() => {
  const raw = props.result?.reserveDateStr || props.fallback?.dateValue
  if (!raw) {
    return props.fallback?.dateLabel || '—'
  }
  const parsed = parseApiDate(raw)
  if (!parsed) {
    return props.fallback?.dateLabel || raw
  }
  return parsed.label
})

const timeText = computed(() => {
  const raw = props.result?.reserveTimeStr
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\s*[-–—]\s*/, ' – ')
  }
  if (props.fallback?.startTime && props.fallback?.endTime) {
    return `${props.fallback.startTime} – ${props.fallback.endTime}`
  }
  return '—'
})

const venueText = computed(() => props.result?.venueName || props.fallback?.venueName || '—')

const seatText = computed(() => {
  const seatNumber = props.result?.seatNumber
  if (seatNumber) {
    const areaName = props.result?.areaName
    return areaName ? `${seatNumber} · ${areaName}` : seatNumber
  }
  return props.fallback?.seatText || '—'
})
</script>

<style lang="scss" scoped>
.success-body {
  padding: 8px 4px 4px;
}

.success-mark {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #e4ede6;
  color: #2f6b55;
  font-size: 22px;
}

.success-title {
  margin: 14px 0 4px;
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.35;
  color: #1b2a24;
}

.success-lead {
  margin: 0;
  color: #5f6c64;
  font-size: 12px;
  line-height: 1.6;
}

.sr-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.success-summary {
  margin-top: 16px;
  padding: 12px 14px;
  border: 1px solid #e4dcc9;
  border-radius: 10px;
  background: #fbf8ef;
}

.success-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 4px 0;
  font-size: 11.5px;
  line-height: 1.55;
}

.success-key {
  color: #5f6c64;
  flex: none;
}

.success-value {
  min-width: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
  text-align: right;
}

.success-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}

@media (max-width: 640px) {
  .success-actions :deep(.el-button) {
    flex: 1 1 auto;
  }
}
</style>
