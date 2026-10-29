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
          <div v-loading="packageLoading" class="tab-body">
            <div v-if="userPackages.length" class="package-cards">
              <article v-for="pkg in userPackages" :key="pkg.id" class="package-item">
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
                  <el-button size="small" type="danger" plain @click="cancelLeave(pkg)">取消请假</el-button>
                </div>
                <div v-else-if="Number(pkg.canLeaveBtn) === 1" class="package-item-actions">
                  <el-button size="small" @click="openLeave(pkg)">请假</el-button>
                </div>
              </article>
            </div>
            <div v-else class="sr-empty">
              <el-empty description="还没有已购套餐" :image-size="52" />
            </div>
          </div>
        </el-tab-pane>

        <!-- 我的订单 -->
        <el-tab-pane name="orders">
          <template #label>
            <span class="tab-label">我的订单 <span class="sr-count">{{ orders.length }}</span></span>
          </template>
          <div v-loading="orderLoading" class="tab-body">
            <el-table :data="orders" empty-text="暂无订单">
              <el-table-column prop="packageName" label="套餐" min-width="180" show-overflow-tooltip />
              <el-table-column label="金额" width="110" align="right">
                <template #default="{ row }">
                  <span class="sr-mono">¥{{ formatMoney(row.payRealMoney ?? row.payPrice) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="payStateStr" label="状态" width="100" align="center">
                <template #default="{ row }">
                  <span class="sr-chip" :class="Number(row.payState) === 1 ? 'sr-chip-green' : 'sr-chip-amber'">
                    <span class="sr-dot"></span>{{ row.payStateStr || '—' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="payTypeStr" label="支付方式" width="110" align="center" />
              <el-table-column prop="orderNumber" label="订单号" min-width="180" show-overflow-tooltip />
              <el-table-column prop="buyTimeStr" label="下单时间" width="165" />
            </el-table>
          </div>
        </el-tab-pane>

        <!-- 报修 -->
        <el-tab-pane name="repairs">
          <template #label>
            <span class="tab-label">报修 <span class="sr-count">{{ repairs.length }}</span></span>
          </template>
          <div v-loading="repairLoading" class="tab-body">
            <div class="repair-toolbar">
              <p class="repair-hint">遇到座位、设备或环境问题，可以在这里提交报修。</p>
              <el-button type="primary" @click="openRepair">提交报修</el-button>
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
                <el-button text @click="openRepairDetail(item.id)">查看详情</el-button>
              </article>
            </div>
            <div v-else class="sr-empty">
              <el-empty description="暂无报修记录" :image-size="52" />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 请假 -->
    <el-dialog v-model="leaveVisible" class="sr-dialog" title="套餐请假" width="480px" :close-on-click-modal="false">
      <div v-loading="leaveLoading" class="form-body">
        <div v-if="leaveInfo" class="leave-info">
          <div class="sr-kv">
            <span class="sr-kv-key">剩余可请假</span>
            <span class="sr-kv-value">{{ leaveInfo.leftLeaveDays ?? '—' }} 天</span>
          </div>
          <div class="sr-kv">
            <span class="sr-kv-key">请假状态</span>
            <span class="sr-kv-value">{{ Number(leaveInfo.canLeaveState) === 1 ? '可请假' : '不可请假' }}</span>
          </div>
        </div>
        <div v-if="leaveInfo && Number(leaveInfo.canLeaveState) !== 1 && leaveInfo.canNotLeaveMsg" class="sr-dialog-note is-warning">
          {{ leaveInfo.canNotLeaveMsg }}
        </div>

        <div v-if="leaveInfo?.leaveList?.length" class="leave-records">
          <span class="sr-field-label">已请假记录</span>
          <div v-for="record in leaveInfo.leaveList" :key="record.id" class="leave-record">
            <span class="sr-mono">{{ record.startDate }} – {{ record.endDate }}</span>
            <span class="sr-chip sr-chip-muted">{{ record.leaveStateDesc || '已请假' }}</span>
          </div>
        </div>

        <template v-if="leaveInfo && Number(leaveInfo.canLeaveState) === 1">
          <div class="form-field">
            <label class="sr-field-label">请假日期</label>
            <el-date-picker
              v-model="leaveForm.range"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="–"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 100%"
            />
          </div>
          <div class="form-field">
            <label class="sr-field-label" for="leaveReason">请假原因</label>
            <el-input id="leaveReason" v-model="leaveForm.reason" type="textarea" :rows="2" maxlength="120" show-word-limit placeholder="请填写请假原因" />
          </div>
        </template>

        <div class="sr-dialog-foot form-actions">
          <el-button :disabled="submittingLeave" @click="leaveVisible = false">关闭</el-button>
          <el-button
            v-if="leaveInfo && Number(leaveInfo.canLeaveState) === 1"
            type="primary"
            :loading="submittingLeave"
            @click="submitLeave"
          >确认请假</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 提交报修 -->
    <el-dialog v-model="repairVisible" class="sr-dialog" title="提交报修" width="480px" :close-on-click-modal="false">
      <div class="form-body">
        <div class="form-field">
          <label class="sr-field-label" for="repairVenue">门店</label>
          <el-select id="repairVenue" v-model="repairForm.venueId" placeholder="请选择门店" filterable style="width: 100%">
            <el-option v-for="venue in venueList" :key="venue.id" :label="venue.venueName" :value="venue.id" />
          </el-select>
        </div>
        <div class="form-field">
          <label class="sr-field-label" for="repairDesc">问题描述</label>
          <el-input id="repairDesc" v-model="repairForm.repairDesc" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="请描述遇到的问题" />
        </div>
        <div class="form-field">
          <label class="sr-field-label" for="repairImgs">图片地址（可选，每行一个）</label>
          <el-input id="repairImgs" v-model="repairForm.imageText" type="textarea" :rows="2" placeholder="当前不支持上传，可填写图片 URL" />
        </div>
        <div class="sr-dialog-note">提交后门店会收到报修工单，处理进度可在「报修」中查看。</div>
        <div class="sr-dialog-foot form-actions">
          <el-button :disabled="submittingRepair" @click="repairVisible = false">取消</el-button>
          <el-button type="primary" :loading="submittingRepair" @click="submitRepair">提交</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 报修详情 -->
    <el-dialog v-model="repairDetailVisible" class="sr-dialog" title="报修详情" width="480px">
      <div v-loading="repairDetailLoading" class="form-body">
        <template v-if="repairDetail">
          <div class="sr-kv"><span class="sr-kv-key">门店</span><span class="sr-kv-value">{{ repairDetail.venueName || '—' }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">状态</span><span class="sr-kv-value">{{ Number(repairDetail.handleState) === 1 ? '已处理' : '处理中' }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">提交时间</span><span class="sr-kv-value">{{ repairDetail.createTimeStr || '—' }}</span></div>
          <div class="sr-kv"><span class="sr-kv-key">处理时间</span><span class="sr-kv-value">{{ repairDetail.handleTimeStr || '—' }}</span></div>
          <p class="repair-detail-desc">{{ repairDetail.repairDesc || '—' }}</p>
          <p v-if="repairDetail.handleRemark" class="repair-detail-remark">处理备注：{{ repairDetail.handleRemark }}</p>
          <div v-if="repairDetail.repairImgList?.length" class="repair-imgs">
            <img v-for="(img, index) in repairDetail.repairImgList" :key="index" :src="img" alt="" />
          </div>
        </template>
        <div v-else-if="!repairDetailLoading" class="sr-empty">
          <el-empty description="报修详情加载失败" />
        </div>
      </div>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { studyLeaveApi, studyPackageApi, studyRepairApi, studyVenueApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import { formatMoney, formatTimestamp } from '@/utils/study/format'

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
const venueList = ref([])

const packageLoading = ref(false)
const orderLoading = ref(false)
const repairLoading = ref(false)

let loadSeq = 0

const busy = computed(() => packageLoading.value || orderLoading.value || repairLoading.value)

watch(busy, value => emit('update:busy', value))

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

async function loadPackages(seq) {
  packageLoading.value = true
  try {
    const res = await studyPackageApi.userPackageList()
    if (seq !== loadSeq) {
      return
    }
    userPackages.value = res?.data?.list || []
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (seq === loadSeq) {
      packageLoading.value = false
    }
  }
}

async function loadOrders(seq) {
  orderLoading.value = true
  try {
    const res = await studyPackageApi.userOrderList()
    if (seq !== loadSeq) {
      return
    }
    orders.value = res?.data?.list || []
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (seq === loadSeq) {
      orderLoading.value = false
    }
  }
}

async function loadRepairs(seq) {
  repairLoading.value = true
  try {
    const res = await studyRepairApi.list()
    if (seq !== loadSeq) {
      return
    }
    repairs.value = res?.data?.list || []
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (seq === loadSeq) {
      repairLoading.value = false
    }
  }
}

async function loadVenues() {
  try {
    const res = await studyVenueApi.reserveSelect()
    venueList.value = res?.data?.venueList || []
  } catch (e) {
    venueList.value = []
  }
}

async function loadAll() {
  if (!store.isTokenValid) {
    return
  }
  const seq = ++loadSeq
  await Promise.allSettled([loadPackages(seq), loadOrders(seq), loadRepairs(seq)])
}

/* ---------------- 请假 ---------------- */
const leaveVisible = ref(false)
const leaveLoading = ref(false)
const leaveInfo = ref(null)
const submittingLeave = ref(false)
const leaveForm = reactive({ range: [], reason: '' })

async function enterLeave(userPackageId) {
  leaveLoading.value = true
  try {
    const res = await studyLeaveApi.enter(userPackageId)
    leaveInfo.value = res?.data || null
  } catch (e) {
    leaveInfo.value = null
    store.handleApiError(e)
  } finally {
    leaveLoading.value = false
  }
}

async function openLeave(pkg) {
  leaveForm.range = []
  leaveForm.reason = ''
  leaveVisible.value = true
  await enterLeave(pkg.id)
}

/**
 * 上游请假接口要求日期格式为 yyyy-M-d（月、日不补零）
 */
function toLeaveDate(value) {
  const [year, month, day] = String(value).split('-').map(Number)
  return `${year}-${month}-${day}`
}

async function submitLeave() {
  if (submittingLeave.value || !leaveInfo.value?.userPackageId) {
    return
  }
  if (!leaveForm.range || leaveForm.range.length !== 2) {
    ElMessage.warning('请选择请假日期')
    return
  }
  const reason = leaveForm.reason.trim()
  if (!reason) {
    ElMessage.warning('请填写请假原因')
    return
  }
  submittingLeave.value = true
  try {
    await studyLeaveApi.confirm({
      userPackageId: leaveInfo.value.userPackageId,
      leaveStartTimeStr: toLeaveDate(leaveForm.range[0]),
      leaveEndTimeStr: toLeaveDate(leaveForm.range[1]),
      leaveReason: reason
    })
    ElMessage.success('请假成功')
    leaveForm.range = []
    leaveForm.reason = ''
    await loadPackages(loadSeq)
    await enterLeave(leaveInfo.value.userPackageId)
  } catch (e) {
    store.handleApiError(e)
  } finally {
    submittingLeave.value = false
  }
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
        await loadPackages(loadSeq)
      } catch (e) {
        store.handleApiError(e)
      }
    })
    .catch(() => {})
}

/* ---------------- 报修 ---------------- */
const repairVisible = ref(false)
const submittingRepair = ref(false)
const repairForm = reactive({ venueId: null, repairDesc: '', imageText: '' })

const repairDetailVisible = ref(false)
const repairDetailLoading = ref(false)
const repairDetail = ref(null)

function openRepair() {
  repairForm.venueId = null
  repairForm.repairDesc = ''
  repairForm.imageText = ''
  repairVisible.value = true
}

async function submitRepair() {
  if (submittingRepair.value) {
    return
  }
  if (!repairForm.venueId) {
    ElMessage.warning('请选择门店')
    return
  }
  if (!repairForm.repairDesc.trim()) {
    ElMessage.warning('请填写问题描述')
    return
  }
  const images = repairForm.imageText
    .split(/[\n,，]/)
    .map(item => item.trim())
    .filter(Boolean)

  submittingRepair.value = true
  try {
    await studyRepairApi.submit({
      venueId: repairForm.venueId,
      repairDesc: repairForm.repairDesc.trim(),
      repairImgList: images.length ? images : undefined
    })
    ElMessage.success('报修已提交')
    repairVisible.value = false
    await loadRepairs(loadSeq)
    activeTab.value = 'repairs'
  } catch (e) {
    store.handleApiError(e)
  } finally {
    submittingRepair.value = false
  }
}

async function openRepairDetail(id) {
  repairDetailVisible.value = true
  repairDetailLoading.value = true
  repairDetail.value = null
  try {
    const res = await studyRepairApi.detail(id)
    repairDetail.value = res?.data || null
  } catch (e) {
    store.handleApiError(e)
  } finally {
    repairDetailLoading.value = false
  }
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

.tab-body {
  min-height: 160px;
  padding-top: 6px;
}

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

.repair-detail-desc {
  margin: 12px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--sr-line);
  border-radius: 9px;
  background: var(--sr-card-2);
  color: var(--sr-ink-2);
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.repair-detail-remark {
  margin: 10px 0 0;
  color: var(--sr-muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.repair-imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;

  img {
    width: 84px;
    height: 84px;
    border-radius: 8px;
    object-fit: cover;
    border: 1px solid var(--sr-line);
  }
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.form-field :deep(.el-select) {
  width: 100%;
}

.form-actions {
  margin-top: 18px;
}

.leave-info {
  margin-top: 4px;
  padding: 2px 12px;
  border: 1px solid var(--sr-line);
  border-radius: 9px;
  background: var(--sr-card-2);
}

.leave-records {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
}

.leave-record {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid var(--sr-line);
  border-radius: 8px;
  background: var(--sr-card-2);
  font-size: 11.5px;
}

@media (max-width: 900px) {
  .package-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .account-tabs-body {
    padding: 0 14px;
  }

  .package-item-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .repair-title-row {
    align-items: flex-start;
  }
}
</style>
