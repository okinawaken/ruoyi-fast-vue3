<template>
  <section class="sr-card guard-card">
    <div class="sr-card-head">
      <h2 class="sr-card-title">
        门禁
        <span class="sr-count">{{ guardList.length }}</span>
      </h2>
      <div class="guard-head-meta">
        <span class="sr-chip sr-chip-muted guard-venue">
          <el-icon><Location /></el-icon>
          <span class="guard-venue-name">{{ venueName || '当前门店' }}</span>
        </span>
      </div>
      <el-button class="guard-refresh" text size="small" :loading="guardLoading" aria-label="刷新门禁" @click="loadGuardList">
        <el-icon class="refresh-icon"><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <div v-if="guardError" class="sr-empty">
      <el-empty :description="guardError" :image-size="46" />
    </div>

    <div v-else class="guard-body" v-loading="guardLoading">
      <div v-if="guardList.length" class="guard-list">
        <div v-for="item in guardList" :key="item.id" class="guard-item">
          <span class="guard-icon" :class="{ 'is-off': !canOpenGuard(item) }" aria-hidden="true">
            <el-icon><Lock /></el-icon>
          </span>

          <div class="guard-main">
            <strong>{{ item.areaAliasName || '门禁区域' }}</strong>
            <span class="guard-meta" :class="canOpenGuard(item) ? 'is-ok' : 'is-off'">
              <span class="sr-dot" aria-hidden="true"></span>
              {{ canOpenGuard(item) ? '可开门' : item.canNotOpenDesc || '暂不可开门' }}
            </span>
          </div>

          <div class="guard-action">
            <el-button
              v-if="canOpenGuard(item)"
              type="primary"
              :loading="guardOpeningId === item.id"
              @click="openGuard(item)"
            >
              开门
            </el-button>
            <el-button v-else disabled>开门</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="当前门店暂无门禁区域" :image-size="46" />
    </div>

    <p class="guard-note">
      <el-icon><InfoFilled /></el-icon>
      <span>
        {{ guardBleStatus || '点击开门会先做服务端校验，再由浏览器通过 TTLock 蓝牙连接门锁开锁；请使用 Chrome/Edge，并确保电脑在门锁附近。' }}
      </span>
    </p>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { studyGuardApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import { isWebBluetoothSupported, openLockByBle, requestLockDevice } from '@/utils/study/ttlock-ble'
import { useStudyRefresh } from '@/composables/study/useStudyRefresh'

const props = defineProps({
  venueId: { type: [String, Number], default: null },
  venueName: { type: String, default: '' }
})

const store = useStudyStore()

const guardList = ref([])
const guardLoading = ref(false)
const guardError = ref('')
const guardOpeningId = ref(null)
const guardBleStatus = ref('')
/** 每个门禁记住用户选择过的蓝牙设备，避免每次开门都弹选择框 */
const guardDeviceCache = new Map()

function canOpenGuard(item) {
  return Number(item?.canOpen) === 1
}

async function loadGuardList() {
  if (!store.isTokenValid || !props.venueId) {
    guardList.value = []
    guardError.value = ''
    return
  }
  guardLoading.value = true
  guardError.value = ''
  try {
    const res = await studyGuardApi.select(Number(props.venueId))
    guardList.value = Array.isArray(res?.data?.guardList) ? res.data.guardList : []
  } catch (e) {
    guardList.value = []
    if (!store.handleApiError(e)) {
      guardError.value = e?.msg || '门禁列表加载失败，请稍后重试。'
    }
  } finally {
    guardLoading.value = false
  }
}

async function openGuard(item) {
  if (!item || guardOpeningId.value) {
    return
  }
  if (!canOpenGuard(item)) {
    ElMessage.warning(item?.canNotOpenDesc || '当前门禁暂不可开')
    return
  }
  if (!item.configJsonTwo) {
    ElMessage.warning('后台未下发蓝牙钥匙，暂时无法开门')
    return
  }
  if (!isWebBluetoothSupported()) {
    ElMessage.warning('当前浏览器不支持蓝牙开门，请使用 Chrome 或 Edge')
    return
  }

  guardOpeningId.value = item.id
  guardBleStatus.value = '正在准备蓝牙设备...'
  try {
    let device = guardDeviceCache.get(item.id)
    if (!device) {
      // 设备选择框必须在用户点击手势内弹出，不能等服务端请求之后再弹
      device = await requestLockDevice()
      guardDeviceCache.set(item.id, device)
    }

    guardBleStatus.value = '正在提交服务端校验...'
    try {
      await studyGuardApi.open(item.id)
    } catch (e) {
      if (!store.handleApiError(e)) {
        ElMessage.error(e?.msg || '开门失败')
      }
      return
    }

    await openLockByBle(device, item.configJsonTwo, {
      onProgress: text => {
        guardBleStatus.value = text
      }
    })
    ElMessage.success('开门成功')
    await loadGuardList()
  } catch (e) {
    guardDeviceCache.delete(item.id)
    if (e?.cancelled) {
      ElMessage.info(e.message)
    } else {
      ElMessage.error(e?.message || e?.msg || '蓝牙开锁失败')
    }
  } finally {
    guardOpeningId.value = null
    guardBleStatus.value = ''
  }
}

watch(() => props.venueId, () => loadGuardList(), { immediate: true })

useStudyRefresh(() => loadGuardList())
</script>

<style lang="scss" scoped>
.guard-card {
  margin-bottom: 18px;

  .sr-card-head {
    gap: 10px;
  }
}

.refresh-icon {
  margin-right: 4px;
}

.guard-head-meta {
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 46%;
  margin-right: auto;
}

.guard-venue {
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  color: var(--sr-muted);

  .el-icon {
    flex: none;
    color: var(--sr-muted-2);
    font-size: 12px;
  }
}

.guard-venue-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.guard-refresh {
  flex: none;
  color: var(--sr-muted);
}

.guard-body {
  min-height: 64px;

  .el-empty {
    padding: 16px 0;
  }

  :deep(.el-empty__description p) {
    color: var(--sr-muted);
    font-size: 12px;
  }
}

.guard-list {
  display: flex;
  flex-direction: column;
}

.guard-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 18px;
  border-top: 1px solid var(--sr-line);
  transition: background-color 0.15s ease;
}

