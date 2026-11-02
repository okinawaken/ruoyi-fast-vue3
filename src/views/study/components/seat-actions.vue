<template>
  <div class="sa-group">
    <el-button v-if="canChangeSeat" class="sa-btn sa-btn-ghost" @click="openChangeSeat">
      <el-icon class="sa-icon"><Switch /></el-icon>
      换座
    </el-button>
    <el-button type="primary" class="sa-btn sa-btn-signout" @click="openSignOut">
      <el-icon class="sa-icon"><SwitchButton /></el-icon>
      签退
    </el-button>
  </div>

  <!-- 换座 -->
  <el-dialog
    v-model="changeVisible"
    class="sr-dialog"
    title="更换座位"
    width="680px"
    :close-on-click-modal="false"
    append-to-body
  >
    <div v-loading="changeLoading" class="change-body">
      <SeatMap
        :venue-name="venueName"
        :areas="changeAreas"
        start-time=""
        end-time=""
        :selected-seat-id="changeSeat ? changeSeat.id : null"
        :loading="changeLoading"
        :error="changeError"
        @select="onSelectChangeSeat"
        @retry="reloadChangeSeats"
      />
      <div class="sr-dialog-foot change-actions">
        <el-button :disabled="changing" @click="changeVisible = false">取消</el-button>
        <el-button type="primary" :loading="changing" :disabled="!changeSeat" @click="confirmChangeSeat">
          确认换座
        </el-button>
      </div>
    </div>
  </el-dialog>

  <!-- 签退 -->
  <el-dialog
    v-model="signOutVisible"
    class="sr-dialog"
    title="签退结算"
    width="520px"
    :close-on-click-modal="false"
    append-to-body
  >
    <div v-loading="signOutLoading" class="signout-body">
      <div v-if="qrNeedSignOut" class="sr-dialog-note">
        该门店需扫码签退：请扫描门店前台二维码，将内容填入下方后确认。
      </div>

      <span class="sr-field-label settle-label">选择结算套餐</span>
      <div v-if="settlePackages.length" class="settle-packages">
        <label
          v-for="pkg in settlePackages"
          :key="pkg.id"
          class="settle-package"
          :class="{ 'is-disabled': Number(pkg.canUsePay) !== 1 }"
        >
          <input
            type="radio"
            name="settlePackage"
            :value="pkg.id"
            :disabled="Number(pkg.canUsePay) !== 1"
            :checked="settlePackageId !== null && Number(settlePackageId) === Number(pkg.id)"
            @change="settlePackageId = pkg.id"
          />
          <span class="settle-package-main">
            <strong>{{ pkg.packageName }}</strong>
            <span class="settle-package-meta">
              <template v-if="pkg.restTimeStr">剩余 {{ pkg.restTimeStr }}</template>
              <template v-if="pkg.settleHourStr"> · {{ pkg.settleHourStr }}</template>
              <template v-if="pkg.useExpiryDateStr"> · 有效期至 {{ pkg.useExpiryDateStr }}</template>
            </span>
            <span v-if="Number(pkg.canUsePay) !== 1 && pkg.canNotUsePayDesc" class="settle-package-warn">
              {{ pkg.canNotUsePayDesc }}
            </span>
          </span>
        </label>
      </div>
      <div v-else-if="!signOutLoading" class="sr-empty">
        <el-empty :description="settleError || '暂无可用于结算的套餐'" :image-size="46" />
      </div>

      <div v-if="qrNeedSignOut" class="signout-qr">
        <label class="sr-field-label" for="signOutQr">门店二维码内容</label>
        <el-input id="signOutQr" v-model="signOutQr" placeholder="扫描门店前台二维码后粘贴内容" />
      </div>

      <div class="sr-dialog-foot signout-actions">
        <el-button :disabled="signingOut" @click="signOutVisible = false">取消</el-button>
        <el-button type="primary" :loading="signingOut" :disabled="!settlePackageId" @click="confirmSignOut">
          确认签退
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import SeatMap from './seat-map.vue'
import { studySignApi } from '@/api/study/sign'
import { studyVenueApi } from '@/api/study/venue'
import useStudyStore from '@/store/modules/study'
import { DEFAULT_VENUE_QR_CODE } from '@/utils/study/constants'
import { clockOf } from '@/utils/study/time'
import { filterReserveVenues } from '@/utils/study/venue'
import { getCurrentLocationCoords } from '@/utils/study/location'

