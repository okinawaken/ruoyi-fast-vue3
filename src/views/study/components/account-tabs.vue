<template>
  <section class="sr-card account-tabs">
    <div class="sr-card-head account-tabs-head">
      <h2 class="sr-card-title">账户服务</h2>
      <span class="sr-card-sub">已购套餐、订单与报修进度</span>
    </div>

    <div class="account-tabs-body">
      <el-tabs v-model="activeTab">
        <!-- 我的套餐 -->
        <el-tab-pane name="packages">
          <template #label>
            <span class="tab-label">我的套餐 <span class="sr-count">{{ userPackages.length }}</span></span>
          </template>
          <PackageList
            :packages="userPackages"
            :loading="packageLoading"
            @leave="openLeave"
            @cancel-leave="cancelLeave"
          />
        </el-tab-pane>

        <!-- 我的订单 -->
        <el-tab-pane name="orders">
          <template #label>
            <span class="tab-label">我的订单 <span class="sr-count">{{ orders.length }}</span></span>
          </template>
          <OrderList :orders="orders" :loading="orderLoading" />
        </el-tab-pane>

        <!-- 报修 -->
        <el-tab-pane name="repairs">
          <template #label>
            <span class="tab-label">报修 <span class="sr-count">{{ repairs.length }}</span></span>
          </template>
          <RepairList
            :repairs="repairs"
            :loading="repairLoading"
            @create="openRepair"
            @detail="openRepairDetail"
          />
        </el-tab-pane>
      </el-tabs>
    </div>

    <LeaveDialog
      v-model:visible="leaveVisible"
      :user-package-id="leavePackageId"
      @saved="onLeaveSaved"
    />

    <RepairFormDialog
      v-model:visible="repairVisible"
      :venues="venueList"
      @submitted="onRepairSubmitted"
    />

    <RepairDetailDialog
      v-model:visible="repairDetailVisible"
      :repair-id="repairDetailId"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PackageList from './account-tabs/package-list.vue'
import OrderList from './account-tabs/order-list.vue'
import RepairList from './account-tabs/repair-list.vue'
import LeaveDialog from './account-tabs/leave-dialog.vue'
import RepairFormDialog from './account-tabs/repair-form-dialog.vue'
import RepairDetailDialog from './account-tabs/repair-detail-dialog.vue'
import { studyLeaveApi } from '@/api/study/leave'
import { studyPackageApi } from '@/api/study/package'
import { studyRepairApi } from '@/api/study/repair'
import useStudyStore from '@/store/modules/study'
import { useLatestRequest } from '@/composables/study/useLatestRequest'
import { useVenueOptions } from '@/composables/study/useVenueOptions'

const props = defineProps({
  refreshSeq: { type: Number, default: 0 },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits(['update:busy'])

const store = useStudyStore()

const activeTab = ref('packages')
const userPackages = ref([])
const orders = ref([])
const repairs = ref([])
const { venues: venueList, load: loadVenueOptions } = useVenueOptions({ filter: false })

const packageLoading = ref(false)
const orderLoading = ref(false)
const repairLoading = ref(false)

const loadRequest = useLatestRequest()

const leaveVisible = ref(false)
const leavePackageId = ref(null)

const repairVisible = ref(false)
const repairDetailVisible = ref(false)
const repairDetailId = ref(null)

const busy = computed(() => packageLoading.value || orderLoading.value || repairLoading.value)

watch(busy, value => emit('update:busy', value))

async function loadPackages(seq) {
  packageLoading.value = true
  try {
    const res = await studyPackageApi.userPackageList()
    if (!loadRequest.isLatest(seq)) {
      return
    }
    userPackages.value = res?.data?.list || []
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (loadRequest.isLatest(seq)) {
      packageLoading.value = false
    }
  }
}

async function loadOrders(seq) {
  orderLoading.value = true
  try {
    const res = await studyPackageApi.userOrderList()
    if (!loadRequest.isLatest(seq)) {
      return
    }
    orders.value = res?.data?.list || []
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (loadRequest.isLatest(seq)) {
      orderLoading.value = false
    }
  }
}

async function loadRepairs(seq) {
  repairLoading.value = true
  try {
    const res = await studyRepairApi.list()
    if (!loadRequest.isLatest(seq)) {
      return
    }
    repairs.value = res?.data?.list || []
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (loadRequest.isLatest(seq)) {
      repairLoading.value = false
    }
  }
}

async function loadVenues() {
  try {
    await loadVenueOptions()
  } catch (e) {
    venueList.value = []
  }
}

async function loadAll() {
  if (!store.isTokenValid) {
    return
  }
  const seq = loadRequest.next()
  await Promise.allSettled([loadPackages(seq), loadOrders(seq), loadRepairs(seq)])
}

/* ---------------- 请假 / 报修动作 ---------------- */
function openLeave(pkg) {
  leavePackageId.value = pkg.id
  leaveVisible.value = true
}

async function onLeaveSaved() {
  await loadPackages(loadRequest.current())
}

function cancelLeave(pkg) {
  ElMessageBox.confirm('取消请假后，套餐将恢复正常扣费。是否继续？', '取消请假', {
    confirmButtonText: '确认取消',
    cancelButtonText: '再想想',
    type: 'warning',
    customClass: 'sr-message-box'
  })
    .then(async () => {
      try {
        await studyLeaveApi.cancel(pkg.userLeaveId)
        ElMessage.success('已取消请假')
        await loadPackages(loadRequest.current())
      } catch (e) {
        store.handleApiError(e)
      }
    })
    .catch(() => {})
}

function openRepair() {
  repairVisible.value = true
}

async function onRepairSubmitted() {
  await loadRepairs(loadRequest.current())
  activeTab.value = 'repairs'
}

function openRepairDetail(id) {
  repairDetailId.value = id
  repairDetailVisible.value = true
}

watch(
  () => [store.isTokenValid, store.refreshKey, props.refreshSeq],
  ([valid]) => {
    if (valid) {
      loadAll()
    }
  },
  { immediate: true }
)

onMounted(async () => {
  store.ensureStatus()
  await store.fetchConfig()
  await loadVenues()
})
</script>

<style lang="scss" scoped>
.account-tabs {
  margin-top: 20px;
  padding-bottom: 6px;
}

.account-tabs-head {
  align-items: baseline;
}

.account-tabs-body {
  padding: 0 18px;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.account-tabs-body :deep(.tab-body) {
  min-height: 160px;
  padding-top: 6px;
}

@media (max-width: 640px) {
  .account-tabs-body {
    padding: 0 14px;
  }
}
</style>
