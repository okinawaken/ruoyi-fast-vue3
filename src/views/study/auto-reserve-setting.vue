<template>
  <StudyShell>
    <div class="auto-reserve-setting-page">
      <header class="sr-page-head">
        <div>
          <p class="sr-eyebrow">自习室 · 自动预约</p>
          <h1 class="sr-title">自动预约配置</h1>
          <p class="sr-sub">设定每天的放号时刻与自动签到开关；启用中的任务会在该时刻自动尝试抢座。</p>
        </div>
        <div class="sr-actions">
          <el-button @click="goTasks">
            <el-icon><Back /></el-icon>
            返回任务
          </el-button>
        </div>
      </header>

      <div class="sr-grid-2 as-grid">
        <section class="sr-card">
          <div class="sr-card-head">
            <h2 class="sr-card-title">放号与签到</h2>
            <span class="sr-chip" :class="stateChipClass">
              <span class="sr-dot"></span>{{ stateText }}
            </span>
          </div>

          <div v-loading="loading" class="sr-card-body as-body">
            <div v-if="loadError" class="as-error" role="alert">
              <span>{{ loadError }}</span>
              <el-button size="small" @click="loadSetting">重试</el-button>
            </div>

            <el-form label-position="top" @submit.prevent>
              <el-form-item label="每天放号时刻">
                <el-time-picker
                  v-model="releaseTime"
                  format="HH:mm"
                  value-format="HH:mm"
                  placeholder="选择放号时刻"
                  arrow-control
                  :clearable="false"
                  :disabled="!store.isTokenValid"
                  style="width: 100%"
                  @change="onReleaseTimeChange"
                />
              </el-form-item>

              <el-form-item label="自动签到">
                <div class="as-switch-row">
                  <el-switch
                    v-model="signInEnable"
                    :active-value="1"
                    :inactive-value="0"
                    :disabled="!store.isTokenValid"
                  />
                  <span class="as-switch-hint">
                    {{ signInEnable === 1 ? '已开启：预约到点自动签到入座' : '已关闭：需要在签到页手动签到' }}
                  </span>
                </div>
              </el-form-item>
            </el-form>

            <div class="as-presets">
              <span class="sr-field-label">常用时刻</span>
              <div class="as-preset-list">
                <el-button
                  v-for="preset in PRESETS"
                  :key="preset"
                  size="small"
                  :type="releaseTime === preset ? 'primary' : 'default'"
                  :disabled="!store.isTokenValid"
                  @click="applyPreset(preset)"
                >{{ preset }}</el-button>
              </div>
            </div>

            <p class="as-hint">
              可直接输入 HH:mm，也可使用下拉选择。调度器每分钟扫描一次，按分钟匹配该时刻，秒数不参与判断。
              自动签到开启后，会在预约时段开始时自动签到入座；关闭则需在小程序手动签到。
            </p>

            <div class="sr-divider"></div>

            <div class="as-actions">
              <el-button type="primary" :loading="saving" :disabled="!canSave" @click="saveSetting">
                保存配置
              </el-button>
              <el-button :disabled="saving || !dirty" @click="resetSetting">撤销修改</el-button>
              <span v-if="dirty" class="sr-chip sr-chip-amber">
                <span class="sr-dot"></span>有未保存的修改
              </span>
            </div>

            <p class="as-saved">
              当前生效：<span class="sr-mono">{{ savedReleaseTime || '—' }}</span>
              · 自动签到{{ savedSignInEnable === 1 ? '已开启' : '已关闭' }}
            </p>
          </div>
        </section>

        <section class="sr-card">
          <div class="sr-card-head">
            <h2 class="sr-card-title">执行逻辑</h2>
            <span class="sr-card-sub">到达放号时刻后按顺序执行</span>
          </div>

          <div class="sr-card-body">
            <ol class="as-flow">
              <li>
                <span class="as-flow-index" aria-hidden="true">1</span>
                <div>
                  <strong>扫描启用中的任务</strong>
                  <p>调度器每分钟扫描一次，把放号时刻与当前时间按分钟比对。</p>
                </div>
              </li>
              <li>
                <span class="as-flow-index" aria-hidden="true">2</span>
                <div>
                  <strong>等待新放号日期</strong>
                  <p>读取门店可预约日期，只有出现晚于「放号基线」的新日期才会继续。</p>
                </div>
              </li>
              <li>
                <span class="as-flow-index" aria-hidden="true">3</span>
                <div>
                  <strong>校验星期与冲突</strong>
                  <p>目标日期不在执行星期内，或已有相同时段的预约时，本轮记为失败并写入原因。</p>
                </div>
              </li>
              <li>
                <span class="as-flow-index" aria-hidden="true">4</span>
                <div>
                  <strong>选座并抢座</strong>
                  <p>按「指定座位 → 偏好区域 → 全场任选」依次降级，仍没有可约座位时记为失败，结果写入执行记录。</p>
                </div>
              </li>
            </ol>

            <div class="sr-divider"></div>

            <ul class="as-notes">
              <li>放号时刻与自动签到开关按用户维度保存，只影响你自己的任务。</li>
              <li>自动签到开启后只对已绑定小程序 token 的用户生效；关闭后需在签到页手动签到。</li>
              <li>小程序 token 失效时任务会自动暂停；重新绑定后需在任务页手动恢复。</li>
              <li>保存会整体覆盖当前配置，撤销可恢复为上次保存的时刻和开关状态。</li>
            </ul>

            <el-button class="as-goto" @click="goTasks">
              管理自动预约任务
              <el-icon class="el-icon--right"><ArrowRight /></el-icon>
            </el-button>
          </div>
        </section>
      </div>
    </div>
  </StudyShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import StudyShell from './components/study-shell.vue'