const props = defineProps({
  signData: { type: Object, default: null },
  item: { type: Object, default: null },
  userSignId: { type: [String, Number], default: null },
  /** 该在座记录所属门店 ID，用于签退结算；缺省时从 signData 回退解析 */
  fallbackVenueId: { type: [String, Number], default: null },
  /** 换座 / 签退弹窗中显示的门店名 */
  venueName: { type: String, default: '' },
  /** 定位失败时的门店坐标兜底；缺省时从 signData 的最近门店解析 */
  fallbackCoords: { type: Object, default: null }
})

const emit = defineEmits(['refresh'])

const store = useStudyStore()

const canChangeSeat = computed(() => Number(props.signData?.canChangeSeat) === 1)
const qrNeedSignOut = computed(() => String(props.signData?.qrCodeNeedSignOut || '') === 'true')

function hasValue(value) {
  return value !== null && value !== undefined && value !== ''
}

function venueLocation() {
  if (props.fallbackCoords) {
    return props.fallbackCoords
  }
  const nearestList = Array.isArray(props.signData?.venueNearestList) ? props.signData.venueNearestList : []
  const seatVenueId = props.item?.venueId ?? props.item?.venue?.id ?? props.signData?.seatCurrent?.venueId
  const matched = nearestList.find(venue => Number(venue.id) === Number(seatVenueId))
  const fallback = matched || props.signData?.venueNearest
  const lng = Number(fallback?.venueLng)
  const lat = Number(fallback?.venueLat)
  return {
    lng: Number.isFinite(lng) ? lng : 0,
    lat: Number.isFinite(lat) ? lat : 0
  }
}

/* ---------------- 换座 ---------------- */
const changeVisible = ref(false)
const changeLoading = ref(false)
const changeError = ref('')
const changeAreas = ref([])
const changeSeat = ref(null)
const changing = ref(false)

async function openChangeSeat() {
  if (!hasValue(props.userSignId)) {
    ElMessage.warning('未获取到签到记录，请刷新状态后重试')
    return
  }
  changeVisible.value = true
  changeSeat.value = null
  await reloadChangeSeats()
}

async function reloadChangeSeats() {
  if (!hasValue(props.userSignId)) {
    return
  }
  changeLoading.value = true
  changeError.value = ''
  try {
    const res = await studySignApi.changeSeatList({ userSignId: props.userSignId })
    changeAreas.value = res?.data?.venueAreaList || []
    if (!changeAreas.value.length) {
      changeError.value = '暂无可更换座位'
    }
  } catch (e) {
    changeAreas.value = []
    changeError.value = e?.msg || '换座座位图加载失败'
    store.handleApiError(e)
  } finally {
    changeLoading.value = false
  }
}

function onSelectChangeSeat(payload) {
  if (!payload?.seat) {
    return
  }
  changeSeat.value = {
    id: payload.seat.id,
    seatNumber: payload.seat.seatNumber || '',
    areaName: payload.areaName || ''
  }
}

async function confirmChangeSeat() {
  if (!changeSeat.value || changing.value) {
    return
  }
  changing.value = true
  try {
    const location = venueLocation()
    const res = await studySignApi.changeSeatConfirm({
      seatId: changeSeat.value.id,
      currentLng: location.lng,
      currentLat: location.lat,
      userSignId: props.userSignId
    })
    ElMessage.success(res?.data?.studyTipText || '换座成功')
    changeVisible.value = false
    emit('refresh')
  } catch (e) {
    store.handleApiError(e)
  } finally {
    changing.value = false
  }
}

