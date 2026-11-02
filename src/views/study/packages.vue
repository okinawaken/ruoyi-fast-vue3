<template>
  <StudyShell>
    <div class="packages-page">
      <header class="sr-page-head">
        <div>
          <p class="sr-eyebrow">自习室 · 套餐</p>
          <h1 class="sr-title">套餐中心</h1>
          <p class="sr-sub">按门店、类型与标签筛选套餐，查看权益后下单。</p>
        </div>
        <div class="sr-actions">
          <el-button :loading="loading" @click="loadPackages">
            <el-icon class="refresh-icon"><Refresh /></el-icon>
            刷新套餐
          </el-button>
        </div>
      </header>

      <section class="sr-card packages-filter" aria-label="套餐筛选">
        <div class="pf-field">
          <span class="pf-label">门店</span>
          <el-select v-model="query.venueId" class="pf-select pf-venue" placeholder="全部门店" clearable filterable @change="onVenueChange">
            <el-option v-for="venue in options.venueList" :key="venue.id" :label="venue.name" :value="venue.id" />
          </el-select>
        </div>
        <div class="pf-field">
          <span class="pf-label">类型</span>
          <el-select v-model="query.packageType" class="pf-select" placeholder="全部类型" clearable>
            <el-option v-for="type in options.packageTypeList" :key="type.id" :label="type.name" :value="type.id" />
          </el-select>
        </div>
        <div class="pf-field">
          <span class="pf-label">标签</span>
          <el-select
            v-model="query.packageLabelIds"
            class="pf-select pf-labels"
            placeholder="全部标签"
            multiple
            collapse-tags
            clearable
          >
            <el-option v-for="label in options.packageLabelList" :key="label.id" :label="label.name" :value="label.id" />
          </el-select>
        </div>
        <div class="pf-field">
          <span class="pf-label">区域</span>
          <el-select v-model="query.seatAreaId" class="pf-select" placeholder="全部区域" clearable :disabled="!query.venueId">
            <el-option v-for="area in seatAreas" :key="area.id" :label="area.name" :value="area.id" />
          </el-select>
        </div>
        <div class="pf-actions">
          <el-button type="primary" :loading="loading" @click="loadPackages">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </div>
      </section>

      <div v-if="loadError" class="sr-card">
        <div class="sr-empty">
          <el-empty :description="loadError" />
          <el-button type="primary" @click="loadPackages">重新加载</el-button>
        </div>
      </div>

      <div v-else-if="loading" class="packages-grid">
        <div v-for="n in 6" :key="n" class="sr-card package-card is-skeleton" aria-hidden="true">
          <div class="package-img skeleton-block"></div>
          <div class="package-body">
            <div class="skeleton-line w60"></div>
            <div class="skeleton-line w90"></div>
            <div class="skeleton-line w40"></div>
          </div>
        </div>
      </div>

      <div v-else-if="packages.length" class="packages-grid">
        <article v-for="pkg in packages" :key="pkg.id" class="sr-card package-card">
          <div class="package-img">
            <img v-if="pkg.packageImgPath && !failedImages[pkg.id]" :src="pkg.packageImgPath" alt="" @error="failedImages[pkg.id] = true" />
            <span v-else class="package-img-fallback">{{ pkg.packageTypeStr || '套餐' }}</span>
            <span v-if="pkg.specialTag" class="package-tag sr-chip sr-chip-amber">{{ pkg.specialTag }}</span>
          </div>

          <div class="package-body">
            <div class="package-name-row">
              <h2 class="package-name">{{ pkg.packageName }}</h2>
              <span v-if="pkg.packageTypeStr" class="sr-chip sr-chip-muted">{{ pkg.packageTypeStr }}</span>
            </div>
            <p class="package-desc">{{ pkg.packageDesc || '暂无套餐说明' }}</p>

            <div class="package-foot">
              <div class="package-price">
                <span class="sr-price">¥{{ formatMoney(pkg.packageAccountPriceYuan) }}</span>
                <span
                  v-if="Number(pkg.originalPriceYuan) > Number(pkg.packageAccountPriceYuan)"
                  class="sr-price-original"
                >¥{{ formatMoney(pkg.originalPriceYuan) }}</span>
              </div>
              <el-button type="primary" plain @click="openDetail(pkg.id)">查看详情</el-button>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="sr-card">
        <div class="sr-empty">
          <el-empty description="没有符合条件的套餐" />
        </div>
      </div>
    </div>

    <!-- 套餐详情 -->
    <el-dialog v-model="detailVisible" class="sr-dialog" title="套餐详情" width="620px" destroy-on-close>
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="detail">
          <div class="detail-head">
            <div class="detail-title-main">
              <h3 class="detail-name">{{ detail.packageName }}</h3>
              <div class="detail-chips">
                <span v-if="detail.packageTypeStr" class="sr-chip sr-chip-green">{{ detail.packageTypeStr }}</span>
                <span v-if="detail.packageTypeDesc" class="sr-chip sr-chip-muted">{{ detail.packageTypeDesc }}</span>
              </div>
            </div>
            <div class="detail-price">
              <span class="sr-price">¥{{ formatMoney(detail.packageAccountPriceYuan) }}</span>
              <span
                v-if="Number(detail.originalPriceYuan) > Number(detail.packageAccountPriceYuan)"
                class="sr-price-original"
              >¥{{ formatMoney(detail.originalPriceYuan) }}</span>
            </div>
          </div>

          <p v-if="detail.packageDesc" class="detail-desc">{{ detail.packageDesc }}</p>

          <div class="detail-kv">
            <div class="sr-kv"><span class="sr-kv-key">可用时长</span><span class="sr-kv-value">{{ detail.consumeUseNumDesc || '—' }}</span></div>
            <div class="sr-kv"><span class="sr-kv-key">有效期</span><span class="sr-kv-value">{{ detail.validTimeDesc || '—' }}</span></div>
            <div class="sr-kv"><span class="sr-kv-key">可用时段</span><span class="sr-kv-value">{{ detail.settleHourDesc || '—' }}</span></div>
            <div class="sr-kv"><span class="sr-kv-key">可用门店 / 区域</span><span class="sr-kv-value">{{ detail.useAreasDesc || '—' }}</span></div>
            <div class="sr-kv"><span class="sr-kv-key">限购</span><span class="sr-kv-value">{{ detail.buyPerNumDesc || '—' }}</span></div>
            <div class="sr-kv"><span class="sr-kv-key">不可用日期</span><span class="sr-kv-value">{{ detail.failureDateDesc || '—' }}</span></div>
            <div class="sr-kv"><span class="sr-kv-key">不可用星期</span><span class="sr-kv-value">{{ detail.failureWeekdayDesc || '—' }}</span></div>
            <div class="sr-kv"><span class="sr-kv-key">不可用节假日</span><span class="sr-kv-value">{{ detail.failureHolidayDesc || '—' }}</span></div>
          </div>

          <div v-if="detail.venueList?.length" class="detail-venues">
            <span class="detail-venues-label">适用门店</span>
            <div class="detail-venues-list">
              <span v-for="venue in detail.venueList.slice(0, 12)" :key="venue.id" class="sr-chip sr-chip-muted">{{ venue.venueName }}</span>
              <span v-if="detail.venueList.length > 12" class="detail-more">等 {{ detail.venueList.length }} 家</span>
            </div>
          </div>

          <div class="sr-dialog-foot detail-actions">
            <el-button @click="detailVisible = false">关闭</el-button>
            <el-button type="primary" @click="openBuy">购买套餐</el-button>
          </div>
        </template>
        <div v-else-if="!detailLoading" class="sr-empty">
          <el-empty description="套餐详情加载失败" />
        </div>
      </div>
    </el-dialog>

    <!-- 确认购买 -->
    <el-dialog v-model="buyVisible" class="sr-dialog" title="确认购买" width="460px" :close-on-click-modal="false">
      <div class="buy-body">
        <div class="sr-kv"><span class="sr-kv-key">套餐</span><span class="sr-kv-value">{{ detail?.packageName || '—' }}</span></div>
        <div class="sr-kv"><span class="sr-kv-key">应付金额</span><span class="sr-kv-value sr-price">¥{{ formatMoney(detail?.packageAccountPriceYuan) }}</span></div>

        <div class="buy-field">
          <label class="sr-field-label" for="buyVenue">使用门店</label>
          <el-select id="buyVenue" v-model="buyForm.venueId" placeholder="请选择门店" clearable filterable @change="onBuyVenueChange">
            <el-option v-for="venue in options.venueList" :key="venue.id" :label="venue.name" :value="venue.id" />
          </el-select>
        </div>

        <div class="buy-field">
          <label class="sr-field-label" for="buyArea">座位区域</label>
          <el-select id="buyArea" v-model="buyForm.seatAreaId" placeholder="不限定区域" clearable :disabled="!buyForm.venueId">
            <el-option v-for="area in buyAreas" :key="area.id" :label="area.name" :value="area.id" />
          </el-select>
        </div>

        <div class="sr-dialog-note is-warning">
          下单后会生成待支付订单；微信支付只能在小程序内完成，本页面仅可查看支付参数。
        </div>

        <div class="sr-dialog-foot buy-actions">
          <el-button :disabled="buying" @click="buyVisible = false">取消</el-button>
          <el-button type="primary" :loading="buying" @click="submitBuy">确认下单</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 下单结果 -->
    <el-dialog v-model="orderVisible" class="sr-dialog" title="订单已创建" width="460px">
      <div v-if="order" class="order-body">
        <div class="order-mark" aria-hidden="true">
          <el-icon><Tickets /></el-icon>
        </div>
        <p class="order-lead">订单已创建，请在小程序内完成微信支付。</p>
        <div class="order-kv">
          <div class="sr-kv"><span class="sr-kv-key">套餐</span><span class="sr-kv-value">{{ order.packageName || '—' }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">订单号</span><span class="sr-kv-value sr-mono">{{ order.orderNumber || '—' }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">应付金额</span><span class="sr-kv-value sr-price">¥{{ formatMoney(order.payPrice) }}</span></div>
        </div>

        <div v-if="payParams" class="pay-params">
          <span class="sr-field-label">支付参数（复制到小程序调试工具）</span>
          <pre class="pay-params-code">{{ payParamsText }}</pre>
        </div>

        <div class="sr-dialog-foot order-actions">
          <el-button :loading="payLoading" @click="loadPayParams">获取支付参数</el-button>
          <el-button type="primary" @click="copyPayParams">复制参数</el-button>
        </div>
        <div class="sr-dialog-note">支付完成后可在「概览 · 我的订单」中查看状态。</div>
      </div>
    </el-dialog>
  </StudyShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import StudyShell from './components/study-shell.vue'
import { studyPackageApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import { filterReserveVenues, formatMoney } from '@/utils/study/format'
import { useStudyRefresh } from '@/composables/study/useStudyRefresh'

const store = useStudyStore()

const loading = ref(false)
const loadError = ref('')
const packages = ref([])
const failedImages = ref({})
const options = ref({
  venueList: [],
  packageTypeList: [],
  packageLabelList: []
})
const seatAreas = ref([])

const query = reactive({
  venueId: null,
  packageType: null,
  packageLabelIds: [],
  seatAreaId: null
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)

const buyVisible = ref(false)
const buying = ref(false)
const buyForm = reactive({ venueId: null, seatAreaId: null })
const buyAreas = ref([])

const orderVisible = ref(false)
const order = ref(null)
const payParams = ref(null)
const payLoading = ref(false)

const payParamsText = computed(() => (payParams.value ? JSON.stringify(payParams.value, null, 2) : ''))

async function loadOptions() {
  try {
    const res = await studyPackageApi.v2OptList()
    const data = res?.data || {}
    options.value = {
      // opt-list 会带出「押金专用」等非自习室门店，筛选下拉里不展示
      venueList: filterReserveVenues(data.venueList),
      packageTypeList: data.packageTypeList || [],
      packageLabelList: data.packageLabelList || []
    }
  } catch (e) {
    store.handleApiError(e)
  }
}

async function loadSeatAreas() {
  if (!query.venueId) {
    seatAreas.value = []
    query.seatAreaId = null
    return
  }
  try {
    const res = await studyPackageApi.v2LabelList(query.venueId)
    seatAreas.value = res?.data?.seatAreaList || []
  } catch (e) {
    seatAreas.value = []
    store.handleApiError(e)
  }
}

async function loadPackages() {
  if (!store.isTokenValid) {
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const res = await studyPackageApi.v2List({
      venueId: query.venueId || undefined,
      packageType: query.packageType || undefined,
      packageLabelIds: query.packageLabelIds.length ? query.packageLabelIds : undefined,
      seatAreaId: query.seatAreaId || undefined
    })
    packages.value = res?.data?.packageList || []
  } catch (e) {
    loadError.value = e?.msg || '套餐列表加载失败，请稍后重试。'
    store.handleApiError(e)
  } finally {
    loading.value = false
  }
}

function onVenueChange() {
  query.seatAreaId = null
  loadSeatAreas()
}

function resetQuery() {
  query.venueId = null
  query.packageType = null
  query.packageLabelIds = []
  query.seatAreaId = null
  seatAreas.value = []
  loadPackages()
}

async function openDetail(packageId) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await studyPackageApi.v2Detail(packageId)
    detail.value = res?.data || null
  } catch (e) {
    store.handleApiError(e)
  } finally {
    detailLoading.value = false
  }
}

async function loadBuyAreas() {
  if (!buyForm.venueId) {
    buyAreas.value = []
    buyForm.seatAreaId = null
    return
  }
  try {
    const res = await studyPackageApi.v2LabelList(buyForm.venueId)
    buyAreas.value = res?.data?.seatAreaList || []
  } catch (e) {
    buyAreas.value = []
  }
}

function onBuyVenueChange() {
  buyForm.seatAreaId = null
  loadBuyAreas()
}

function openBuy() {
  if (!detail.value) {
    return
  }
  buyForm.venueId = query.venueId || null
  buyForm.seatAreaId = query.seatAreaId || null
  loadBuyAreas()
  buyVisible.value = true
}

async function submitBuy() {
  if (buying.value || !detail.value) {
    return
  }
  if (!buyForm.venueId) {
    ElMessage.warning('请选择使用门店')
    return
  }
  buying.value = true
  try {
    const res = await studyPackageApi.v2Confirm({
      packageId: detail.value.id,
      venueId: buyForm.venueId,
      // 后端确认下单接口要求购买数量，页面暂不支持多份，固定 1 份
      purchaseNum: 1,
      seatAreaId: buyForm.seatAreaId || undefined,
      packageType: detail.value.packageType || undefined
    })
    order.value = res?.data || null
    payParams.value = null
    buyVisible.value = false
    orderVisible.value = true
    ElMessage.success('订单已创建')
  } catch (e) {
    store.handleApiError(e)
  } finally {
    buying.value = false
  }
}

async function loadPayParams() {
  if (!order.value || payLoading.value) {
    return
  }
  // 后端支付下单接口只接收 userOrderId，不能传 orderId / id
  const userOrderId = order.value.userOrderId
  if (!userOrderId) {
    ElMessage.warning('订单号缺失，无法获取支付参数')
    return
  }
  payLoading.value = true
  try {
    const res = await studyPackageApi.payOrder({ userOrderId })
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

useStudyRefresh(() => loadPackages())

onMounted(async () => {
  store.ensureStatus()
  await store.fetchConfig()
  await loadOptions()
})
</script>

<style lang="scss" scoped>
.packages-page {
  min-width: 0;
}

.refresh-icon {
  margin-right: 4px;
}

.packages-filter {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 14px 18px;
  margin-bottom: 18px;
  padding: 16px 18px;
}

.pf-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.pf-label {
  color: var(--sr-muted);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.07em;
}

.pf-select {
  width: 180px;
}

.pf-venue {
  width: 220px;
}

.pf-labels {
  width: 230px;
}

.pf-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 1px;
}

.packages-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.package-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.16s, box-shadow 0.16s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 30px rgba(27, 42, 36, 0.09);
  }
}

