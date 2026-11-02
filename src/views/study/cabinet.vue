<template>
  <StudyShell>
    <div class="cabinet-page">
      <header class="sr-page-head">
        <div>
          <p class="sr-eyebrow">自习室 · 储物柜</p>
          <h1 class="sr-title">储物柜</h1>
          <p class="sr-sub">查看已租柜格、开锁，或租赁新的柜格。</p>
        </div>
        <div class="sr-actions">
          <el-select v-model="venueId" class="venue-select" placeholder="请选择门店" filterable @change="onVenueChange">
            <el-option v-for="venue in venueList" :key="venue.id" :label="venue.venueName" :value="venue.id" />
          </el-select>
          <el-button :loading="loading" @click="loadAll">
            <el-icon class="refresh-icon"><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </header>

      <div v-if="!venueId && !venueList.length" class="sr-card">
        <div class="sr-empty">
          <el-empty description="暂无可选门店" />
        </div>
      </div>

      <template v-else>
        <div class="sr-grid-2 cabinet-grid">
          <!-- 我的柜格 -->
          <section class="sr-card" v-loading="myLoading">
            <div class="sr-card-head">
              <h2 class="sr-card-title">我的柜格 <span class="sr-count">{{ myGrids.length }}</span></h2>
              <span class="sr-card-sub">开锁需在店内连接门店 WiFi</span>
            </div>

            <div v-if="myGrids.length" class="grid-list">
              <article v-for="grid in myGrids" :key="grid.gripId" class="grid-item">
                <div class="grid-main">
                  <strong class="grid-code sr-mono">{{ grid.gripCode }}</strong>
                  <span class="grid-cabinet">{{ grid.cabinetName || '储物柜' }}</span>
                  <p class="grid-meta">
                    <span v-if="grid.leaseEndTime">租期至 {{ grid.leaseEndTime }}</span>
                    <span v-if="Number(grid.checkoutStatus) === 1"> · 已退租</span>
                  </p>
                </div>
                <div class="grid-actions">
                  <el-button v-if="Number(grid.allowOpen) === 1" size="small" type="primary" plain @click="openGrid(grid)">开锁</el-button>
                  <el-button v-if="grid.lastLeaseId" size="small" text type="danger" @click="checkoutLease(grid)">退租</el-button>
                </div>
              </article>
            </div>
            <div v-else class="sr-empty">
              <el-empty description="当前门店没有已租柜格" :image-size="48" />
            </div>
          </section>

          <!-- 可租柜体 -->
          <section class="sr-card" v-loading="cabinetLoading">
            <div class="sr-card-head">
              <h2 class="sr-card-title">可租柜体 <span class="sr-count">{{ cabinets.length }}</span></h2>
            </div>

            <div v-if="cabinets.length" class="cabinet-list">
              <button
                v-for="cabinet in cabinets"
                :key="cabinet.cabinetId"
                type="button"
                class="cabinet-item"
                :class="{ 'is-active': Number(activeCabinetId) === Number(cabinet.cabinetId) }"
                @click="openCabinet(cabinet)"
              >
                <span class="cabinet-name">{{ cabinet.cabinetName }}</span>
                <span class="sr-chip sr-chip-muted">在售 {{ cabinet.saleCount ?? 0 }}</span>
              </button>
            </div>
            <div v-else class="sr-empty">
              <el-empty description="当前门店暂无可租柜体" :image-size="48" />
            </div>

            <div v-if="activeCabinetId" class="cabinet-grids" v-loading="gridLoading">
              <div class="cabinet-grids-head">
                <span class="sr-field-label">选择格口</span>
                <span class="cabinet-grids-hint">点击格口查看价格</span>
              </div>
              <div v-if="grids.length" class="grid-chips">
                <button v-for="grid in grids" :key="grid.gridId" type="button" class="grid-chip" @click="openPrice(grid)">
                  <span class="sr-mono">{{ grid.gridCode }}</span>
                  <span class="grid-chip-state">状态 {{ grid.gridStatus }}</span>
                </button>
              </div>
              <div v-else-if="!gridLoading" class="sr-empty">
                <el-empty description="该柜体暂无格口" :image-size="42" />
              </div>
            </div>
          </section>
        </div>

        <!-- 租赁订单 -->
        <section class="sr-card orders-card" v-loading="orderLoading">
          <div class="sr-card-head">
            <h2 class="sr-card-title">租赁订单 <span class="sr-count">{{ leaseOrders.length }}</span></h2>
          </div>
          <el-table :data="leaseOrders" empty-text="暂无租赁订单">
            <el-table-column prop="cabinetNo" label="柜号" min-width="130" />
            <el-table-column prop="venueName" label="门店" min-width="180" show-overflow-tooltip />
            <el-table-column label="租期" min-width="190">
              <template #default="{ row }">
                <span class="sr-mono">{{ row.startDateStr || '—' }} – {{ row.endDateStr || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="100" align="right">
              <template #default="{ row }"><span class="sr-mono">¥{{ formatMoney(row.priceYuan) }}</span></template>
            </el-table-column>
            <el-table-column prop="payStateStr" label="状态" width="100" align="center">
              <template #default="{ row }">
                <span class="sr-chip" :class="Number(row.payState) === 1 ? 'sr-chip-green' : 'sr-chip-amber'">
                  <span class="sr-dot"></span>{{ row.payStateStr || '—' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="createTimeStr" label="创建时间" width="165" />
          </el-table>
        </section>
      </template>
    </div>

    <!-- 格口价格 / 租赁 -->
    <el-dialog v-model="priceVisible" class="sr-dialog" title="租赁柜格" width="440px" :close-on-click-modal="false">
      <div v-loading="priceLoading" class="price-body">
        <template v-if="price">
          <div class="sr-kv"><span class="sr-kv-key">格口</span><span class="sr-kv-value sr-mono">{{ price.gridCode || price.gridId }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">可租起始</span><span class="sr-kv-value">{{ price.startDate || '—' }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">可租结束</span><span class="sr-kv-value">{{ price.endDate || '—' }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">租金</span><span class="sr-kv-value sr-price">¥{{ formatMoney(price.price) }}</span></div>

          <div class="sr-dialog-note is-warning">
            提交后生成租约与待支付订单；微信支付只能在小程序内完成，本页面仅可查看支付参数。
          </div>

          <div class="sr-dialog-foot price-actions">
            <el-button :disabled="leasing" @click="priceVisible = false">取消</el-button>
            <el-button type="primary" :loading="leasing" @click="submitLease">确认租赁</el-button>
          </div>
        </template>
        <div v-else-if="!priceLoading" class="sr-empty">
          <el-empty description="该格口暂不可租" />
        </div>
      </div>
    </el-dialog>

    <!-- 支付参数 -->
    <el-dialog v-model="payVisible" class="sr-dialog" title="租约已创建" width="460px">
      <div class="pay-body">
        <div class="sr-kv"><span class="sr-kv-key">租约 ID</span><span class="sr-kv-value sr-mono">{{ leaseResult?.id || '—' }}</span></div>
        <div class="sr-kv"><span class="sr-kv-key">支付单 ID</span><span class="sr-kv-value sr-mono">{{ leaseResult?.payId || '—' }}</span></div>

        <div v-if="payParams" class="pay-params">
          <span class="sr-field-label">支付参数</span>
          <pre class="pay-params-code">{{ payParamsText }}</pre>
        </div>

        <div class="sr-dialog-note">请在小程序内完成支付，支付后柜格才会生效。</div>

        <div class="sr-dialog-foot pay-actions">
          <el-button :loading="payLoading" @click="loadLeasePayParams">获取支付参数</el-button>
          <el-button type="primary" @click="copyPayParams">复制参数</el-button>
        </div>
      </div>
    </el-dialog>
  </StudyShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import StudyShell from './components/study-shell.vue'
import { studyMiscApi } from '@/api/study/misc'
import { studyUserApi } from '@/api/study/user'
import useStudyStore from '@/store/modules/study'
import { formatMoney } from '@/utils/study/value'
import { useLatestRequest } from '@/composables/study/useLatestRequest'
import { useStudyRefresh } from '@/composables/study/useStudyRefresh'
import { useVenueOptions } from '@/composables/study/useVenueOptions'

const store = useStudyStore()
// 支付接口需要的小程序用户 ID，与后台登录用户 ID 不是同一套体系
const miniUserId = ref(null)

const { venues: venueList, load: loadVenueOptions } = useVenueOptions()
const venueId = ref(null)
const loading = ref(false)
const loadRequest = useLatestRequest()

const myGrids = ref([])
const myLoading = ref(false)
const cabinets = ref([])
const cabinetLoading = ref(false)
const activeCabinetId = ref(null)
const grids = ref([])
const gridLoading = ref(false)
const leaseOrders = ref([])
const orderLoading = ref(false)

const priceVisible = ref(false)
const priceLoading = ref(false)
const price = ref(null)
const leasing = ref(false)

const payVisible = ref(false)
const leaseResult = ref(null)
const payParams = ref(null)
const payLoading = ref(false)

const payParamsText = computed(() => (payParams.value ? JSON.stringify(payParams.value, null, 2) : ''))

async function loadVenues() {
  try {
    await loadVenueOptions()
    if (!venueId.value && venueList.value.length) {
      venueId.value = venueList.value[0].id
    }
  } catch (e) {
    venueList.value = []
  }
}

async function loadMyGrids(seq) {
  if (!venueId.value) {
    return
  }
  myLoading.value = true
  try {
    const res = await studyMiscApi.cabinetUserGridList(venueId.value)
    if (!loadRequest.isLatest(seq)) {
      return
    }
    myGrids.value = res?.data?.list || []
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (loadRequest.isLatest(seq)) {
      myLoading.value = false
    }
  }
}

async function loadCabinets(seq) {
  if (!venueId.value) {
    return
  }
  cabinetLoading.value = true
  activeCabinetId.value = null
  grids.value = []
  try {
    const res = await studyMiscApi.cabinetVenueList(venueId.value)
    if (!loadRequest.isLatest(seq)) {
      return
    }
    cabinets.value = res?.data?.list || []
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (loadRequest.isLatest(seq)) {
      cabinetLoading.value = false
    }
  }
}

async function loadOrders(seq) {
  orderLoading.value = true
  try {
    const res = await studyMiscApi.cabinetLeaseOrderList()
    if (!loadRequest.isLatest(seq)) {
      return
    }
    leaseOrders.value = res?.data?.list || []
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (loadRequest.isLatest(seq)) {
      orderLoading.value = false
    }
  }
}

async function loadAll() {
  if (!store.isTokenValid || !venueId.value) {
    return
  }
  const seq = loadRequest.next()
  loading.value = true
  await Promise.allSettled([loadMyGrids(seq), loadCabinets(seq), loadOrders(seq)])
  if (loadRequest.isLatest(seq)) {
    loading.value = false
  }
}

function onVenueChange() {
  loadAll()
}

async function openCabinet(cabinet) {
  // 后端柜体 VO 的主键字段是 cabinetId
  activeCabinetId.value = cabinet.cabinetId
  gridLoading.value = true
  grids.value = []
  try {
    const res = await studyMiscApi.cabinetGridList(cabinet.cabinetId)
    grids.value = res?.data?.list || []
  } catch (e) {
    store.handleApiError(e)
  } finally {
    gridLoading.value = false
  }
}

async function openPrice(grid) {
  priceVisible.value = true
  priceLoading.value = true
  price.value = null
  try {
    const res = await studyMiscApi.cabinetGridPrice(grid.gridId)
    price.value = res?.data || null
  } catch (e) {
    store.handleApiError(e)
  } finally {
    priceLoading.value = false
  }
}

async function submitLease() {
  if (!price.value || leasing.value) {
    return
  }
  if (!price.value.startDate || !price.value.endDate) {
    ElMessage.warning('该格口缺少可租日期，暂不可下单')
    return
  }
  leasing.value = true
  try {
    const res = await studyMiscApi.cabinetLeaseCommit({
      amount: price.value.price,
      startDate: price.value.startDate,
      endDate: price.value.endDate,
      gridId: price.value.gridId,
      leaseType: 1
    })
    leaseResult.value = res?.data || null
    payParams.value = null
    priceVisible.value = false
    payVisible.value = true
    ElMessage.success('租约已创建')
    loadAll()
  } catch (e) {
    store.handleApiError(e)
  } finally {
    leasing.value = false
  }
}

async function loadLeasePayParams() {
  if (!leaseResult.value?.id || payLoading.value) {
    return
  }
  payLoading.value = true
  try {
    // 支付接口的 userId 属于小程序用户体系，不能用后台登录用户 ID
    if (!miniUserId.value) {
      const userRes = await studyUserApi.detail()
      miniUserId.value = userRes?.data?.id ?? null
    }
    if (!miniUserId.value) {
      ElMessage.warning('未获取到小程序用户信息，请刷新后重试')
      return
    }
    const res = await studyMiscApi.cabinetLeasePay(leaseResult.value.id, miniUserId.value)
    payParams.value = res?.data || null
  } catch (e) {
    store.handleApiError(e)
  } finally {
    payLoading.value = false
  }
}

async function copyPayParams() {
  if (!payParamsText.value) {
    ElMessage.warning('请先获取支付参数')
    return
  }
  try {
    await navigator.clipboard.writeText(payParamsText.value)
    ElMessage.success('支付参数已复制')
  } catch (e) {
    ElMessage.warning('当前浏览器不支持自动复制，请手动选择复制')
  }
}

function openGrid(grid) {
  ElMessageBox.confirm(`确认打开柜格 ${grid.gripCode}？请确保已在门店内。`, '开锁', {
    confirmButtonText: '确认开锁',
    cancelButtonText: '取消',
    type: 'warning',
    customClass: 'sr-message-box'
  })
    .then(async () => {
      try {
        await studyMiscApi.cabinetWifiOpen(grid.gripId)
        ElMessage.success('开锁指令已发送')
      } catch (e) {
        store.handleApiError(e)
      }
    })
    .catch(() => {})
}

function checkoutLease(grid) {
  ElMessageBox.confirm(
    '退租会立即结束当前租约，柜格内物品请提前取出。该操作不可撤销。',
    '退租',
    {
      confirmButtonText: '确认退租',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'sr-message-box'
    }
  )
    .then(async () => {
      try {
        await studyMiscApi.cabinetLeaseAutoCheckout(grid.lastLeaseId)
        ElMessage.success('已提交退租')
        loadAll()
      } catch (e) {
        store.handleApiError(e)
      }
    })
    .catch(() => {})
}

useStudyRefresh(() => loadAll())

onMounted(async () => {
  store.ensureStatus()
  await store.fetchConfig()
  await loadVenues()
  await loadAll()
})
</script>

<style lang="scss" scoped>
.cabinet-page {
  min-width: 0;
}

.venue-select {
  width: 220px;
}

.refresh-icon {
  margin-right: 4px;
}

.cabinet-grid {
  margin-bottom: 18px;
}

.grid-list {
  display: flex;
  flex-direction: column;
}

.grid-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 18px;
  border-top: 1px solid var(--sr-line);
}

.grid-item:first-child {
  border-top: 0;
}

.grid-main {
  min-width: 0;
}

.grid-code {
  color: var(--sr-ink);
  font-size: 15px;
  font-weight: 600;
}

.grid-cabinet {
  margin-left: 8px;
  color: var(--sr-muted);
  font-size: 12px;
}

.grid-meta {
  margin: 3px 0 0;
  color: var(--sr-muted);
  font-size: 10.5px;
}

.grid-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.cabinet-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 18px 14px;
}

.cabinet-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border: 1px solid var(--sr-line);
  border-radius: 9px;
  background: var(--sr-card-2);
  color: var(--sr-ink-2);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--sr-green-line);
    background: var(--sr-green-soft);
  }

  &.is-active {
    border-color: var(--sr-green);
    background: var(--sr-green-soft);
    color: var(--sr-green-ink);
  }
}

.cabinet-name {
  font-weight: 500;
}

.cabinet-grids {
  padding: 0 18px 16px;
}

.cabinet-grids-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--sr-line);
}

.cabinet-grids-hint {
  color: var(--sr-muted-2);
  font-size: 10.5px;
}

.grid-chips {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.grid-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--sr-line);
  border-radius: 8px;
  background: var(--sr-card);
  color: var(--sr-ink);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--sr-green-line);
    background: var(--sr-green-soft);
  }
}

.grid-chip-state {
  color: var(--sr-muted-2);
  font-size: 9.5px;
}

.orders-card {
  overflow: hidden;
}

.orders-card :deep(.el-table) {
  border-top: 1px solid var(--sr-line);
}

.price-body {
  min-height: 100px;
}

.price-actions {
  margin-top: 16px;
}

.pay-params {
  margin-top: 14px;
}

.pay-params-code {
  max-height: 180px;
  margin: 6px 0 0;
  padding: 10px 12px;
  border: 1px solid #e4dcc9;
  border-radius: 9px;
  background: #fbf8ef;
  color: #2a3a32;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow: auto;
}

.pay-actions {
  margin-top: 16px;
}

@media (max-width: 900px) {
  .grid-chips {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .venue-select {
    width: 100%;
  }

  .grid-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .grid-chips {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cabinet-list,
  .cabinet-grids {
    padding-left: 14px;
    padding-right: 14px;
  }
}
</style>
