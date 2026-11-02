<template>
  <section class="sr-card reserve-filter" aria-label="预约筛选">
    <div class="rf-field">
      <label class="rf-label" for="srVenueSelect">门店</label>
      <el-select
        id="srVenueSelect"
        :model-value="venueId"
        class="rf-select rf-select-venue"
        :disabled="disabled"
        placeholder="请选择门店"
        filterable
        @change="emit('venue-change', $event)"
      >
        <el-option v-for="venue in venueOptions" :key="venue.id" :label="venue.venueName" :value="venue.id" />
      </el-select>
    </div>

    <div class="rf-field">
      <label class="rf-label" for="srDateSelect">日期</label>
      <el-select
        id="srDateSelect"
        :model-value="dateValue"
        class="rf-select rf-select-date"
        :disabled="disabled"
        placeholder="请选择日期"
        @change="emit('date-change', $event)"
      >
        <el-option v-for="date in dateOptions" :key="date.value" :label="date.label" :value="date.value" />
      </el-select>
    </div>

    <div class="rf-field">
      <span class="rf-label">时段</span>
      <div class="rf-time-range">
        <el-select
          :model-value="startTime"
          class="rf-select rf-select-time"
          :disabled="disabled || !startOptions.length"
          placeholder="开始"
          aria-label="开始时间"
          @change="emit('start-change', $event)"
        >
          <el-option v-for="time in startOptions" :key="time" :label="time" :value="time" />
        </el-select>
        <span class="rf-dash" aria-hidden="true">–</span>
        <el-select
          :model-value="endTime"
          class="rf-select rf-select-time"
          :disabled="disabled || !endOptions.length"
          placeholder="结束"
          aria-label="结束时间"
          @change="emit('end-change', $event)"
        >
          <el-option v-for="time in endOptions" :key="time" :label="time" :value="time" />
        </el-select>
      </div>
    </div>

    <div class="rf-field">
      <span class="rf-label">快捷时长</span>
      <div class="rf-quick" role="group" aria-label="快捷时长">
        <el-button
          v-for="hour in quickHours"
          :key="hour"
          size="small"
          :type="isQuickActive(hour) ? 'primary' : 'default'"
          :disabled="disabled || !endOptions.length"
          @click="emit('quick', hour)"
        >
          {{ hour }} 小时
        </el-button>
      </div>
    </div>

    <div class="rf-hints">
      <span>按门店营业时间选择起止时间</span>
      <span>最短 {{ minHoursText || '1 小时' }} · 快捷时长只填入结束时间</span>
    </div>
  </section>
</template>

<script setup>
import { parseTimeToMinutes } from '@/utils/study/time'

const props = defineProps({
  venueOptions: { type: Array, default: () => [] },
  venueId: { type: [Number, String], default: null },
  dateOptions: { type: Array, default: () => [] },
  dateValue: { type: String, default: '' },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  startOptions: { type: Array, default: () => [] },
  endOptions: { type: Array, default: () => [] },
  quickHours: { type: Array, default: () => [] },
  minHoursText: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['venue-change', 'date-change', 'start-change', 'end-change', 'quick'])

function isQuickActive(hour) {
  const start = parseTimeToMinutes(props.startTime)
  const end = parseTimeToMinutes(props.endTime)
  if (start === null || end === null) {
    return false
  }
  return end - start === hour * 60
}
</script>

<style lang="scss" scoped>
.reserve-filter {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 14px 18px;
  min-width: 0;
  margin-bottom: 18px;
  padding: 16px 18px;
}

.rf-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.rf-label {
  color: var(--sr-muted, #5f6c64);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.07em;
  line-height: 1.4;
}

.rf-select-venue {
  width: 220px;
}

.rf-select-date {
  width: 180px;
}

.rf-select-time {
  width: 112px;
}

.rf-time-range {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.rf-dash {
  color: var(--sr-muted-2, #75827a);
  font-size: 12px;
  flex: none;
}

.rf-quick {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;

  :deep(.el-button) {
    height: 30px;
    padding: 0 11px;
    border-radius: 999px;
    font-size: 11.5px;
  }

  :deep(.el-button--default) {
    border-color: var(--sr-line-strong, #d4c9b3);
    background: transparent;
    color: var(--sr-muted, #5f6c64);

    &:hover {
      background: var(--sr-paper-2, #efe9db);
      color: var(--sr-ink, #1b2a24);
    }
  }
}

.rf-hints {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 16px;
  width: 100%;
  padding-top: 2px;
  color: var(--sr-muted-2, #75827a);
  font-size: 10.5px;
  line-height: 1.5;

  span:last-child {
    margin-left: auto;
  }
}

@media (max-width: 900px) {
  .reserve-filter {
    gap: 12px 14px;
  }
}

@media (max-width: 640px) {
  .reserve-filter {
    padding: 14px;
    gap: 12px;
  }

  .rf-field {
    flex: 1 1 100%;
    width: 100%;
  }

  .rf-select-venue,
  .rf-select-date,
  .rf-select-time {
    width: 100%;
  }

  .rf-time-range {
    width: 100%;

    :deep(.el-select) {
      flex: 1 1 0;
      min-width: 0;
      width: auto;
    }
  }

  .rf-quick {
    width: 100%;
  }

  .rf-hints span:last-child {
    margin-left: 0;
  }
}
</style>
