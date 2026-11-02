<template>
  <StudyShell>
    <div class="sign-page">
      <header class="sr-page-head">
        <div>
          <p class="sr-eyebrow">自习室 · 在座</p>
          <h1 class="sr-title">在座与签到</h1>
          <p class="sr-sub">查看当前座位，完成签到、换座、签退与门禁操作。</p>
        </div>
        <div class="sr-actions">
          <span class="sr-updated">
            <span class="sign-live-dot" aria-hidden="true"></span>
            更新于 {{ updatedAt }}
          </span>
          <el-button :loading="indexLoading" @click="loadIndex">
            <el-icon class="refresh-icon"><Refresh /></el-icon>
            刷新状态
          </el-button>
        </div>
      </header>

      <div v-if="indexError" class="sr-card">
        <div class="sr-empty">
          <el-empty :description="indexError" />
          <el-button type="primary" @click="loadIndex">重新加载</el-button>
        </div>
      </div>

      <template v-else>
        <!-- 当前在座 -->
        <section class="sr-card seated-card" v-loading="indexLoading">
          <div class="sr-card-head">
            <h2 class="sr-card-title">
              当前在座
              <span class="sr-count">{{ seatedList.length }}</span>
            </h2>
            <span v-if="signData?.configStudyIndexText" class="sr-card-sub">{{ signData.configStudyIndexText }}</span>
            <el-button v-if="canControlLight" class="light-entry" :loading="lightBusy" @click="openLightControl">
              <el-icon><Sunny /></el-icon>
              {{ lightButtonText }}
            </el-button>
          </div>

          <div v-if="seatedList.length" class="seated-list">
            <article v-for="(item, index) in seatedList" :key="resolveUserSignId(item) ?? `seat-${index}`" class="seated-item">
              <div class="seated-main">
                <div class="seated-title-row">
                  <strong class="seated-seat sr-mono">{{ item.seatInfo?.seatNumber || '—' }}</strong>
                  <span class="seated-area">{{ item.seatInfo?.areaName || item.areaDesc || '' }}</span>
                  <span v-if="Number(item.signSerialNo) > 0" class="sr-chip sr-chip-green">今日第 {{ item.signSerialNo }} 位</span>
                </div>
                <p class="seated-meta">
                  <span v-if="signInClockOf(item)">签到 {{ signInClockOf(item) }}</span>
                  <span v-if="item.signOutExpectTimeStr"> · 预计 {{ clockOf(item.signOutExpectTimeStr) }} 签退</span>
                  <span v-if="item.packageName"> · {{ item.packageName }}</span>
                </p>
                <p class="seated-meta">
                  <span v-if="item.restTimeStr">套餐剩余 {{ item.restTimeStr }}</span>
                  <span v-if="item.settleHourStr"> · 可用时段 {{ item.settleHourStr }}</span>
                </p>
              </div>

              <div class="seated-actions">
                <SeatActions
                  :sign-data="signData"
                  :item="item"
                  :user-sign-id="resolveUserSignId(item)"
                  :fallback-venue-id="signVenueId"
                  :venue-name="selectedVenueName"
                  :fallback-coords="actionCoords"
                  @refresh="loadIndex"
                />
              </div>
            </article>
          </div>

          <div v-else class="sr-empty">
            <el-empty description="当前未在座，可在下方签到入座" :image-size="52" />
          </div>
        </section>

        <!-- 门禁 -->
        <GuardSection :venue-id="guardVenueId" :venue-name="guardVenueName" />

        <!-- 签到入座 -->
        <SignInForm
          v-if="!seatedList.length"
          v-model:venue-id="signVenueId"
          :venue-options="venueOptions"
          :venue-name="selectedVenueName"
          :packages="userPackages"
          :preset-package-id="presetSignInPackageId"
          :qr-need-sign-in="qrNeedSignIn"
          :description="signData?.descNoSignIn"
          :coords="actionCoords"
          @signed="loadIndex"
        />

        <!-- 其他信息 -->
        <div class="sr-grid-2 sign-secondary">
          <section class="sr-card">
            <div class="sr-card-head">
              <h2 class="sr-card-title">学习统计</h2>
            </div>
            <div class="sign-stats">
              <div class="sign-stat">
                <span class="sign-stat-label">累计签到</span>
                <strong class="sign-stat-value sr-mono">{{ signTotalNum }}<em>次</em></strong>
              </div>
              <div class="sign-stat">
                <span class="sign-stat-label">累计学习</span>
                <strong class="sign-stat-value is-text sr-mono">{{ studyTotalText }}</strong>
              </div>
              <div class="sign-stat">
                <span class="sign-stat-label">进行中预约</span>
                <strong class="sign-stat-value sr-mono">{{ signData?.userReserveInfoNum ?? 0 }}<em>个</em></strong>
              </div>
              <div class="sign-stat">
                <span class="sign-stat-label" title="自开通小程序账号起计算">加入天数</span>
                <strong class="sign-stat-value sr-mono">{{ signData?.studyDays ?? 0 }}<em>天</em></strong>
              </div>
            </div>
            <div v-if="signData?.nextReserveInfo" class="next-reserve">
              <span class="sr-chip sr-chip-amber">下一笔预约</span>
              <span>{{ signData.nextReserveInfo.reserveDesc || `${signData.nextReserveInfo.reserveDateStr} ${signData.nextReserveInfo.reserveTimeStr}` }}</span>
            </div>
          </section>

          <section class="sr-card">
            <div class="sr-card-head">
              <h2 class="sr-card-title">附近门店</h2>
            </div>
            <div v-if="venueOptions.length" class="nearby-list">
              <div v-for="venue in venueOptions.slice(0, 5)" :key="venue.id" class="nearby-item">
                <div class="nearby-main">
                  <strong>{{ venue.venueName }}</strong>
                  <span class="nearby-meta">{{ venue.venueAddress || '地址待同步' }}</span>
                </div>
                <span v-if="venue.distanceStr" class="sr-chip sr-chip-muted">{{ venue.distanceStr }}</span>
              </div>
            </div>
            <div v-else class="sr-empty">
              <el-empty description="暂无附近门店" :image-size="46" />
            </div>
          </section>
        </div>
      </template>

      <!-- 座位灯控 -->
      <el-dialog
        v-model="lightVisible"
        class="sr-dialog"
        title="座位灯控"
        width="380px"
        append-to-body
      >
        <div class="light-body">
          <p class="light-seat">
            当前座位
            <strong class="sr-mono">{{ seatCurrent?.seatNumber || '—' }}</strong>
          </p>
          <p class="light-tip">指令发出后约 2 秒生效，请以现场灯况为准。</p>
          <div class="light-actions">
            <el-button type="primary" :loading="lightAction === 'turnOn'" :disabled="lightBusy" @click="turnLight('turnOn')">
              <el-icon><Sunny /></el-icon>
              开灯
            </el-button>
            <el-button :loading="lightAction === 'turnOff'" :disabled="lightBusy" @click="turnLight('turnOff')">
              <el-icon><Moon /></el-icon>
              关灯
            </el-button>
          </div>
        </div>
      </el-dialog>
    </div>
  </StudyShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import StudyShell from './components/study-shell.vue'
