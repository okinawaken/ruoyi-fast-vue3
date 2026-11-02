<template>
  <section class="sr-card list-card" v-loading="loading">
    <div class="sr-card-head list-card-head">
      <h2 class="sr-card-title">
        我的预约
        <span class="sr-count">{{ rows.length }}</span>
      </h2>
      <label class="only-unfinished">
        <el-switch v-model="onlyUnfinished" />
        <span>仅显示未结束</span>
      </label>
    </div>

    <div v-if="rows.length" class="reserve-rows">
      <article v-for="row in rows" :key="row.item.id" class="reserve-row">
        <div class="date-block">
          <span class="date-month">{{ row.month }} 月</span>
          <span class="date-day">{{ row.day }}</span>
          <span class="date-week">{{ row.weekday }}</span>
        </div>

        <div class="reserve-main">
          <span class="reserve-time sr-mono">{{ row.timeRange }}</span>
          <p class="reserve-place">
            <span v-if="row.isToday" class="reserve-today">今天</span>
            <span v-if="row.isToday && (row.seatNumber || row.areaName)" class="reserve-sep"> · </span>
            <b v-if="row.seatNumber">{{ row.seatNumber }}</b>
            <span v-if="row.seatNumber && row.areaName" class="reserve-sep"> · </span>
            <span v-if="row.areaName">{{ row.areaName }}</span>
            <br v-if="row.venueName" />
            <span v-if="row.venueName" class="reserve-venue">{{ row.venueName }}</span>
          </p>
        </div>

        <div class="reserve-side">
          <span :class="['sr-chip', row.ended ? 'sr-chip-muted' : 'sr-chip-green']">
            <span class="sr-dot"></span>{{ row.status }}
          </span>
          <el-button v-if="row.cancellable" class="reserve-cancel" text size="small" @click="emit('cancel', row.item)">
            取消预约
          </el-button>
        </div>
      </article>
    </div>

    <div v-else class="sr-empty reserve-empty">
      <el-empty :description="emptyText" :image-size="52" />
      <el-button type="primary" @click="emit('go-reserve')">去预约</el-button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { isEndedReserve } from '@/utils/study/reserve'
import { parseApiDate } from '@/utils/study/time'

const props = defineProps({
  list: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['cancel', 'go-reserve'])

const onlyUnfinished = ref(true)

function formatTimeRange(value) {
  if (!value) {
    return '—'
  }
  const text = String(value).trim()
  const match = text.match(/^(\d{1,2}:\d{2})\s*[-–—~至]\s*(\d{1,2}:\d{2})$/)
  if (match) {
    return `${match[1]} – ${match[2]}`
  }
  return text
}

const visibleList = computed(() => {
  const list = Array.isArray(props.list) ? props.list : []
  return onlyUnfinished.value ? list.filter(item => !isEndedReserve(item)) : list
})

const emptyText = computed(() => (onlyUnfinished.value ? '还没有未结束的预约' : '还没有预约记录'))

const rows = computed(() =>
  visibleList.value.map(item => {
    const parsed = parseApiDate(item?.reserveDateStr)
    const value = parsed?.value || ''
    const status = item?.reserveStatusDesc || '待签到'
    const ended = isEndedReserve(item)
    // 已签到的预约已开始使用，不再提供取消入口
    const cancellable = !ended && !/已签到|已签退/.test(status)
    return {
      item,
      month: value ? String(Number(value.slice(5, 7))) : '--',
      day: value ? String(Number(value.slice(8, 10))) : '--',
      weekday: item?.reserveWeekStr || parsed?.weekday || '',
      isToday: !!parsed?.isToday,
      timeRange: formatTimeRange(item?.reserveTimeStr),
      seatNumber: item?.seatNumber || '',
      areaName: item?.areaName || '',
      venueName: item?.venueName || '',
      status,
      ended,
      cancellable
    }
  })
)
</script>

<style lang="scss" scoped>
.list-card {
  overflow: hidden;
}

.list-card-head {
  border-bottom: 1px solid var(--sr-line);
}

.only-unfinished {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--sr-muted);
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}

.reserve-row {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  min-width: 0;
  padding: 14px 18px;
  border-top: 1px solid var(--sr-line);
}

.reserve-row:first-of-type {
  border-top: 0;
}

.date-block {
  padding-right: 12px;
  border-right: 1px solid var(--sr-line);
  text-align: center;
}

.date-month {
  display: block;
  color: var(--sr-muted);
  font-size: 10px;
  letter-spacing: 0.04em;
}

.date-day {
  display: block;
  font-family: var(--sr-font-display);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--sr-ink);
  font-variant-numeric: tabular-nums;
}

.date-week {
  display: block;
  color: var(--sr-muted);
  font-size: 10px;
}

.reserve-main {
  min-width: 0;
}

.reserve-time {
  color: var(--sr-ink);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.reserve-place {
  margin: 2px 0 0;
  color: var(--sr-muted);
  font-size: 11.5px;
  overflow-wrap: anywhere;

  b {
    color: var(--sr-ink-2);
    font-weight: 500;
  }
}

.reserve-today {
  color: var(--sr-green-2);
  font-weight: 600;
}

.reserve-venue {
  color: var(--sr-muted);
}

.reserve-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  flex: none;
}

.reserve-cancel {
  height: 27px;
  padding: 0 8px;
  color: var(--sr-muted);
  font-size: 11.5px;

  &:hover {
    color: var(--sr-danger);
    background: var(--sr-danger-soft);
  }
}

.reserve-empty {
  gap: 10px;
}

@media (max-width: 640px) {
  .reserve-row {
    grid-template-columns: 50px minmax(0, 1fr);
    gap: 11px;
    padding: 13px 14px;
  }

  .reserve-side {
    grid-column: 2;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
  }
}
</style>