.package-img {
  position: relative;
  display: grid;
  place-items: center;
  height: 138px;
  background: linear-gradient(135deg, var(--sr-green-soft), var(--sr-paper-2));
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.package-img-fallback {
  color: var(--sr-green-ink);
  font-family: var(--sr-font-display);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.package-tag {
  position: absolute;
  top: 10px;
  left: 10px;
  box-shadow: var(--sr-shadow-sm);
}

.package-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 14px 16px 16px;
}

.package-name-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.package-name {
  flex: 1;
  margin: 0;
  font-family: var(--sr-font-display);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.package-desc {
  flex: 1;
  margin: 7px 0 0;
  color: var(--sr-muted);
  font-size: 11.5px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.package-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--sr-line);
}

.package-price {
  display: flex;
  flex: 1 1 auto;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 7px;
  min-width: 0;
}

.package-foot :deep(.el-button) {
  flex: none;
  min-width: 86px;
}

.is-skeleton {
  pointer-events: none;
}

.skeleton-block,
.skeleton-line {
  background: linear-gradient(90deg, var(--sr-paper-2), var(--sr-line), var(--sr-paper-2));
  background-size: 200% 100%;
  animation: skeleton-shine 1.4s ease infinite;
}

.skeleton-line {
  height: 10px;
  margin-top: 10px;
  border-radius: 4px;
}

.skeleton-line.w60 {
  width: 60%;
}

.skeleton-line.w90 {
  width: 90%;
}

.skeleton-line.w40 {
  width: 40%;
}

@keyframes skeleton-shine {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.detail-body {
  min-height: 120px;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.detail-title-main {
  min-width: 0;
}

.detail-name {
  margin: 0;
  font-family: var(--sr-font-display);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
}

.detail-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 7px;
}

.detail-price {
  display: flex;
  align-items: baseline;
  gap: 7px;
  flex: none;
}

.detail-desc {
  margin: 12px 0 0;
  color: var(--sr-muted);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.detail-kv {
  margin-top: 12px;
  padding: 2px 12px;
  border: 1px solid var(--sr-line);
  border-radius: 10px;
  background: var(--sr-card-2);
}

.detail-venues {
  margin-top: 14px;
}

.detail-venues-label {
  display: block;
  margin-bottom: 6px;
  color: var(--sr-muted);
  font-size: 10.5px;
  letter-spacing: 0.07em;
}

.detail-venues-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-more {
  color: var(--sr-muted);
  font-size: 11px;
  align-self: center;
}

.detail-actions {
  margin-top: 20px;
}

.buy-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.buy-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.buy-field :deep(.el-select) {
  width: 100%;
}

.buy-actions {
  margin-top: 18px;
}

.order-body {
  min-width: 0;
}

.order-mark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #e4ede6;
  color: #2f6b55;
  font-size: 22px;
}

.order-lead {
  margin: 12px 0 0;
  color: #5f6c64;
  font-size: 12px;
  line-height: 1.6;
}

.order-kv {
  margin-top: 12px;
  padding: 2px 12px;
  border: 1px solid #e4dcc9;
  border-radius: 10px;
  background: #fbf8ef;
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

.order-actions {
  margin-top: 18px;
}

@media (max-width: 1120px) {
  .packages-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .packages-filter {
    padding: 14px;
    gap: 12px;
  }

  .pf-field {
    flex: 1 1 100%;
  }

  .pf-select,
  .pf-venue,
  .pf-labels {
    width: 100%;
  }

  .pf-actions {
    width: 100%;
  }

  .pf-actions :deep(.el-button) {
    flex: 1;
  }

  .packages-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .package-card,
  .skeleton-block,
  .skeleton-line {
    animation: none;
    transition: none;

    &:hover {
      transform: none;
    }
  }
}
</style>