import SeatActions from './components/seat-actions.vue'
import GuardSection from './components/sign/guard-section.vue'
import SignInForm from './components/sign/sign-in-form.vue'
import { studyPackageApi } from '@/api/study/package'
import { studyReserveApi } from '@/api/study/reserve'
import { studySignApi } from '@/api/study/sign'
import { studyUserApi } from '@/api/study/user'
import { studyVenueApi } from '@/api/study/venue'
import useStudyStore from '@/store/modules/study'
import { clockOf, currentClockText, parseApiDate } from '@/utils/study/time'
import { filterReserveVenues, isHiddenVenue } from '@/utils/study/venue'
import { isEndedReserve } from '@/utils/study/reserve'
import { getCurrentLocationCoords } from '@/utils/study/location'
import { useStudyRefresh } from '@/composables/study/useStudyRefresh'

const store = useStudyStore()

const signData = ref(null)
const userOverview = ref(null)
const indexLoading = ref(false)
const indexError = ref('')
const updatedAt = ref('--:--')

const venueOptions = ref([])
const userPackages = ref([])
const signVenueId = ref(null)
const venueCoords = ref(null)

const seatedList = computed(() => (Array.isArray(signData.value?.userSignInfoList) ? signData.value.userSignInfoList : []))

/* ---------------- 座位灯控 ---------------- */
const lightVisible = ref(false)
const lightAction = ref('')
const lightBusy = computed(() => lightAction.value !== '')
const seatCurrent = computed(() => signData.value?.seatCurrent || null)
const lightButtonText = computed(() => signData.value?.buttonTextOfLight || '灯控开关')