import { studyAutoReserveApi } from '@/api/study/auto-reserve'
import useStudyStore from '@/store/modules/study'
import { clockOf } from '@/utils/study/time'
import { PAGE_PATH } from '@/utils/study/constants'
import { useStudyRefresh } from '@/composables/study/useStudyRefresh'

const store = useStudyStore()
const router = useRouter()

const PRESETS = ['08:00', '12:00', '18:00', '20:00']

const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')
const releaseTime = ref('')
const savedReleaseTime = ref('')
const signInEnable = ref(0)
const savedSignInEnable = ref(0)
const saving = ref(false)

const dirty = computed(
  () =>
    (!!releaseTime.value && releaseTime.value !== savedReleaseTime.value) ||
    signInEnable.value !== savedSignInEnable.value
)

const canSave = computed(
  () => store.isTokenValid && loaded.value && !loading.value && !loadError.value && !!releaseTime.value && dirty.value
)

const stateText = computed(() => {
  if (loading.value) {
    return '读取中'
  }
  if (loadError.value) {
    return '读取失败'
  }
  if (!loaded.value) {
    return '待读取'
  }
  if (dirty.value) {
    return '未保存'
  }
  return '已保存'
})

const stateChipClass = computed(() => {
  if (loadError.value) {
    return 'sr-chip-danger'
  }
  if (dirty.value) {
    return 'sr-chip-amber'
  }
  if (loaded.value) {
    return 'sr-chip-green'
  }
  return 'sr-chip-muted'
})

async function loadSetting() {
  if (!store.isTokenValid) {
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const res = await studyAutoReserveApi.setting()
    const value = clockOf(res?.data?.releaseTime) || '20:00'
    const enable = Number(res?.data?.signInEnable) === 1 ? 1 : 0
    releaseTime.value = value
    savedReleaseTime.value = value
    signInEnable.value = enable
    savedSignInEnable.value = enable
    loaded.value = true
  } catch (e) {
    if (store.handleApiError(e, { openBind: true })) {
      loadError.value = e?.msg || '小程序 token 已失效，请重新绑定后再试。'
      loaded.value = false
      return
    }
    loadError.value = e?.msg || '配置读取失败，请稍后重试。'
    loaded.value = false
  } finally {
    loading.value = false
  }
}

function applyPreset(value) {
  releaseTime.value = value
}

/**
 * 支持键盘输入后统一规范为 HH:mm；非法输入保持原样，保存时会提示
 */
function onReleaseTimeChange(value) {
  const normalized = clockOf(value)
  if (normalized) {
    releaseTime.value = normalized
  }
}

function resetSetting() {
  releaseTime.value = savedReleaseTime.value
  signInEnable.value = savedSignInEnable.value
}

async function saveSetting() {
  if (saving.value || !canSave.value) {
    return
  }
  const value = clockOf(releaseTime.value)
  if (!value) {
    ElMessage.warning('请选择有效的放号时刻')
    return
  }

  saving.value = true
  try {
    await studyAutoReserveApi.updateSetting({ releaseTime: value, signInEnable: signInEnable.value })
    releaseTime.value = value
    savedReleaseTime.value = value
    savedSignInEnable.value = signInEnable.value
    loaded.value = true
    ElMessage.success('配置已保存')
  } catch (e) {
    store.handleApiError(e, { openBind: true })
  } finally {
    saving.value = false
  }
}

function goTasks() {
  router.push(PAGE_PATH.AUTO_RESERVE)
}

useStudyRefresh(
  () => loadSetting(),
  {
    onInvalid: () => {
      loaded.value = false
    }
  }
)

onMounted(() => {
  store.ensureStatus()
})
</script>

<style lang="scss" scoped>
.auto-reserve-setting-page {
  min-width: 0;
}

.as-grid {
  align-items: stretch;
}

.as-body {
  min-height: 260px;
}

.as-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid #e2b8b1;
  border-radius: 9px;
  background: var(--sr-danger-soft);
  color: var(--sr-danger);
  font-size: 12px;
  line-height: 1.5;
}

.as-presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 2px;
}

.as-preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  .el-button + .el-button {
    margin-left: 0;
  }
}

.as-switch-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
}

.as-switch-hint {
  color: var(--sr-muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.as-hint {
  margin: 12px 0 0;
  color: var(--sr-muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.as-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;

  .el-button + .el-button {
    margin-left: 0;
  }
}

.as-saved {
  margin: 12px 0 0;
  color: var(--sr-muted);
  font-size: 11.5px;
}

.as-flow {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
  }

  strong {
    display: block;
    color: var(--sr-ink-2);
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.5;
  }

  p {
    margin: 2px 0 0;
    color: var(--sr-muted);
    font-size: 11.5px;
    line-height: 1.65;
  }
}

.as-flow-index {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 22px;
  height: 22px;
  border: 1px solid var(--sr-green-line);
  border-radius: 50%;
  background: var(--sr-green-soft);
  color: var(--sr-green-ink);
  font-family: var(--sr-font-mono);
  font-size: 10.5px;
  font-weight: 600;
}

.as-notes {
  margin: 0;
  padding-left: 18px;
  color: var(--sr-muted);
  font-size: 11.5px;
  line-height: 1.7;

  li + li {
    margin-top: 6px;
  }
}

.as-goto {
  margin-top: 16px;
}

@media (max-width: 640px) {
  .as-actions {
    .el-button {
      flex: 1 1 auto;
    }
  }
}
</style>
