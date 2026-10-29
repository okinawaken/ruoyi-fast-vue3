<template>
  <aside class="sr-card reserve-summary" aria-labelledby="srSummaryTitle">
    <div class="summary-head">
      <h2 id="srSummaryTitle" class="summary-title">预约摘要</h2>
      <span class="sr-chip" :class="stateChip.className">{{ stateChip.text }}</span>
    </div>

    <dl class="summary-rows">
      <div class="summary-row">
        <dt class="summary-key">日期</dt>
        <dd class="summary-value">{{ dateLabel || '—' }}</dd>
      </div>
      <div class="summary-row">
        <dt class="summary-key">时段</dt>
        <dd class="summary-value sr-mono">{{ timeRange }}</dd>
      </div>
      <div class="summary-row">
        <dt class="summary-key">时长</dt>
        <dd class="summary-value">{{ durationText || '—' }}</dd>
      </div>
      <div class="summary-row">
        <dt class="summary-key">门店</dt>
        <dd class="summary-value">{{ venueName || '—' }}</dd>
      </div>
      <div class="summary-row">
        <dt class="summary-key">座位</dt>
        <dd class="summary-value summary-seat">
          <template v-if="seat">
            <strong class="sr-mono">{{ seat.seatNumber || '—' }}</strong>
            <span v-if="seat.areaName">{{ seat.areaName }}</span>
          </template>
          <span v-else class="summary-none">尚未选择座位</span>
        </dd>
      </div>
    </dl>

    <template v-if="rules.length">
      <hr class="sr-divider" />
      <ul class="summary-rules">
        <li v-for="(rule, index) in rules" :key="index">{{ rule }}</li>
      </ul>
    </template>

    <el-button
      type="primary"
      size="large"
      class="summary-submit"
      :loading="submitting"
      :disabled="submitDisabled"
      @click="emit('submit')"
    >
      提交预约
    </el-button>
    <el-button text class="summary-clear" :disabled="!seat || submitting" @click="emit('clear')">清空选择</el-button>
    <p class="summary-foot">提交即表示同意门店的预约规则</p>
  </aside>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  dateLabel: { type: String, default: '' },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  durationText: { type: String, default: '' },
  venueName: { type: String, default: '' },
  seat: { type: Object, default: null },
  rules: { type: Array, default: () => [] },
  submitDisabled: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  ineligible: { type: Boolean, default: false }
})

const emit = defineEmits(['submit', 'clear'])

const timeRange = computed(() => {
  if (!props.startTime || !props.endTime) {
    return '—'
  }
  return `${props.startTime} – ${props.endTime}`
})

const stateChip = computed(() => {
  if (props.ineligible) {
    return { text: '不可预约', className: 'sr-chip-muted' }
  }
  if (!props.seat) {
    return { text: '未选座', className: 'sr-chip-muted' }
  }
  if (props.submitting) {
    return { text: '提交中', className: 'sr-chip-amber' }
  }
  return { text: '待提交', className: 'sr-chip-amber' }
})
</script>

<style lang="scss" scoped>
.reserve-summary {
  position: sticky;
  top: 84px;
  min-width: 0;
  padding: 18px;
}

.summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.summary-title {
  margin: 0;
  font-family: var(--sr-font-display, 'Songti SC', serif);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
}

.summary-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 16px 0 0;
}

.summary-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
  font-size: 12px;
}

.summary-key {
  color: var(--sr-muted, #5f6c64);
  flex: none;
}

.summary-value {
  min-width: 0;
  margin: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.summary-seat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;

  strong {
    font-size: 13px;
    font-weight: 600;
  }

  span {
    color: var(--sr-muted, #5f6c64);
    font-size: 10.5px;
    font-weight: 400;
  }
}

.summary-none {
  color: var(--sr-muted-2, #75827a);
  font-size: 12px;
  font-weight: 400;
}

.summary-rules {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    position: relative;
    padding-left: 13px;
    color: var(--sr-muted, #5f6c64);
    font-size: 11px;
    line-height: 1.55;

    &::before {
      content: '';
      position: absolute;
      top: 7px;
      left: 0;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--sr-green-line, #bfd3c5);
    }
  }
}

.summary-submit {
  width: 100%;
  margin-top: 16px;
}

.summary-clear {
  width: 100%;
  margin: 4px 0 0;
  margin-left: 0;
  color: var(--sr-muted, #5f6c64);
}

.summary-foot {
  margin: 8px 0 0;
  color: var(--sr-muted-2, #75827a);
  font-size: 10px;
  line-height: 1.5;
  text-align: center;
}

@media (max-width: 1120px) {
  .reserve-summary {
    position: static;
  }
}

@media (max-width: 640px) {
  .reserve-summary {
    padding: 16px;
  }
}
</style>