/**
 * 沿用小程序的条件：座位存在且门店开启了灯控。
 * lightBindStatus 显式为 0 表示该座位未绑定灯控；字段缺失时按小程序语义不拦截。
 */
const canControlLight = computed(() => {
  const seat = seatCurrent.value
  if (!seat?.id) {
    return false
  }
  const online = signData.value?.lightOnline
  if (!(online === true || String(online) === 'true')) {
    return false
  }
  const bind = seat.lightBindStatus
  return bind === null || bind === undefined || Number(bind) !== 0
})

function openLightControl() {
  if (!canControlLight.value) {
    ElMessage.warning('当前座位暂不支持灯控')
    return
  }
  lightVisible.value = true
}

async function turnLight(turnFlag) {
  if (!seatCurrent.value?.id || lightBusy.value) {
    return
  }
  lightAction.value = turnFlag
  try {
    await studySignApi.espLightTurn({ seatId: seatCurrent.value.id, turnFlag })
    ElMessage.success(turnFlag === 'turnOn' ? '已发送开灯指令' : '已发送关灯指令')
    lightVisible.value = false
  } catch (e) {
    store.handleApiError(e)
  } finally {
    lightAction.value = ''
  }
}

/**
 * 门禁跟随当前在座门店；未在座时跟随签到表单里选中的门店。
 * 小程序里用的是 venueNearest.id，这里优先用已签到门店，避免定位漂移。
 */
const guardVenueId = computed(() => {
  const seated = seatedList.value[0]
  // 后端在座记录可能只返回 venue 对象，兼容 venueId 与 venue.id 两种结构
  const seatedVenueId = seated?.venueId ?? seated?.venue?.id ?? signData.value?.seatCurrent?.venueId
  if (seatedVenueId !== null && seatedVenueId !== undefined && seatedVenueId !== '') {
    return seatedVenueId
  }
  return signVenueId.value ?? signData.value?.venueNearest?.id ?? null
})

const guardVenueName = computed(() => {
  const venue = venueOptions.value.find(item => Number(item.id) === Number(guardVenueId.value))
  return venue?.venueName || signData.value?.venueNearest?.venueName || ''
})

/**
 * 在座记录的签到 ID。
 * 后端在座列表未透传 userSignId 时 id 为空，此时若只有一条在座记录，
 * 回退到签到首页的主签到 ID，否则签退/换座无法定位记录。
 */
function resolveUserSignId(item) {
  const direct = item?.id ?? item?.userSignId
  if (direct !== null && direct !== undefined && direct !== '') {
    return direct
  }
  if (seatedList.value.length === 1) {
    return signData.value?.userSignId ?? signData.value?.userSign?.id ?? null
  }
  return null
}

function signInClockOf(item) {
  return clockOf(item?.signInTimeStr || item?.seatInfo?.signInTimeStr)
}

const signTotalNum = computed(() => {
  const value = Number(userOverview.value?.signTotalNum)
  return Number.isFinite(value) ? value : 0
})

const studyTotalText = computed(() => userOverview.value?.studyTotalTimeStr || '—')

const qrNeedSignIn = computed(() => String(signData.value?.qrCodeNeedSignIn || '') === 'true')

/**
 * 签到扣费套餐 ID。
 * 小程序取签到首页 signInUserPackage.signInUserPackageId，老字段 id 作为兜底。
 */
const presetSignInPackageId = computed(() => {
  const preset = signData.value?.signInUserPackage
  return preset?.signInUserPackageId ?? preset?.id ?? null
})

const selectedVenueName = computed(() => {
  const venue = venueOptions.value.find(item => Number(item.id) === Number(signVenueId.value))
  if (venue) {
    return venue.venueName
  }
  const nearest = signData.value?.venueNearest
  return nearest && !isHiddenVenue(nearest) ? nearest.venueName : ''
})

const selectedVenue = computed(() => venueOptions.value.find(item => Number(item.id) === Number(signVenueId.value)))

function venueLocation() {
  const nearestList = Array.isArray(signData.value?.venueNearestList) ? signData.value.venueNearestList : []
  const matched = nearestList.find(item => Number(item.id) === Number(signVenueId.value))
  const fallback = venueCoords.value || matched || selectedVenue.value || signData.value?.venueNearest
  const lng = Number(fallback?.venueLng)
  const lat = Number(fallback?.venueLat)
  return {
    lng: Number.isFinite(lng) ? lng : 0,
    lat: Number.isFinite(lat) ? lat : 0
  }
}

