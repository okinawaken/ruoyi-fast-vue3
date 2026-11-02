<template>
  <section class="sr-card seat-panel" aria-labelledby="srVenueTitle">
    <div class="venue-head">
      <div class="venue-title">
        <span class="venue-mark" aria-hidden="true">
          <el-icon><OfficeBuilding /></el-icon>
        </span>
        <div class="venue-title-main">
          <h2 id="srVenueTitle">{{ venueName || '座位图' }}</h2>
          <p class="venue-meta">
            <template v-if="openTime && closeTime">营业时间 {{ openTime }}–{{ closeTime }} · </template>
            {{ totalSeats }} 个座位 · {{ availableSeats }} 个可选
            <template v-if="updatedAt"> · 更新于 {{ updatedAt }}</template>
          </p>
        </div>
      </div>

      <div class="venue-tools">
        <div class="legend" aria-label="座位状态图例">
          <span><i class="legend-dot dot-avail" aria-hidden="true"></i>可约</span>
          <span><i class="legend-dot dot-partial" aria-hidden="true"></i>部分可约</span>
          <span><i class="legend-dot dot-unavail" aria-hidden="true"></i>不可约</span>
          <span><i class="legend-dot dot-selected" aria-hidden="true"></i>已选</span>
        </div>
        <label class="only-available">
          <el-switch v-model="onlyAvailable" :disabled="disabled" />
          <span>只看可约</span>
        </label>
      </div>
    </div>

    <div v-if="disabled" class="sr-empty venue-empty">当前账号暂不可预约，座位图已暂停加载。</div>

    <div v-else-if="error" class="sr-empty venue-empty" role="alert">
      <el-empty :description="error" />
      <el-button type="primary" @click="retry">重新查询</el-button>
    </div>

    <div v-else-if="loading && !totalSeats" class="venue-state" role="status" aria-live="polite">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>正在按所选时段查询座位…</span>
    </div>

    <div v-else-if="!totalSeats" class="sr-empty venue-empty">
      <el-empty description="该时段暂无可选座位" />
      <el-button @click="retry">重新查询</el-button>
    </div>

    <template v-else>
      <div v-for="area in visibleAreas" :key="area.key" class="area">
        <button type="button" class="area-head" :aria-expanded="isOpen(area) ? 'true' : 'false'" @click="toggleArea(area)">
          <span class="area-index">{{ formatAreaIndex(area.index) }}</span>
          <span class="area-name">{{ area.areaName }}</span>
          <span class="area-meta">{{ area.total }} 个座位 · {{ area.available }} 个可选</span>
          <el-icon class="chev" :class="{ 'is-collapsed': !isOpen(area) }"><ArrowDown /></el-icon>
        </button>
        <div v-if="isOpen(area)" class="seat-grid">
          <SeatCard
            v-for="item in visibleSeats(area)"
            :key="item.seat.id"
            :seat="item.seat"
            :display="item.display"
            :selected="isSelected(item.seat)"
            :disabled="disabled"
            @select="onSeatSelect(area, $event)"
          />
        </div>
      </div>

      <div v-if="onlyAvailable && !visibleAreas.length" class="sr-empty venue-empty">
        <el-empty description="当前时段没有可约座位" />
        <el-button @click="retry">重新查询</el-button>
      </div>
    </template>

    <div v-if="loading && totalSeats" class="seat-loading-mask" role="status" aria-live="polite">
      <div class="seat-loading-inner">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在按所选时段查询座位…</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { getSeatDisplayState } from '@/utils/study/seat'
import SeatCard from './seat-card.vue'