.guard-item:first-child {
  border-top: 0;
}

.guard-item:hover {
  background: var(--sr-card-2);
}

.guard-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid var(--sr-green-line);
  border-radius: 10px;
  background: var(--sr-green-soft);
  color: var(--sr-green-ink);
  font-size: 16px;
}

.guard-icon.is-off {
  border-color: var(--sr-line);
  background: var(--sr-paper-2);
  color: var(--sr-muted-2);
}

.guard-main {
  min-width: 0;
  flex: 1 1 auto;
}

.guard-main strong {
  display: block;
  color: var(--sr-ink);
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.guard-meta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  color: var(--sr-muted);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.guard-meta.is-ok {
  color: var(--sr-green-ink);
}

.guard-meta.is-off {
  color: var(--sr-amber-ink);
}

.guard-action {
  display: flex;
  align-items: center;
  flex: none;
}

.guard-action .el-button {
  min-width: 78px;
}

.guard-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0;
  padding: 11px 18px 12px;
  border-top: 1px solid var(--sr-line);
  border-radius: 0 0 var(--sr-radius) var(--sr-radius);
  background: var(--sr-card-2);
  color: var(--sr-muted);
  font-size: 12px;
  line-height: 1.6;
}

.guard-note .el-icon {
  flex: none;
  margin-top: 2px;
  color: var(--sr-muted-2);
}

@media (max-width: 640px) {
  .guard-card .sr-card-head {
    flex-wrap: wrap;
  }

  .guard-head-meta {
    order: 3;
    flex: 1 1 100%;
    max-width: 100%;
    margin-top: 2px;
  }

  .guard-refresh {
    margin-left: auto;
  }

  .guard-item {
    flex-wrap: wrap;
  }

  .guard-action {
    flex: 1 1 100%;
  }

  .guard-action .el-button {
    width: 100%;
  }
}
</style>
