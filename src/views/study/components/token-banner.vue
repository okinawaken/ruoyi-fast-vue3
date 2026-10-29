<template>
  <div class="sr-expire-banner" role="alert">
    <el-icon class="sr-expire-icon"><WarningFilled /></el-icon>
    <p class="sr-expire-text">
      <strong>小程序 token 已失效。</strong>当前数据可能不是最新，重新绑定后会自动刷新本页。
    </p>
    <el-button class="sr-expire-action" @click="store.openBindModal()">重新绑定</el-button>
  </div>
</template>

<script setup>
import useStudyStore from '@/store/modules/study'

const store = useStudyStore()
</script>

<style lang="scss" scoped>
.sr-expire-banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
  margin-bottom: 16px;
  padding: 10px 14px;
  border: 1px solid var(--sr-amber-line, #e7c98f);
  border-radius: 10px;
  background: var(--sr-amber-soft, #fbf0dc);
  color: var(--sr-amber-ink, #6b4a12);
  font-size: 12.5px;
  line-height: 1.55;
}

.sr-expire-icon {
  font-size: 16px;
  flex: none;
}

.sr-expire-text {
  flex: 1 1 240px;
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;

  strong {
    font-weight: 600;
  }
}

.sr-expire-action {
  flex: none;
  border-color: var(--sr-amber-line, #e7c98f);
  background: var(--sr-card, #fffdf8);
  color: var(--sr-amber-ink, #6b4a12);

  &:hover {
    border-color: var(--sr-amber, #8a5a12);
    color: var(--sr-amber, #8a5a12);
  }
}

@media (max-width: 640px) {
  .sr-expire-banner {
    padding: 10px 12px;
  }

  .sr-expire-action {
    width: 100%;
  }
}
</style>