/** 换座 / 签退弹窗使用的门店坐标兜底，跟随当前选中门店变化 */
const actionCoords = computed(() => venueLocation())

async function loadVenueCoords() {
  if (!signVenueId.value) {
    venueCoords.value = null
    return
  }
  try {
    const res = await studyVenueApi.reserveDetail(signVenueId.value)
    venueCoords.value = res?.data || null
  } catch (e) {
    venueCoords.value = null
  }
}

/* ---------------- 预约签到 ---------------- */
const pendingReserve = ref(null)
let pendingReserveChecked = false

/**
 * 今天的「待签到」预约。
 * 上游在签到选座接口里会直接用预约座位完成签到，所以签到门店与套餐都必须跟随这笔预约。
 */
async function resolvePendingReserve() {
  if (pendingReserveChecked) {
    return pendingReserve.value
  }
  pendingReserveChecked = true
  try {
    const res = await studyReserveApi.userList()
    const list = Array.isArray(res?.data?.list) ? res.data.list : []
    pendingReserve.value =
      list.find(
        item =>
          String(item?.reserveStatusDesc || '').trim() === '待签到' &&
          parseApiDate(item?.reserveDateStr)?.isToday &&
          !isEndedReserve(item)
      ) || null
  } catch (e) {
    pendingReserve.value = null
  }
  return pendingReserve.value
}

/**
 * 预约门店可能不在附近门店列表里，补一条最小门店信息，保证下拉框能显示名称。
 */
function ensureVenueOption(venueId, venueName) {
  if (venueId === null || venueId === undefined || venueId === '') {
    return
  }
  if (venueOptions.value.some(item => Number(item.id) === Number(venueId))) {
    return
  }
  venueOptions.value = [...venueOptions.value, { id: venueId, venueName: venueName || `门店 ${venueId}` }]
}

async function loadVenues() {
  const { lng, lat } = await getCurrentLocationCoords()
  try {
    // 预约首页返回完整门店信息（地址、距离、经纬度），比 venue/select 的简要信息更适合附近门店展示
    const res = await studyVenueApi.reserveIndex({ currentLng: lng, currentLat: lat })
    venueOptions.value = filterReserveVenues(res?.data?.venueList)
  } catch (e) {
    venueOptions.value = []
  }
  if (!venueOptions.value.length) {
    try {
      const fallback = await studyVenueApi.select(lng, lat)
      venueOptions.value = filterReserveVenues(fallback?.data?.venueList)
    } catch (e) {
      venueOptions.value = []
    }
  }
  if (!venueOptions.value.length && Array.isArray(signData.value?.venueNearestList)) {
    venueOptions.value = filterReserveVenues(signData.value.venueNearestList)
  }
  // 门店列表可能覆盖掉已选中的预约门店，补回来避免下拉框显示成门店 ID
  if (signVenueId.value) {
    const pendingName =
      Number(pendingReserve.value?.venueId) === Number(signVenueId.value) ? pendingReserve.value?.venueName : ''
    ensureVenueOption(signVenueId.value, pendingName)
  }
}

async function loadPackages() {
  try {
    const res = await studyPackageApi.userPackageList()
    userPackages.value = res?.data?.list || []
  } catch (e) {
    userPackages.value = []
  }
}

async function loadIndex() {
  if (!store.isTokenValid) {
    return
  }
  indexLoading.value = true
  indexError.value = ''
  try {
    // 有当天待签到预约时先锁定预约门店，签到首页才会返回对应门店的扣费套餐
    if (!signVenueId.value) {
      const reserve = await resolvePendingReserve()
      if (reserve) {
        ensureVenueOption(reserve.venueId, reserve.venueName)
        signVenueId.value = reserve.venueId
      }
    }
    const { lng, lat } = await getCurrentLocationCoords()
    const [res, userRes] = await Promise.all([
      studySignApi.index({
        currentLng: lng,
        currentLat: lat,
        venueId: signVenueId.value || undefined
      }),
      studyUserApi.index().catch(error => {
        store.handleApiError(error)
        return null
      })
    ])
    signData.value = res?.data || null
    userOverview.value = userRes?.data || null
    updatedAt.value = currentClockText()

    const nearest = filterReserveVenues(signData.value?.venueNearestList)
    if (nearest.length && !venueOptions.value.length) {
      venueOptions.value = nearest
    }
    if (!signVenueId.value) {
      // venueNearest 可能是「押金专用」等非可签到门店，命中隐藏关键词时回退到列表首个门店
      const nearestVenue = signData.value?.venueNearest
      signVenueId.value =
        (nearestVenue && !isHiddenVenue(nearestVenue) ? nearestVenue.id : null) ||
        venueOptions.value[0]?.id ||
        null
    }
    if (!userPackages.value.length) {
      await loadPackages()
    }
  } catch (e) {
    if (store.handleApiError(e)) {
      return
    }
    indexError.value = e?.msg || '签到状态加载失败，请稍后重试。'
  } finally {
    indexLoading.value = false
  }
}