/* ---------------- 签退 ---------------- */
const signOutVisible = ref(false)
const signOutLoading = ref(false)
const settlePackages = ref([])
const settleError = ref('')
const settlePackageId = ref(null)
const signOutQr = ref(DEFAULT_VENUE_QR_CODE)
const signingOut = ref(false)

/**
 * 签退结算套餐所属门店。
 * 小程序用 seatCurrent.venueId 定位，后端未透传时依次回退到在座记录、最近门店与当前签到门店。
 */
function resolveSignOutVenueId() {
  const candidates = [
    props.signData?.seatCurrent?.venueId,
    props.item?.venueId,
    props.signData?.venueNearest?.id,
    props.fallbackVenueId
  ]
  return candidates.find(hasValue) ?? null
}

/**
 * 兜底门店 ID。
 * 概览页不加载门店列表，且无定位时 /sign/index 可能不返回 seatCurrent 与 venueNearest，
 * 此时按在座页的做法拉取门店列表，用首个可签到门店定位结算套餐。
 */
async function fetchFallbackVenueId() {
  const { lng, lat } = await getCurrentLocationCoords()
  const loadList = async request => {
    try {
      const res = await request()
      return filterReserveVenues(res?.data?.venueList)
    } catch (e) {
      return []
    }
  }
  let list = await loadList(() => studyVenueApi.reserveIndex({ currentLng: lng, currentLat: lat }))
  if (!list.length) {
    list = await loadList(() => studyVenueApi.select(lng, lat))
  }
  return list[0]?.id ?? null
}

/**
 * 签到首页返回的默认结算套餐 ID。
 * 小程序取 signInUserPackage.signInUserPackageId；后端 DTO 目前只映射了 id，两者都兼容。
 */
function resolveSignInPackageId() {
  const preset = props.signData?.signInUserPackage
  const value = preset?.signInUserPackageId ?? preset?.id
  return hasValue(value) ? value : null
}

/**
 * 默认选中签到时使用的套餐；找不到时不自动选择，交由用户手动选。
 * 与小程序一致：未选择套餐时不允许签退。
 */
function resolveDefaultSettlePackageId(list) {
  const usable = list.filter(pkg => Number(pkg.canUsePay) === 1)
  if (!usable.length) {
    return null
  }
  const presetId = resolveSignInPackageId()
  if (presetId !== null) {
    const matched = usable.find(pkg => Number(pkg.id) === Number(presetId))
    if (matched) {
      return matched.id ?? null
    }
  }
  const presetName = props.signData?.signInUserPackage?.packageName || props.item?.packageName
  if (presetName) {
    const matched = usable.find(pkg => pkg.packageName === presetName)
    if (matched) {
      return matched.id ?? null
    }
  }
  return null
}

async function openSignOut() {
  if (!hasValue(props.userSignId)) {
    ElMessage.warning('未获取到签到记录，请刷新状态后重试')
    return
  }
  signOutVisible.value = true
  signOutLoading.value = true
  settlePackages.value = []
  settleError.value = ''
  settlePackageId.value = null
  signOutQr.value = DEFAULT_VENUE_QR_CODE

  let venueId = resolveSignOutVenueId()
  if (!hasValue(venueId)) {
    venueId = await fetchFallbackVenueId()
    if (!signOutVisible.value) {
      signOutLoading.value = false
      return
    }
  }
  if (!hasValue(venueId)) {
    signOutLoading.value = false
    settleError.value = '未获取到门店信息，无法加载结算套餐'
    return
  }
  try {
    // 与小程序一致：签退套餐来自 settlePackage/select，默认选签到时使用的套餐
    const res = await studySignApi.settlePackageSelect({ venueId, userSignId: props.userSignId })
    const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.list) ? res.data.list : [])
    settlePackages.value = list
    if (!list.length) {
      settleError.value = '该门店暂无可用于结算的套餐'
      return
    }
    settlePackageId.value = resolveDefaultSettlePackageId(list)
  } catch (e) {
    settleError.value = e?.msg || '结算套餐加载失败，请稍后重试。'
    store.handleApiError(e)
  } finally {
    signOutLoading.value = false
  }
}

