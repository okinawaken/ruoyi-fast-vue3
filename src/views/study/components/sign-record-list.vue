<template>
  <section class="sr-card list-card sign-card" v-loading="loading">
    <div class="sr-card-head list-card-head">
      <h2 class="sr-card-title">
        签到记录
        <span class="sr-count">{{ list.length }}</span>
      </h2>
      <span class="sr-chip sr-chip-muted">最近记录</span>
    </div>

    <div v-if="rows.length" class="sign-rows">
      <article v-for="row in rows" :key="row.item.id" class="sign-row">
        <div class="sign-date">
          <span class="sign-date-day sr-mono">{{ row.dateText }}</span>
          <span class="sign-date-week">{{ row.weekday }}</span>
        </div>

        <div class="sign-main">
          <div class="sign-seat">{{ row.seat || '座位信息待同步' }}</div>
          <div class="sign-venue">
            <span v-if="row.venue">{{ row.venue }}</span>
            <span v-if="row.venue && row.timeText" class="sign-sep"> · </span>
            <span v-if="row.timeText" class="sr-mono">{{ row.timeText }}</span>
          </div>
        </div>

        <div class="sign-side">
          <span class="sign-duration sr-mono">{{ row.duration || '—' }}</span>
          <span class="sign-package">{{ row.packageName }}</span>
          <span class="sr-chip" :class="row.payed ? 'sr-chip-green' : 'sr-chip-amber'">
            <span class="sr-dot"></span>{{ row.payed ? '已完成' : '未扣除' }}
          </span>
        </div>
      </article>
    </div>

    <div v-else class="sr-empty sign-empty">
      <el-empty description="暂无签到记录" :image-size="52" />
    </div>

    <div v-if="rows.length" class="sign-load-more">
      <el-button v-if="hasMore" :loading="loadingMore" @click="emit('load-more')">加载更早</el-button>
      <span v-else class="sign-no-more">没有更多了</span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { clockOf, parseApiDate } from '@/utils/study/format'

const props = defineProps({
  list: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false }
})

const emit = defineEmits(['load-more'])

const rows = computed(() =>
  (Array.isArray(props.list) ? props.list : []).map(item => {
    const parsed = parseApiDate(item?.signDateStr)
    const value = parsed?.value || ''
    const signIn = clockOf(item?.signInTimeStr)
    const signOut = clockOf(item?.signOutTimeStr)
    const timeText = signIn || signOut ? `${signIn || '--:--'} – ${signOut || '未签退'}` : ''
    const seat = [item?.venueAreaSeat?.seatNumber, item?.venueAreaSeat?.areaName].filter(Boolean).join(' · ')
    return {
      item,
      dateText: value ? `${value.slice(5, 7)}/${value.slice(8, 10)}` : item?.signDateStr || '--',
      weekday: parsed?.weekday || '',
      seat,
      venue: item?.venue?.venueName || '',
      timeText,
      duration: item?.studyMinuteStr || '',
      packageName: item?.packageNamePayed || '未选择套餐',
      payed: Number(item?.hasPayed) === 1
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

.sign-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 12px 18px;
  border-top: 1px solid var(--sr-line);
}

.sign-row:first-of-type {
  border-top: 0;
}

.sign-date {
  min-width: 0;
}

.sign-date-day {
  display: block;
  color: var(--sr-ink-2);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sign-date-week {
  display: block;
  color: var(--sr-muted);
  font-size: 10px;
}

.sign-main {
  min-width: 0;
}

.sign-seat {
  color: var(--sr-ink);
  font-size: 12.5px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.sign-venue {
  margin-top: 1px;
  color: var(--sr-muted);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.sign-side {
  text-align: right;
  white-space: nowrap;
  flex: none;
}

.sign-duration {
  display: block;
  color: var(--sr-ink-2);
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sign-package {
  display: block;
  margin-top: 2px;
  color: var(--sr-muted);
  font-size: 10px;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sign-side .sr-chip {
  margin-top: 4px;
}

.sign-load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 18px;
  border-top: 1px solid var(--sr-line);
}

.sign-load-more :deep(.el-button) {
  width: 100%;
  border-color: var(--sr-line);
  color: var(--sr-muted);
  font-size: 11.5px;
}

.sign-no-more {
  color: var(--sr-muted-2);
  font-size: 11px;
}

@media (max-width: 640px) {
  .sign-row {
    grid-template-columns: 54px minmax(0, 1fr);
    gap: 10px;
    padding: 11px 14px;
  }

  .sign-side {
    grid-column: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    text-align: left;
    white-space: normal;
    width: 100%;
  }

  .sign-side .sr-chip {
    margin-top: 0;
    flex: none;
  }

  .sign-package {
    max-width: 100%;
  }
}
</style>
