<template>
  <StudyShell>
    <div class="overview-page">
      <header class="sr-page-head">
        <div>
          <p class="sr-eyebrow">自习室 · 账号</p>
          <h1 class="sr-title">概览</h1>
          <p class="sr-sub">个人资料、套餐与报修、进行中的预约和最近的签到记录。</p>
        </div>
        <div class="sr-actions">
          <span class="sr-updated">
            <span class="overview-live-dot" aria-hidden="true"></span>
            更新于 {{ updatedAt }}
          </span>
          <el-button :loading="refreshing" @click="refreshAll">
            <el-icon class="refresh-icon"><Refresh /></el-icon>
            刷新数据
          </el-button>
        </div>
      </header>

      <div v-if="notice && Number(notice.showFlag) === 1" class="sr-card overview-notice" role="note">
        <el-icon class="overview-notice-icon"><Bell /></el-icon>
        <div class="overview-notice-main">
          <strong>{{ notice.title || '通知公告' }}</strong>
          <p>{{ notice.noticeMsg }}</p>
        </div>
        <span v-if="notice.venueName" class="sr-chip sr-chip-muted">{{ notice.venueName }}</span>
      </div>

      <AccountCard
        :user="user"
        :detail="detail"
        :fee="fee"
        :reserve-count="activeReserves.length"
        :reserve-note="reserveNote"
        :updated-at="updatedAt"
        :loading="userLoading"
        :profile-loading="profileLoading"
      >
        <template #seat>
          <CurrentSeat :sign-data="signData" :loading="seatLoading" />
        </template>
      </AccountCard>

      <AccountTabs v-model:busy="tabsBusy" :refresh-seq="tabsRefreshSeq" />

      <div class="sr-grid-2 overview-grid">
        <ReservationList
          :list="reserves"
          :loading="reserveLoading"
          @cancel="handleCancelReserve"
          @go-reserve="goReserve"
        />
        <SignRecordList
          :list="signRecords"
          :loading="signLoading"
          :has-more="signHasMore"
          :loading-more="signLoadingMore"
          @load-more="loadMoreSign"
        />
      </div>

      <p class="overview-foot">数据来自小程序接口 · 最近更新 {{ updatedAt }}</p>
    </div>
  </StudyShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import StudyShell from './components/study-shell.vue'
import AccountCard from './components/account-card.vue'
import AccountTabs from './components/account-tabs.vue'
import CurrentSeat from './components/current-seat.vue'
import ReservationList from './components/reservation-list.vue'
import SignRecordList from './components/sign-record-list.vue'
import { studyConfigApi } from '@/api/study/config'
import { studyReserveApi } from '@/api/study/reserve'
import { studySignApi } from '@/api/study/sign'
import { studyUserApi } from '@/api/study/user'
import useStudyStore from '@/store/modules/study'
import { currentClockText, parseApiDate } from '@/utils/study/time'
import { isEndedReserve } from '@/utils/study/reserve'
import { getCurrentLocationCoords } from '@/utils/study/location'
import { PAGE_PATH } from '@/utils/study/constants'
import { useLatestRequest } from '@/composables/study/useLatestRequest'

const store = useStudyStore()
const router = useRouter()

const user = ref(null)
const detail = ref(null)
const fee = ref(null)
const reserves = ref([])
const signData = ref(null)
const signRecords = ref([])
const notice = ref(null)
const signHasMore = ref(false)
const updatedAt = ref('--:--')
const tabsRefreshSeq = ref(0)

const userLoading = ref(false)
const profileLoading = ref(false)
const seatLoading = ref(false)
const reserveLoading = ref(false)
const signLoading = ref(false)
const signLoadingMore = ref(false)
const tabsBusy = ref(false)

const loadRequest = useLatestRequest()

const refreshing = computed(
  () => userLoading.value || profileLoading.value || seatLoading.value || reserveLoading.value || signLoading.value || tabsBusy.value
)

const activeReserves = computed(() => reserves.value.filter(item => !isEndedReserve(item)))