async function confirmSignOut() {
  if (signingOut.value) {
    return
  }
  if (!settlePackageId.value) {
    ElMessage.warning('请选择结算套餐')
    return
  }
  if (qrNeedSignOut.value && !signOutQr.value.trim()) {
    ElMessage.warning('请填写门店二维码内容')
    return
  }
  try {
    await ElMessageBox.confirm('确认使用此套餐扣费？', '签退离座', {
      confirmButtonText: '确认签退',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'sr-message-box'
    })
  } catch (e) {
    return
  }
  signingOut.value = true
  try {
    // 与小程序一致：扫码门店传二维码，普通门店 qrCode 传空串，统一走 /sign/out
    const { lng, lat } = await getCurrentLocationCoords()
    const fallback = venueLocation()
    const res = await studySignApi.signOut({
      qrCode: qrNeedSignOut.value ? signOutQr.value.trim() : '',
      currentLng: lng || fallback.lng,
      currentLat: lat || fallback.lat,
      settleUserPackageId: settlePackageId.value,
      userSignId: props.userSignId
    })
    showSignOutResult(res?.data)
    signOutVisible.value = false
    emit('refresh')
  } catch (e) {
    store.handleApiError(e)
  } finally {
    signingOut.value = false
  }
}

function showSignOutResult(data) {
  const lines = []
  if (data?.studyTipText) {
    lines.push(data.studyTipText)
  }
  if (data?.packageName) {
    lines.push(`扣费套餐：${data.packageName}`)
  }
  ElMessageBox.alert(lines.length ? lines.join('\n') : '签退成功', '签退完成', {
    confirmButtonText: '知道了',
    customClass: 'sr-message-box'
  })
}
</script>

<style lang="scss" scoped>
.sa-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.sa-btn {
  height: 30px;
  padding: 0 15px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
  transition: background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s, transform 0.12s;

  & + & {
    margin-left: 0;
  }

  &:active {
    transform: translateY(1px);
  }
}

.sa-icon {
  margin-right: 5px;
  font-size: 13px;
}

.sa-btn-ghost {
  border-color: var(--sr-line-strong);
  background: transparent;
  color: var(--sr-ink-2);

  &:hover,
  &:focus {
    border-color: var(--sr-green-line);
    background: var(--sr-green-soft);
    color: var(--sr-green-ink);
  }
}

.sa-btn-signout {
  box-shadow: 0 4px 12px rgba(36, 81, 63, 0.18);

  &:hover,
  &:focus {
    box-shadow: 0 6px 16px rgba(36, 81, 63, 0.24);
  }
}

.change-body {
  min-height: 120px;
}

.change-actions {
  margin-top: 14px;
}

.settle-label {
  display: block;
  margin-top: 14px;
  margin-bottom: 7px;
}

.settle-packages {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.settle-package {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 12px;
  border: 1px solid #e4dcc9;
  border-radius: 9px;
  background: #fffdf8;
  cursor: pointer;

  &.is-disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  input {
    margin-top: 3px;
    accent-color: #24513f;
  }
}

.settle-package-main {
  min-width: 0;

  strong {
    display: block;
    color: #1b2a24;
    font-size: 12.5px;
    font-weight: 600;
  }
}

.settle-package-meta {
  display: block;
  margin-top: 2px;
  color: #5f6c64;
  font-size: 10.5px;
  line-height: 1.55;
}

.settle-package-warn {
  display: block;
  margin-top: 3px;
  color: #a64035;
  font-size: 10.5px;
}

.signout-qr {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
}

.signout-actions {
  margin-top: 18px;
}

@media (max-width: 640px) {
  .sa-btn {
    padding: 0 13px;
  }
}
</style>
