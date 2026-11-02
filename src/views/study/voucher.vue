<template>
  <StudyShell>
    <div class="voucher-page">
      <header class="sr-page-head">
        <div>
          <p class="sr-eyebrow">自习室 · 门店服务</p>
          <h1 class="sr-title">团购券核销</h1>
          <p class="sr-sub">核销美团、抖音团购券，核销结果会直接回写平台。</p>
        </div>
      </header>

      <div class="sr-grid-2 voucher-grid">
        <section class="sr-card">
          <div class="sr-card-head">
            <h2 class="sr-card-title">核销信息</h2>
            <span class="sr-card-sub">核销会真实消耗券码，请核对后提交</span>
          </div>

          <div class="voucher-body">
            <div class="voucher-field">
              <span class="sr-field-label">平台</span>
              <div class="channel-group" role="radiogroup" aria-label="核销平台">
                <button
                  type="button"
                  class="channel-item"
                  :class="{ 'is-active': channel === 'meituan' }"
                  :disabled="!meituanEnabled"
                  role="radio"
                  :aria-checked="channel === 'meituan'"
                  @click="selectChannel('meituan')"
                >
                  <el-icon><Shop /></el-icon>
                  <span>美团团购</span>
                  <span v-if="!meituanEnabled" class="channel-off">未开启</span>
                </button>
                <button
                  type="button"
                  class="channel-item"
                  :class="{ 'is-active': channel === 'douyin' }"
                  :disabled="!douyinEnabled"
                  role="radio"
                  :aria-checked="channel === 'douyin'"
                  @click="selectChannel('douyin')"
                >
                  <el-icon><VideoCamera /></el-icon>
                  <span>抖音券</span>
                  <span v-if="!douyinEnabled" class="channel-off">未开启</span>
                </button>
              </div>
            </div>

            <div class="voucher-field">
              <label class="sr-field-label" for="voucherVenue">门店</label>
              <el-select
                id="voucherVenue"
                v-model="venueId"
                placeholder="请选择门店"
                filterable
                style="width: 100%"
                :loading="venueLoading"
              >
                <el-option v-for="venue in venueList" :key="venue.id" :label="venue.venueName" :value="venue.id" />
              </el-select>
            </div>

            <div class="voucher-field">
              <label class="sr-field-label" for="voucherCode">券码</label>
              <el-input
                id="voucherCode"
                v-model="code"
                placeholder="请输入或粘贴券码"
                clearable
                maxlength="64"
                @keyup.enter="submit"
              />
            </div>

            <div class="sr-dialog-note is-warning">
              核销成功后无法撤销，请先确认券码与门店是否匹配。
            </div>

            <div class="voucher-actions">
              <el-button type="primary" size="large" :loading="submitting" :disabled="!channel" @click="submit">
                确认核销
              </el-button>
              <el-button size="large" :disabled="submitting" @click="resetForm">清空</el-button>
            </div>
          </div>
        </section>

        <section class="sr-card">
          <div class="sr-card-head">
            <h2 class="sr-card-title">核销结果</h2>
            <span v-if="result" class="sr-chip" :class="Number(result.consumeState) === 1 ? 'sr-chip-green' : 'sr-chip-amber'">
              <span class="sr-dot"></span>{{ Number(result.consumeState) === 1 ? '核销成功' : '核销完成' }}
            </span>
          </div>

          <div class="result-body">
            <template v-if="result">
              <div class="result-mark" :class="{ 'is-ok': Number(result.consumeState) === 1 }" aria-hidden="true">
                <el-icon><CircleCheck v-if="Number(result.consumeState) === 1" /><WarningFilled v-else /></el-icon>
              </div>
              <p class="result-msg">{{ result.consumeMsg || '核销请求已提交' }}</p>
              <div class="result-kv">
                <div class="sr-kv"><span class="sr-kv-key">平台</span><span class="sr-kv-value">{{ channel === 'douyin' ? '抖音' : '美团' }}</span></div>
                <div class="sr-kv"><span class="sr-kv-key">门店</span><span class="sr-kv-value">{{ selectedVenueName || '—' }}</span></div>
                <div class="sr-kv"><span class="sr-kv-key">套餐</span><span class="sr-kv-value">{{ result.packageName || '—' }}</span></div>
                <div class="sr-kv"><span class="sr-kv-key">券码</span><span class="sr-kv-value sr-mono">{{ result.orderNumber || code || '—' }}</span></div>
              </div>
              <el-button class="result-again" @click="resetForm">继续核销</el-button>
            </template>
            <div v-else class="sr-empty">
              <el-empty description="核销结果会显示在这里" :image-size="52" />
            </div>
          </div>
        </section>
      </div>
    </div>
  </StudyShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import StudyShell from './components/study-shell.vue'