const reserveNote = computed(() => {
  const first = activeReserves.value[0]
  if (!first) {
    return '暂无进行中的预约'
  }
  const parsed = parseApiDate(first.reserveDateStr)
  const dateText = parsed ? (parsed.isToday ? '今天' : parsed.label) : first.reserveDateStr || ''
  const timeText = String(first.reserveTimeStr || '')
    .split(/[-–—~至]/)[0]
    .trim()
  const tail = [dateText, timeText].filter(Boolean).join(' ')
  return tail ? `最近一笔：${tail}` : '暂无进行中的预约'
})

function canApply(seq) {
  return loadRequest.isLatest(seq) && store.isTokenValid
}

function setAllLoading(value) {
  userLoading.value = value
  profileLoading.value = value
  seatLoading.value = value
  reserveLoading.value = value
  signLoading.value = value
}

function clearLocalData() {
  loadRequest.invalidate()
  user.value = null
  detail.value = null
  fee.value = null
  reserves.value = []
  signData.value = null
  signRecords.value = []
  notice.value = null
  signHasMore.value = false
  signLoadingMore.value = false
  setAllLoading(false)
  updatedAt.value = '--:--'
}

function stopLoadingAndKeepData() {
  loadRequest.invalidate()
  signLoadingMore.value = false
  setAllLoading(false)
}

