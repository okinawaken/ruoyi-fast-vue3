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
          :preset-package-id="signData?.signInUserPackage?.id"
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
    </div>
  </StudyShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import StudyShell from './components/study-shell.vue'
import SeatActions from './components/seat-actions.vue'
import GuardSection from './components/sign/guard-section.vue'
import SignInForm from './components/sign/sign-in-form.vue'
import { studyPackageApi, studySignApi, studyUserApi, studyVenueApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import { clockOf, currentClockText, filterReserveVenues, getCurrentLocationCoords, isHiddenVenue } from '@/utils/study/format'
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