watch(
  () => signVenueId.value,
  value => {
    if (value) {
      loadVenueCoords()
    }
  }
)

useStudyRefresh(() => loadIndex())

onMounted(async () => {
  store.ensureStatus()
  await store.fetchConfig()
  await loadVenues()
})
</script>

<style lang="scss" scoped>
.sign-page {
  min-width: 0;
}

.sign-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sr-green-3);
  flex: none;
}

.refresh-icon {
  margin-right: 4px;
}

.seated-card {
  margin-bottom: 18px;
}

.light-entry {
  flex: none;
}

.light-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.light-seat {
  margin: 0;
  color: var(--sr-ink-2);
  font-size: 13px;

  strong {
    margin-left: 6px;
    color: var(--sr-ink);
    font-size: 15px;
  }
}

.light-tip {
  margin: 0;
  color: var(--sr-muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.light-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.seated-list {
  display: flex;
  flex-direction: column;
}

.seated-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  border-top: 1px solid var(--sr-line);
}

.seated-item:first-child {
  border-top: 0;
}

.seated-main {
  min-width: 0;
}

.seated-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.seated-seat {
  color: var(--sr-ink);
  font-size: 18px;
  font-weight: 600;
}

.seated-area {
  color: var(--sr-muted);
  font-size: 12px;
}

.seated-meta {
  margin: 4px 0 0;
  color: var(--sr-muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.seated-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  flex: none;
}

.sign-secondary {
  margin-top: 0;
}

.sign-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 0 18px 16px;
}

.sign-stat {
  min-width: 0;
}

.sign-stat + .sign-stat {
  padding-left: 14px;
  border-left: 1px solid var(--sr-line);
}

.sign-stat-label {
  display: block;
  color: var(--sr-muted);
  font-size: 10.5px;
}

.sign-stat-value {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;
  color: var(--sr-ink);
  font-size: 21px;
  font-weight: 600;

  &.is-text {
    font-family: inherit;
    font-size: 15px;
    letter-spacing: 0;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  em {
    color: var(--sr-muted);
    font-size: 11px;
    font-style: normal;
    font-weight: 400;
  }
}

.next-reserve {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 18px 16px;
  padding: 10px 12px;
  border: 1px solid var(--sr-line);
  border-radius: 9px;
  background: var(--sr-card-2);
  color: var(--sr-ink-2);
  font-size: 11.5px;
}

.nearby-list {
  display: flex;
  flex-direction: column;
  padding: 0 18px 12px;
}

.nearby-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 0;
  border-top: 1px solid var(--sr-line);
}

.nearby-item:first-child {
  border-top: 0;
}

.nearby-main {
  min-width: 0;

  strong {
    display: block;
    color: var(--sr-ink);
    font-size: 12.5px;
    font-weight: 500;
    overflow-wrap: anywhere;
  }
}

.nearby-meta {
  display: block;
  margin-top: 1px;
  color: var(--sr-muted);
  font-size: 10.5px;
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  .seated-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .seated-actions {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .seated-card .sr-card-head {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .seated-card .sr-card-sub {
    flex: 1 1 100%;
    margin-top: 2px;
  }

  .sign-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 0;
    padding: 0 14px 14px;
  }

  .sign-stat + .sign-stat {
    padding-left: 0;
    border-left: 0;
  }

  .sign-stat:nth-child(even) {
    padding-left: 12px;
    border-left: 1px solid var(--sr-line);
  }

  .sign-stat:nth-child(n + 3) {
    padding-top: 10px;
    border-top: 1px solid var(--sr-line);
  }
}
</style>
