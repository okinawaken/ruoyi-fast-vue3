<template>
  <div v-loading="loading" class="tab-body">
    <div v-if="packages.length" class="package-cards">
      <article v-for="pkg in packages" :key="pkg.id" class="package-item">
        <div class="package-item-head">
          <h3 class="package-item-name">{{ pkg.packageName }}</h3>
          <span class="sr-chip" :class="packageChipClass(pkg)">
            <span class="sr-dot"></span>{{ pkg.showStatusDesc || (Number(pkg.canUsePay) === 1 ? '可使用' : '不可用') }}
          </span>
        </div>

        <div class="package-item-stats">
          <div class="pkg-stat">
            <span class="pkg-stat-label">剩余</span>
            <strong class="pkg-stat-value sr-mono">{{ pkg.restTimeStr || pkg.restNum || '—' }}</strong>
          </div>
          <div class="pkg-stat">
            <span class="pkg-stat-label">已用</span>
            <strong class="pkg-stat-value sr-mono">{{ pkg.usedTimeStr || '—' }}</strong>
          </div>
          <div class="pkg-stat">
            <span class="pkg-stat-label">有效期至</span>
            <strong class="pkg-stat-value sr-mono">{{ expiryText(pkg.useExpiryDate) }}</strong>
          </div>
        </div>

        <div class="package-item-meta">
          <span v-if="pkg.settleHourStr">可用时段 {{ pkg.settleHourStr }}</span>
          <span v-if="pkg.buyTimeStr">购买于 {{ pkg.buyTimeStr }}</span>
          <span v-if="pkg.leaveDateDesc" class="package-leave">已请假：{{ pkg.leaveDateDesc }}</span>
        </div>

        <p v-if="Number(pkg.canUsePay) !== 1 && pkg.canNotUsePayDesc" class="package-warn">
          <span class="package-warn-dot" aria-hidden="true"></span>
          <span class="package-warn-text">{{ pkg.canNotUsePayDesc }}</span>
        </p>

        <div v-if="pkg.userLeaveId" class="package-leave-bar">
          <span class="package-leave-tip">{{ pkg.leaveCancelDesc || '取消请假后，套餐将恢复正常扣费' }}</span>
          <el-button size="small" type="danger" plain @click="emit('cancel-leave', pkg)">取消请假</el-button>
        </div>
        <div v-else-if="Number(pkg.canLeaveBtn) === 1" class="package-item-actions">
          <el-button size="small" @click="emit('leave', pkg)">请假</el-button>
        </div>
      </article>
    </div>
    <div v-else class="sr-empty">
      <el-empty description="还没有已购套餐" :image-size="52" />
    </div>
  </div>
</template>

<script setup>
import { formatTimestamp } from '@/utils/study/value'

defineProps({
  packages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['leave', 'cancel-leave'])

function expiryText(value) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  const text = String(value)
  if (/^\d{10,13}$/.test(text)) {
    return formatTimestamp(Number(text)).slice(0, 10)
  }
  return text
}

function packageChipClass(pkg) {
  if (pkg.userLeaveId) {
    return 'sr-chip-amber'
  }
  return Number(pkg.canUsePay) === 1 ? 'sr-chip-green' : 'sr-chip-muted'
}
</script>

<style lang="scss" scoped>
.package-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.package-item {
  min-width: 0;
  padding: 15px 16px;
  border: 1px solid var(--sr-line);
  border-radius: 12px;
  background: var(--sr-card-2);
}

.package-item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.package-item-name {
  margin: 0;
  font-family: var(--sr-font-display);
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.package-item-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--sr-line);
  border-bottom: 1px solid var(--sr-line);
}

.pkg-stat-label {
  display: block;
  color: var(--sr-muted);
  font-size: 10px;
  letter-spacing: 0.05em;
}

.pkg-stat-value {
  display: block;
  margin-top: 2px;
  color: var(--sr-ink);
  font-size: 12.5px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.package-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-top: 10px;
  color: var(--sr-muted);
  font-size: 10.5px;
  line-height: 1.6;
}

.package-leave {
  color: var(--sr-amber-ink);
}

.package-warn {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 10px 0 0;
  padding: 7px 10px;
  border: 1px solid var(--sr-amber-line);
  border-radius: 8px;
  background: var(--sr-amber-soft);
  color: var(--sr-amber-ink);
  font-size: 11px;
  line-height: 1.55;
}

.package-warn-dot {
  flex: none;
  width: 5px;
  height: 5px;
  margin-top: 6px;
  border-radius: 50%;
  background: currentColor;
}

.package-warn-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.package-item-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.package-leave-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--sr-line);
}

.package-leave-tip {
  display: inline-flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  color: var(--sr-muted);
  font-size: 10.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

/* 上方已有告警条时，请假操作行不再重复分隔线 */
.package-warn + .package-leave-bar {
  margin-top: 8px;
  padding-top: 0;
  border-top: 0;
}

@media (max-width: 900px) {
  .package-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .package-item-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
