<template>
  <div class="current-seat" :class="{ 'is-empty': !primary }" v-loading="loading">
    <div v-if="primary" class="cs-content">
      <div class="cs-left">
        <span class="cs-label">
          <span class="cs-live-dot" aria-hidden="true"></span>
          当前在座
        </span>
        <div class="cs-seat">
          <strong class="sr-mono">{{ seatNumber }}</strong>
          <span v-if="areaName" class="cs-area">{{ areaName }}</span>
          <span v-if="moreCount > 0" class="sr-chip sr-chip-muted">另有 {{ moreCount }} 个在座</span>
        </div>
        <p class="cs-meta">
          <span v-if="signInText">{{ signInText }} 签到</span>
          <span v-else>签到时间待同步</span>
          <span v-if="packageName"> · {{ packageName }}</span>
        </p>
      </div>

      <div v-if="studyText || progress !== null || expectedText" class="cs-right">
        <span v-if="studyText" class="cs-time">已学 {{ studyText }}</span>
        <div
          v-if="progress !== null"
          class="cs-progress"
          role="progressbar"
          aria-label="本次学习进度"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="progress"
        >
          <span :style="{ width: `${progress}%` }"></span>
        </div>
        <span v-if="expectedText" class="cs-hint">预计 {{ expectedText }} 签退</span>
      </div>
    </div>

    <div v-else class="sr-empty cs-empty">
      <el-empty description="当前未在座" :image-size="46" />
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { formatDurationText, parseTimeToMinutes, clockOf } from '@/utils/study/format'

const props = defineProps({
  signData: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const now = ref(Date.now())
const timer = window.setInterval(() => {
  now.value = Date.now()
}, 60000)

onUnmounted(() => {
  window.clearInterval(timer)
})

const seatList = computed(() => (Array.isArray(props.signData?.userSignInfoList) ? props.signData.userSignInfoList : []))

const isSeated = computed(() => {
  const flag = props.signData?.hasSeat
  if (flag === 0 || flag === '0') {
    return false
  }
  return seatList.value.length > 0
})

const primary = computed(() => (isSeated.value ? seatList.value[0] : null))

const moreCount = computed(() => Math.max(0, seatList.value.length - 1))

const seatNumber = computed(() => primary.value?.seatInfo?.seatNumber || '—')

const areaName = computed(() => primary.value?.seatInfo?.areaName || primary.value?.areaDesc || '')

const packageName = computed(() => primary.value?.packageName || '')

const signInText = computed(() => clockOf(primary.value?.signInTimeStr || primary.value?.seatInfo?.signInTimeStr))

const expectedText = computed(() => clockOf(primary.value?.signOutExpectTimeStr))

const studyText = computed(() => {
  const info = primary.value?.seatInfo
  if (!info) {
    return ''
  }
  const toNumber = value => {
    if (value === null || value === undefined || value === '') {
      return null
    }
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  const hours = toNumber(info.studyHours)
  const minutes = toNumber(info.studyMinutes)
  if (hours === null && minutes === null) {
    return ''
  }
  return formatDurationText((hours || 0) * 60 + (minutes || 0))
})

const progress = computed(() => {
  const start = parseTimeToMinutes(signInText.value)
  const end = parseTimeToMinutes(expectedText.value)
  if (start === null || end === null || end <= start) {
    return null
  }
  const current = new Date(now.value)
  const currentMinutes = current.getHours() * 60 + current.getMinutes()
  const ratio = ((currentMinutes - start) / (end - start)) * 100
  return Math.min(100, Math.max(0, Math.round(ratio)))
})
</script>

<style lang="scss" scoped>
.current-seat {
  min-width: 0;
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid var(--sr-green-line);
  border-radius: 12px;
  background: rgba(228, 237, 230, 0.45);

  &.is-empty {
    border-color: var(--sr-line);
    background: var(--sr-card-2);
  }
}

.cs-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  min-width: 0;
}

.cs-left {
  min-width: 0;
}

.cs-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--sr-green-ink);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.cs-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sr-green-3);
  box-shadow: 0 0 0 3px rgba(62, 132, 104, 0.14);
  flex: none;
}

.cs-seat {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  min-width: 0;

  strong {
    font-size: 17px;
    font-weight: 600;
    color: var(--sr-ink);
    overflow-wrap: anywhere;
  }
}

.cs-area {
  color: var(--sr-muted);
  font-size: 11.5px;
  overflow-wrap: anywhere;
}

.cs-meta {
  margin: 3px 0 0;
  color: var(--sr-muted);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.cs-right {
  width: 230px;
  max-width: 100%;
  flex: none;
}

.cs-time {
  display: block;
  color: var(--sr-green);
  font-family: var(--sr-font-mono);
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.cs-progress {
  height: 4px;
  margin: 7px 0 5px;
  border-radius: 999px;
  background: rgba(36, 81, 63, 0.13);
  overflow: hidden;

  span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--sr-green-2);
    transition: width 0.3s ease;
  }
}

.cs-hint {
  display: block;
  color: var(--sr-muted);
  font-size: 10.5px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.cs-empty {
  padding: 14px 12px;
}

@media (max-width: 900px) {
  .cs-right {
    width: 100%;
  }

  .cs-time,
  .cs-hint {
    text-align: left;
  }
}

@media (max-width: 640px) {
  .current-seat {
    padding: 12px;
  }
}
</style>