function dedupeById(list) {
  const seen = new Set()
  const result = []
  ;(Array.isArray(list) ? list : []).forEach(item => {
    if (!item) {
      return
    }
    const key = item.id ?? `${item.signDateStr || ''}-${item.signInTimeStr || ''}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    result.push(item)
  })
  return result
}

async function loadUser(seq) {
  userLoading.value = true
  try {
    const res = await studyUserApi.index()
    if (!canApply(seq)) {
      return
    }
    user.value = res?.data || null
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (loadRequest.isLatest(seq)) {
      userLoading.value = false
    }
  }
}

async function loadProfile(seq) {
  profileLoading.value = true
  try {
    const [detailRes, feeRes] = await Promise.all([studyUserApi.detail(), studyUserApi.fee()])
    if (!canApply(seq)) {
      return
    }
    detail.value = detailRes?.data || null
    fee.value = feeRes?.data || null
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (loadRequest.isLatest(seq)) {
      profileLoading.value = false
    }
  }
}

async function loadReserves(seq) {
  reserveLoading.value = true
  try {
    const res = await studyReserveApi.userList()
    if (!canApply(seq)) {
      return
    }
    reserves.value = Array.isArray(res?.data?.list) ? res.data.list : []
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (loadRequest.isLatest(seq)) {
      reserveLoading.value = false
    }
  }
}

async function loadSeat(seq) {
  seatLoading.value = true
  try {
    const { lng, lat } = await getCurrentLocationCoords()
    if (!canApply(seq)) {
      return
    }
    const res = await studySignApi.index({
      currentLng: lng,
      currentLat: lat
    })
    if (!canApply(seq)) {
      return
    }
    signData.value = res?.data || null
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (loadRequest.isLatest(seq)) {
      seatLoading.value = false
    }
  }
}

async function loadSignRecords(seq) {
  signLoading.value = true
  try {
    const res = await studyUserApi.signList(0)
    if (!canApply(seq)) {
      return
    }
    const list = Array.isArray(res?.data?.list) ? res.data.list : []
    signRecords.value = dedupeById(list)
    signHasMore.value = list.length > 0
  } catch (e) {
    store.handleApiError(e)
  } finally {
    if (loadRequest.isLatest(seq)) {
      signLoading.value = false
    }
  }
}

async function loadNotice() {
  try {
    const res = await studyConfigApi.notice(0)
    notice.value = res?.data || null
  } catch (e) {
    notice.value = null
  }
}

async function loadAll() {
  if (!store.isBound) {
    clearLocalData()
    return
  }
  if (!store.isTokenValid) {
    stopLoadingAndKeepData()
    return
  }

  const seq = loadRequest.next()
  await Promise.allSettled([
    loadUser(seq),
    loadProfile(seq),
    loadReserves(seq),
    loadSeat(seq),
    loadSignRecords(seq),
    loadNotice()
  ])

  if (loadRequest.isLatest(seq) && store.isTokenValid) {
    updatedAt.value = currentClockText()
  }
}

function refreshAll() {
  tabsRefreshSeq.value += 1
  loadAll()
}

async function loadMoreSign() {
  if (signLoadingMore.value || signLoading.value || !signHasMore.value || !store.isTokenValid) {
    return
  }
  const seq = loadRequest.current()
  signLoadingMore.value = true
  try {
    const res = await studyUserApi.signListMore()
    if (!loadRequest.isLatest(seq) || !store.isTokenValid) {
      return
    }
    const list = Array.isArray(res?.data?.list) ? res.data.list : []
    const existing = new Set(signRecords.value.map(item => item?.id))
    const added = list.filter(item => item && !existing.has(item.id))
    if (added.length === 0) {
      signHasMore.value = false
      return
    }
    signRecords.value = signRecords.value.concat(added)
  } catch (e) {
    store.handleApiError(e)
  } finally {
    signLoadingMore.value = false
  }
}

function fallbackCancelTip(record) {
  const parsed = parseApiDate(record?.reserveDateStr)
  const dateText = parsed ? parsed.label.replace(' · 今天', '') : record?.reserveDateStr || ''
  const timeText = record?.reserveTimeStr || ''
  const when = [dateText, timeText].filter(Boolean).join(' ')
  return `取消${when ? ` ${when} ` : ''}的预约后，座位会立即释放，是否继续？`
}

async function handleCancelReserve(record) {
  if (!record || record.id === undefined || record.id === null) {
    return
  }
  let content = fallbackCancelTip(record)
  try {
    const res = await studyReserveApi.cancelTip(record.id)
    if (res?.data?.tipDesc) {
      content = res.data.tipDesc
    }
  } catch (e) {
    if (store.handleApiError(e)) {
      return
    }
  }

  ElMessageBox.confirm(content, '取消预约', {
    confirmButtonText: '确认取消',
    cancelButtonText: '再想想',
    type: 'warning',
    customClass: 'sr-message-box'
  })
    .then(async () => {
      try {
        await studyReserveApi.cancel(record.id)
        ElMessage.success('预约已取消')
        await loadReserves(loadRequest.current())
      } catch (e) {
        store.handleApiError(e)
      }
    })
    .catch(() => {})
}

function goReserve() {
  router.push(PAGE_PATH.RESERVE)
}

watch(
  () => [store.statusLoaded, store.isBound, store.isTokenValid, store.refreshKey],
  () => {
    if (!store.isBound) {
      clearLocalData()
      return
    }
    if (!store.isTokenValid) {
      stopLoadingAndKeepData()
      return
    }
    loadAll()
  },
  { immediate: true }
)

onMounted(() => {
  store.ensureStatus()
})
</script>

<style lang="scss" scoped>
.overview-page {
  min-width: 0;
}

.overview-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sr-green-3);
  flex: none;
}

.refresh-icon {
  margin-right: 4px;
}

.overview-notice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  padding: 13px 16px;
  border-color: var(--sr-amber-line);
  background: linear-gradient(90deg, var(--sr-amber-soft), var(--sr-card));
}

.overview-notice-icon {
  margin-top: 2px;
  color: var(--sr-amber);
  font-size: 16px;
  flex: none;
}

.overview-notice-main {
  flex: 1;
  min-width: 0;

  strong {
    display: block;
    color: var(--sr-amber-ink);
    font-size: 12.5px;
    font-weight: 600;
  }

  p {
    margin: 3px 0 0;
    color: var(--sr-ink-2);
    font-size: 11.5px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
}

.overview-grid {
  margin-top: 20px;
}

.overview-foot {
  margin-top: 12px;
  color: var(--sr-muted-2);
  font-size: 10.5px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1120px) {
  .overview-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .overview-foot {
    text-align: left;
  }

  .overview-notice {
    padding: 12px;
  }
}
</style>
