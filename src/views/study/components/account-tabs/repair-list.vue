<template>
  <div v-loading="loading" class="tab-body">
    <div class="repair-toolbar">
      <p class="repair-hint">遇到座位、设备或环境问题，可以在这里提交报修。</p>
      <el-button type="primary" @click="emit('create')">提交报修</el-button>
    </div>

    <div v-if="repairs.length" class="repair-list">
      <article v-for="item in repairs" :key="item.id" class="repair-item">
        <div class="repair-main">
          <div class="repair-title-row">
            <strong class="repair-venue">{{ item.venueName || '未知门店' }}</strong>
            <span class="sr-chip" :class="Number(item.handleState) === 1 ? 'sr-chip-green' : 'sr-chip-amber'">
              <span class="sr-dot"></span>{{ Number(item.handleState) === 1 ? '已处理' : '处理中' }}
            </span>
          </div>
          <p class="repair-desc">{{ item.repairDesc }}</p>
          <p class="repair-time">{{ item.createTimeStr }}</p>
        </div>
        <el-button text @click="emit('detail', item.id)">查看详情</el-button>
      </article>
    </div>
    <div v-else class="sr-empty">
      <el-empty description="暂无报修记录" :image-size="52" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  repairs: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['create', 'detail'])
</script>

<style lang="scss" scoped>
.repair-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--sr-line);
}

.repair-hint {
  margin: 0;
  color: var(--sr-muted);
  font-size: 12px;
}

.repair-list {
  display: flex;
  flex-direction: column;
}

.repair-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 2px;
  border-bottom: 1px solid var(--sr-line);
}

.repair-main {
  min-width: 0;
}

.repair-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.repair-venue {
  color: var(--sr-ink);
  font-size: 13px;
  font-weight: 600;
}

.repair-desc {
  margin: 4px 0 0;
  color: var(--sr-ink-2);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.repair-time {
  margin: 3px 0 0;
  color: var(--sr-muted-2);
  font-size: 10.5px;
}

@media (max-width: 640px) {
  .repair-title-row {
    align-items: flex-start;
  }
}
</style>
