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
                  :fallback-venue-id="signForm.venueId"
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
        <section class="sr-card guard-card">
          <div class="sr-card-head">
            <h2 class="sr-card-title">
              门禁
              <span class="sr-count">{{ guardList.length }}</span>
            </h2>
            <div class="guard-head-meta">
              <span class="sr-chip sr-chip-muted guard-venue">
                <el-icon><Location /></el-icon>
                <span class="guard-venue-name">{{ guardVenueName || '当前门店' }}</span>
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

        <!-- 签到入座 -->
        <section v-if="!seatedList.length" class="sr-card sign-in-card">
          <div class="sr-card-head">
            <h2 class="sr-card-title">签到入座</h2>
            <span v-if="signData?.descNoSignIn" class="sr-card-sub">{{ signData.descNoSignIn }}</span>
          </div>

          <div class="sign-in-body">
            <div class="sign-in-form">
              <div class="si-field">
                <label class="sr-field-label" for="signVenue">门店</label>
                <el-select id="signVenue" v-model="signForm.venueId" placeholder="请选择门店" filterable>
                  <el-option v-for="venue in venueOptions" :key="venue.id" :label="venue.venueName" :value="venue.id" />
                </el-select>
              </div>

              <div class="si-field">
                <label class="sr-field-label" for="signPackage">扣费套餐</label>
                <el-select id="signPackage" v-model="signForm.packageId" placeholder="请选择套餐" filterable>
                  <el-option
                    v-for="pkg in usablePackages"
                    :key="pkg.id"
                    :label="`${pkg.packageName}（剩余 ${pkg.restTimeStr || pkg.restNum || '—'}）`"
                    :value="pkg.id"
                  />
                </el-select>
              </div>

              <div v-if="qrNeedSignIn" class="si-field">
                <label class="sr-field-label" for="signQr">门店二维码内容</label>
                <el-input id="signQr" v-model="signForm.qrCode" placeholder="扫描门店前台二维码后粘贴内容" />
              </div>

              <div class="si-actions">
                <el-button type="primary" :loading="seatLoading" @click="loadSignSeats">加载座位图</el-button>
                <span class="si-hint">签到成功后会按所选套餐扣费。</span>
              </div>
            </div>

            <div v-if="seatAreas.length || seatLoading || seatError" class="si-map">
              <SeatMap
                :venue-name="selectedVenueName"
                :areas="seatAreas"
                start-time=""
                end-time=""
                :selected-seat-id="selectedSeat ? selectedSeat.id : null"
                :loading="seatLoading"
                :error="seatError"
                @select="onSelectSeat"
                @retry="loadSignSeats"
              />
              <div v-if="selectedSeat" class="si-confirm">
                <span>已选 <strong class="sr-mono">{{ selectedSeat.seatNumber }}</strong></span>
                <el-button type="primary" :loading="signing" @click="confirmSignSeat">确认签到入座</el-button>
              </div>
            </div>
          </div>
        </section>

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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import StudyShell from './components/study-shell.vue'
import SeatMap from './components/seat-map.vue'
import SeatActions from './components/seat-actions.vue'
import { studyGuardApi, studyPackageApi, studySignApi, studyUserApi, studyVenueApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import { DEFAULT_VENUE_QR_CODE } from '@/utils/study/constants'
import { clockOf, filterReserveVenues, getCurrentLocation, isHiddenVenue } from '@/utils/study/format'
import { isWebBluetoothSupported, openLockByBle, requestLockDevice } from '@/utils/study/ttlock-ble'

const store = useStudyStore()

const signData = ref(null)
const userOverview = ref(null)
const indexLoading = ref(false)
const indexError = ref('')
const updatedAt = ref('--:--')

const venueOptions = ref([])
const userPackages = ref([])

const signForm = reactive({ venueId: null, packageId: null, qrCode: DEFAULT_VENUE_QR_CODE })
const venueCoords = ref(null)
const seatAreas = ref([])
const seatLoading = ref(false)
const seatError = ref('')
const selectedSeat = ref(null)
const signing = ref(false)

const guardList = ref([])
const guardLoading = ref(false)
const guardError = ref('')
const guardOpeningId = ref(null)
const guardBleStatus = ref('')
/** 每个门禁记住用户选择过的蓝牙设备，避免每次开门都弹选择框 */
const guardDeviceCache = new Map()

const seatedList = computed(() => (Array.isArray(signData.value?.userSignInfoList) ? signData.value.userSignInfoList : []))

/**
 * 门禁跟随当前在座门店；未在座时跟随签到表单里选中的门店。
 * 小程序里用的是 venueNearest.id，这里优先用已签到门店，避免定位漂移。
 */
const guardVenueId = computed(() => {
  const seatedVenueId = seatedList.value[0]?.venueId ?? signData.value?.seatCurrent?.venueId
  if (seatedVenueId !== null && seatedVenueId !== undefined && seatedVenueId !== '') {
    return seatedVenueId
  }
  return signForm.venueId ?? signData.value?.venueNearest?.id ?? null
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

/** 门禁是否可提交开门（后端 canOpen 为 1） */
function canOpenGuard(item) {
  return Number(item?.canOpen) === 1
}

const signTotalNum = computed(() => {
  const value = Number(userOverview.value?.signTotalNum)
  return Number.isFinite(value) ? value : 0
})

const studyTotalText = computed(() => userOverview.value?.studyTotalTimeStr || '—')

const qrNeedSignIn = computed(() => String(signData.value?.qrCodeNeedSignIn || '') === 'true')

const usablePackages = computed(() => userPackages.value.filter(pkg => Number(pkg.canUsePay) === 1))

const selectedVenueName = computed(() => {
  const venue = venueOptions.value.find(item => Number(item.id) === Number(signForm.venueId))
  if (venue) {
    return venue.venueName
  }
  const nearest = signData.value?.venueNearest
  return nearest && !isHiddenVenue(nearest) ? nearest.venueName : ''
})

const selectedVenue = computed(() => venueOptions.value.find(item => Number(item.id) === Number(signForm.venueId)))

function nowTimeText() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function venueLocation() {
  const nearestList = Array.isArray(signData.value?.venueNearestList) ? signData.value.venueNearestList : []
  const matched = nearestList.find(item => Number(item.id) === Number(signForm.venueId))
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
  if (!signForm.venueId) {
    venueCoords.value = null
    return
  }
  try {
    const res = await studyVenueApi.reserveDetail(signForm.venueId)
    venueCoords.value = res?.data || null
  } catch (e) {
    venueCoords.value = null
  }
}

async function loadVenues() {
  const location = await getCurrentLocation()
  const lng = location ? location.lng : 0
  const lat = location ? location.lat : 0
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
    const list = res?.data?.list || []
    userPackages.value = list
    if (!signForm.packageId) {
      const preset = signData.value?.signInUserPackage
      const usable = list.filter(pkg => Number(pkg.canUsePay) === 1)
      signForm.packageId = preset?.id ?? usable[0]?.id ?? null
    }
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
    const location = await getCurrentLocation()
    const [res, userRes] = await Promise.all([
      studySignApi.index({
        currentLng: location ? location.lng : 0,
        currentLat: location ? location.lat : 0,
        venueId: signForm.venueId || undefined
      }),
      studyUserApi.index().catch(error => {
        store.handleApiError(error)
        return null
      })
    ])
    signData.value = res?.data || null
    userOverview.value = userRes?.data || null
    updatedAt.value = nowTimeText()

    const nearest = filterReserveVenues(signData.value?.venueNearestList)
    if (nearest.length && !venueOptions.value.length) {
      venueOptions.value = nearest
    }
    if (!signForm.venueId) {
      // venueNearest 可能是「押金专用」等非可签到门店，命中隐藏关键词时回退到列表首个门店
      const nearestVenue = signData.value?.venueNearest
      signForm.venueId =
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

async function loadGuardList() {
  if (!store.isTokenValid || !guardVenueId.value) {
    guardList.value = []
    guardError.value = ''
    return
  }
  guardLoading.value = true
  guardError.value = ''
  try {
    const res = await studyGuardApi.select(Number(guardVenueId.value))
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

async function loadSignSeats() {
  if (!signForm.venueId) {
    ElMessage.warning('请选择门店')
    return
  }
  if (!signForm.packageId) {
    ElMessage.warning('请选择扣费套餐')
    return
  }
  if (qrNeedSignIn.value && !signForm.qrCode.trim()) {
    ElMessage.warning('请填写门店二维码内容')
    return
  }
  seatLoading.value = true
  seatError.value = ''
  selectedSeat.value = null
  try {
    const res = await studySignApi.seatList({
      venueId: signForm.venueId,
      qrCode: signForm.qrCode.trim() || undefined,
      signInUserPackageId: signForm.packageId,
      signAnotherFlag: 0
    })
    seatAreas.value = res?.data?.venueAreaList || []
    if (!seatAreas.value.length) {
      seatError.value = '该门店暂无可签到座位'
    }
  } catch (e) {
    seatAreas.value = []
    seatError.value = e?.msg || '座位图加载失败，请稍后重试。'
    store.handleApiError(e)
  } finally {
    seatLoading.value = false
  }
}

function onSelectSeat(payload) {
  if (!payload?.seat) {
    return
  }
  selectedSeat.value = {
    id: payload.seat.id,
    seatNumber: payload.seat.seatNumber || '',
    areaName: payload.areaName || ''
  }
}

async function confirmSignSeat() {
  if (!selectedSeat.value || signing.value) {
    return
  }
  if (qrNeedSignIn.value && !signForm.qrCode.trim()) {
    ElMessage.warning('请填写门店二维码内容')
    return
  }
  signing.value = true
  try {
    const location = venueLocation()
    const res = await studySignApi.seatConfirm({
      seatId: selectedSeat.value.id,
      currentLng: location.lng,
      currentLat: location.lat,
      signInUserPackageId: signForm.packageId,
      signAnotherFlag: 0
    })
    ElMessage.success(res?.data?.studyTipText || '签到成功')
    selectedSeat.value = null
    seatAreas.value = []
    await loadIndex()
  } catch (e) {
    store.handleApiError(e)
  } finally {
    signing.value = false
  }
}

watch(
  () => signForm.venueId,
  value => {
    if (value) {
      loadVenueCoords()
    }
  }
)

watch(guardVenueId, () => loadGuardList(), { immediate: true })

watch(
  () => [store.isTokenValid, store.refreshKey],
  ([valid]) => {
    if (valid) {
      loadIndex()
      loadGuardList()
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

.sign-in-card {
  margin-bottom: 18px;
}

.sign-in-body {
  padding: 0 18px 18px;
}

.sign-in-form {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px 16px;
}

.si-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  :deep(.el-select) {
    width: 220px;
  }
}

.si-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 1px;
}

.si-hint {
  color: var(--sr-muted-2);
  font-size: 10.5px;
}

.si-map {
  margin-top: 16px;
}

.si-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--sr-green-line);
  border-radius: 10px;
  background: var(--sr-green-soft);
  color: var(--sr-green-ink);
  font-size: 12px;
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

.guard-card {
  margin-bottom: 18px;

  .sr-card-head {
    gap: 10px;
  }
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

  .sign-in-body {
    padding: 0 14px 14px;
  }

  .si-field {
    flex: 1 1 100%;
  }

  .si-field :deep(.el-select) {
    width: 100%;
  }

  .si-actions {
    width: 100%;
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
