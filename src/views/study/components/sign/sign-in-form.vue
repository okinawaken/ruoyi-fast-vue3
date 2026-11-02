<template>
  <section class="sr-card sign-in-card">
    <div class="sr-card-head">
      <h2 class="sr-card-title">签到入座</h2>
      <span v-if="description" class="sr-card-sub">{{ description }}</span>
    </div>

    <div class="sign-in-body">
      <div class="sign-in-form">
        <div class="si-field">
          <label class="sr-field-label" for="signVenue">门店</label>
          <el-select id="signVenue" v-model="venueId" placeholder="请选择门店" filterable>
            <el-option v-for="venue in venueOptions" :key="venue.id" :label="venue.venueName" :value="venue.id" />
          </el-select>
        </div>

        <div class="si-field">
          <label class="sr-field-label" for="signPackage">扣费套餐</label>
          <el-select id="signPackage" v-model="packageId" placeholder="请选择套餐" filterable>
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
          <el-input id="signQr" v-model="qrCode" placeholder="扫描门店前台二维码后粘贴内容" />
        </div>

        <div class="si-actions">
          <el-button type="primary" :loading="seatLoading" @click="loadSignSeats">加载座位图</el-button>
          <span class="si-hint">签到成功后会按所选套餐扣费。</span>
        </div>
      </div>

      <div v-if="seatAreas.length || seatLoading || seatError" class="si-map">
        <SeatMap
          :venue-name="venueName"
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
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import SeatMap from '../seat-map.vue'
import { studySignApi } from '@/api/study/sign'
import useStudyStore from '@/store/modules/study'
import { DEFAULT_VENUE_QR_CODE } from '@/utils/study/constants'

const props = defineProps({
  venueOptions: { type: Array, default: () => [] },
  venueId: { type: [String, Number], default: null },
  venueName: { type: String, default: '' },
  packages: { type: Array, default: () => [] },
  presetPackageId: { type: [String, Number], default: null },
  qrNeedSignIn: { type: Boolean, default: false },
  description: { type: String, default: '' },
  coords: { type: Object, default: () => ({ lng: 0, lat: 0 }) }
})

const emit = defineEmits(['update:venueId', 'signed'])

const store = useStudyStore()

const venueId = computed({
  get: () => props.venueId,
  set: value => emit('update:venueId', value)
})
const packageId = ref(null)
const qrCode = ref(DEFAULT_VENUE_QR_CODE)
const seatAreas = ref([])
const seatLoading = ref(false)
const seatError = ref('')
const selectedSeat = ref(null)
const signing = ref(false)

const usablePackages = computed(() => props.packages.filter(pkg => Number(pkg.canUsePay) === 1))

watch(
  () => [props.packages, props.presetPackageId],
  ([packages, presetId]) => {
    // 有预约时签到首页给出的扣费套餐必须优先使用，否则上游不会按预约座位签到
    if (presetId !== null && presetId !== undefined && presetId !== '') {
      packageId.value = presetId
      return
    }
    if (packageId.value) {
      return
    }
    const usable = (packages || []).filter(pkg => Number(pkg.canUsePay) === 1)
    packageId.value = usable[0]?.id ?? null
  },
  { immediate: true }
)

async function loadSignSeats() {
  if (!props.venueId) {
    ElMessage.warning('请选择门店')
    return
  }
  if (!packageId.value) {
    ElMessage.warning('请选择扣费套餐')
    return
  }
  if (props.qrNeedSignIn && !qrCode.value.trim()) {
    ElMessage.warning('请填写门店二维码内容')
    return
  }
  seatLoading.value = true
  seatError.value = ''
  selectedSeat.value = null
  try {
    const res = await studySignApi.seatList({
      venueId: props.venueId,
      qrCode: qrCode.value.trim() || undefined,
      signInUserPackageId: packageId.value,
      signAnotherFlag: 0
    })
    // 当天有待签到预约时，上游会用预约座位直接完成签到，返回 signInFlag=1 而不是座位图
    if (Number(res?.data?.signInFlag) === 1) {
      ElMessage.success(res?.msg && res.msg !== '操作成功' ? res.msg : '预约座位签到成功')
      seatAreas.value = []
      selectedSeat.value = null
      emit('signed')
      return
    }
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
  if (props.qrNeedSignIn && !qrCode.value.trim()) {
    ElMessage.warning('请填写门店二维码内容')
    return
  }
  signing.value = true
  try {
    const res = await studySignApi.seatConfirm({
      seatId: selectedSeat.value.id,
      currentLng: props.coords?.lng || 0,
      currentLat: props.coords?.lat || 0,
      signInUserPackageId: packageId.value,
      signAnotherFlag: 0
    })
    ElMessage.success(res?.data?.studyTipText || '签到成功')
    selectedSeat.value = null
    seatAreas.value = []
    emit('signed')
  } catch (e) {
    store.handleApiError(e)
  } finally {
    signing.value = false
  }
}
</script>

<style lang="scss" scoped>
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

@media (max-width: 640px) {
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
}
</style>