const props = defineProps({
  venueName: { type: String, default: '' },
  openTime: { type: String, default: '' },
  closeTime: { type: String, default: '' },
  updatedAt: { type: String, default: '' },
  areas: { type: Array, default: () => [] },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  selectedSeatId: { type: [Number, String], default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'retry'])

const onlyAvailable = ref(false)
const collapsed = reactive({})

const displayAreas = computed(() =>
  (props.areas || []).map((area, index) => {
    const seats = (area.venueAreaSeatList || []).map(seat => ({
      seat,
      display: getSeatDisplayState(seat, props.startTime, props.endTime)
    }))
    return {
      key: String(area.id ?? `area-${index}`),
      index,
      areaName: area.areaName || '未命名区域',
      seats,
      total: seats.length,
      available: seats.filter(item => item.display.selectable).length
    }
  })
)

const totalSeats = computed(() => displayAreas.value.reduce((total, area) => total + area.total, 0))
const availableSeats = computed(() => displayAreas.value.reduce((total, area) => total + area.available, 0))

const visibleAreas = computed(() => displayAreas.value.filter(area => !onlyAvailable.value || area.available > 0))

function visibleSeats(area) {
  return onlyAvailable.value ? area.seats.filter(item => item.display.selectable) : area.seats
}

function formatAreaIndex(index) {
  return String(index + 1).padStart(2, '0')
}

function isOpen(area) {
  return collapsed[area.key] !== true
}

function toggleArea(area) {
  collapsed[area.key] = isOpen(area)
}

function isSelected(seat) {
  return props.selectedSeatId !== null && props.selectedSeatId !== undefined && String(props.selectedSeatId) === String(seat.id)
}

function onSeatSelect(area, seat) {
  if (props.disabled) {
    return
  }
  emit('select', { seat, areaName: area.areaName })
}

function retry() {
  emit('retry')
}
</script>

<style lang="scss" scoped>
.seat-panel {
  position: relative;
  min-width: 0;
  overflow: hidden;
}

.venue-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 18px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--sr-line, #e4dcc9);
}

.venue-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.venue-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--sr-green-line, #bfd3c5);
  border-radius: 10px;
  background: var(--sr-green-soft, #e4ede6);
  color: var(--sr-green, #24513f);
  font-size: 17px;
  flex: none;
}

.venue-title-main {
  min-width: 0;
}

.venue-title h2 {
  margin: 0;
  font-family: var(--sr-font-display, 'Songti SC', serif);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.venue-meta {
  margin: 2px 0 0;
  color: var(--sr-muted, #5f6c64);
  font-size: 11px;
  line-height: 1.5;
}

.venue-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 2px;
}

.legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 11px;

  span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--sr-muted, #5f6c64);
    font-size: 10.5px;
    white-space: nowrap;
  }
}

.legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

.dot-avail {
  background: #5c9a78;
}

.dot-partial {
  background: #d19a3e;
}

.dot-unavail {
  background: #b8b1a2;
}

.dot-selected {
  background: var(--sr-green, #24513f);
  box-shadow: 0 0 0 3px var(--sr-green-soft, #e4ede6);
}

.only-available {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--sr-muted, #5f6c64);
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}

.venue-empty {
  padding: 40px 18px;
}

.venue-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  min-height: 220px;
  padding: 32px 18px;
  color: var(--sr-green-ink, #315a47);
  font-size: 12px;
}

.area {
  border-top: 1px solid var(--sr-line, #e4dcc9);

  &:first-of-type {
    border-top: 0;
  }
}

.area-head {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 13px 18px;
  border: 0;
  background: none;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.16s;

  &:hover {
    background: rgba(239, 233, 219, 0.4);
  }
}

.area-index {
  padding: 2px 6px;
  border: 1px solid var(--sr-green-line, #bfd3c5);
  border-radius: 6px;
  background: var(--sr-green-soft, #e4ede6);
  color: var(--sr-green-ink, #315a47);
  font-family: var(--sr-font-mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 600;
  flex: none;
}

.area-name {
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.area-meta {
  color: var(--sr-muted, #5f6c64);
  font-size: 10.5px;
  white-space: nowrap;
}

.chev {
  margin-left: auto;
  color: var(--sr-muted, #5f6c64);
  transition: transform 0.18s;
  flex: none;

  &.is-collapsed {
    transform: rotate(-90deg);
  }
}

.seat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
  padding: 0 18px 18px;
}

.seat-loading-mask {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  border-radius: inherit;
  background: rgba(247, 243, 233, 0.74);
  color: var(--sr-green-ink, #315a47);
  font-size: 12px;
  backdrop-filter: blur(2px);
}

.seat-loading-inner {
  display: flex;
  align-items: center;
  gap: 9px;
}

@media (max-width: 640px) {
  .venue-head {
    padding: 14px;
  }

  .venue-tools {
    width: 100%;
    justify-content: space-between;
  }

  .area-head {
    padding: 12px 14px;
  }

  .area-meta {
    display: none;
  }

  .seat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 0 14px 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .area-head,
  .chev {
    transition: none;
  }
}
</style>