import { studyMiscApi, studyVenueApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'
import { getCurrentLocationCoords } from '@/utils/study/format'
import { useStudyRefresh } from '@/composables/study/useStudyRefresh'

const store = useStudyStore()

const channel = ref('meituan')
const venueId = ref(null)
const venueList = ref([])
const venueLoading = ref(false)
const code = ref('')
const submitting = ref(false)
const result = ref(null)

const meituanEnabled = computed(() => String(store.config?.meiTuanOpen || '') === 'true')
const douyinEnabled = computed(() => String(store.config?.douYinOpen || '') === 'true')

const selectedVenueName = computed(() => venueList.value.find(item => Number(item.id) === Number(venueId.value))?.venueName || '')

async function loadVenues() {
  venueLoading.value = true
  venueList.value = []
  try {
    const { lng, lat } = await getCurrentLocationCoords()
    const res =
      channel.value === 'douyin'
        ? await studyVenueApi.douyinSelect(lng, lat)
        : await studyVenueApi.receiptSelect(lng, lat)
    venueList.value = res?.data?.venueList || []
  } catch (e) {
    venueList.value = []
    store.handleApiError(e)
  } finally {
    if (!venueList.value.length) {
      try {
        const fallback = await studyVenueApi.reserveSelect()
        venueList.value = fallback?.data?.venueList || []
      } catch (e2) {
        venueList.value = []
      }
    }
    venueLoading.value = false
  }
}

function selectChannel(value) {
  if (channel.value === value) {
    return
  }
  channel.value = value
  venueId.value = null
  result.value = null
  loadVenues()
}

async function submit() {
  if (submitting.value) {
    return
  }
  if (!channel.value) {
    ElMessage.warning('请选择核销平台')
    return
  }
  if (channel.value === 'meituan' && !meituanEnabled.value) {
    ElMessage.warning('美团核销未开启')
    return
  }
  if (channel.value === 'douyin' && !douyinEnabled.value) {
    ElMessage.warning('抖音核销未开启')
    return
  }
  if (!venueId.value) {
    ElMessage.warning('请选择门店')
    return
  }
  if (!code.value.trim()) {
    ElMessage.warning('请输入券码')
    return
  }

  submitting.value = true
  try {
    const payload = { venueId: venueId.value, code: code.value.trim() }
    const res =
      channel.value === 'douyin'
        ? await studyMiscApi.douyinVerify(payload)
        : await studyMiscApi.receiptConsume(payload)
    result.value = res?.data || null
    ElMessage.success('核销请求已提交')
  } catch (e) {
    store.handleApiError(e)
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  code.value = ''
  result.value = null
}

useStudyRefresh(async () => {
  // 等配置就绪后再决定渠道，避免先用默认渠道请求一次
  await store.fetchConfig()
  if (!meituanEnabled.value && douyinEnabled.value) {
    channel.value = 'douyin'
  }
  loadVenues()
})

onMounted(() => {
  store.ensureStatus()
})
</script>

<style lang="scss" scoped>
.voucher-page {
  min-width: 0;
}

.voucher-grid {
  align-items: stretch;
}

.voucher-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 18px 18px;
}

.voucher-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.channel-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.channel-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  border: 1px solid var(--sr-line);
  border-radius: 10px;
  background: var(--sr-card-2);
  color: var(--sr-ink-2);
  font-family: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--sr-green-line);
    background: var(--sr-green-soft);
  }

  &.is-active {
    border-color: var(--sr-green);
    background: var(--sr-green-soft);
    color: var(--sr-green-ink);
    font-weight: 600;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.channel-off {
  color: var(--sr-muted-2);
  font-size: 10px;
}

.voucher-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.result-body {
  padding: 0 18px 18px;
}

.result-mark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--sr-amber-line);
  border-radius: 12px;
  background: var(--sr-amber-soft);
  color: var(--sr-amber);
  font-size: 22px;

  &.is-ok {
    border-color: var(--sr-green-line);
    background: var(--sr-green-soft);
    color: var(--sr-green-2);
  }
}

.result-msg {
  margin: 12px 0 0;
  color: var(--sr-ink-2);
  font-size: 13px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.result-kv {
  margin-top: 12px;
  padding: 2px 12px;
  border: 1px solid var(--sr-line);
  border-radius: 10px;
  background: var(--sr-card-2);
}

.result-again {
  margin-top: 14px;
}

@media (max-width: 640px) {
  .voucher-body,
  .result-body {
    padding: 0 14px 14px;
  }

  .channel-item {
    flex: 1 1 auto;
    justify-content: center;
  }

  .voucher-actions :deep(.el-button) {
    flex: 1 1 auto;
  }
}
</style>
