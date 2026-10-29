<template>
  <div class="studyroom-module">
    <div v-if="showLoading" class="sr-state" role="status" aria-live="polite">
      <div class="sr-state-inner">
        <el-icon class="is-loading sr-state-spin"><Loading /></el-icon>
        <p class="sr-state-text">正在读取自习室账号状态…</p>
      </div>
    </div>

    <div v-else-if="showError" class="sr-state" role="alert">
      <div class="sr-state-inner">
        <div class="sr-state-icon" aria-hidden="true">
          <el-icon><WarningFilled /></el-icon>
        </div>
        <h2 class="sr-state-title">账号状态加载失败</h2>
        <p class="sr-state-text">{{ store.statusError }}</p>
        <el-button type="primary" :loading="store.statusLoading" @click="retry">重新加载</el-button>
      </div>
    </div>

    <template v-else>
      <BindGate v-if="!store.isBound" />
      <template v-else>
        <TokenBanner v-if="!store.isTokenValid" />
        <slot />
      </template>
    </template>

    <BindTokenModal />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import useStudyStore from '@/store/modules/study'
import BindGate from './bind-gate.vue'
import BindTokenModal from './bind-token-modal.vue'
import TokenBanner from './token-banner.vue'

const store = useStudyStore()

const showLoading = computed(
  () => (!store.statusLoaded && !store.statusError) || (store.statusLoading && !store.isBound)
)

const showError = computed(() => !store.statusLoading && !!store.statusError && !store.isBound)

function retry() {
  store.statusError = ''
  store.statusLoaded = false
  store.fetchStatus()
}

onMounted(() => {
  store.ensureStatus()
})
</script>

<style lang="scss">
@import '../study.scss';
</style>

<style lang="scss" scoped>
.sr-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 58vh;
  padding: 24px 0;
  text-align: center;
}

.sr-state-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 420px;
  min-width: 0;
}

.sr-state-spin {
  font-size: 26px;
  color: var(--sr-green-2);
}

.sr-state-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1px solid var(--sr-amber-line);
  border-radius: 14px;
  background: var(--sr-amber-soft);
  color: var(--sr-amber);
  font-size: 22px;
}

.sr-state-title {
  margin: 0;
  font-family: var(--sr-font-display);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--sr-ink);
}

.sr-state-text {
  margin: 0;
  color: var(--sr-muted);
  font-size: 12.5px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
</style>
