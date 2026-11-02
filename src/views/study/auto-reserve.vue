<template>
  <StudyShell>
    <div class="auto-reserve-page">
      <header class="sr-page-head">
        <div>
          <p class="sr-eyebrow">自习室 · 自动预约</p>
          <h1 class="sr-title">自动预约</h1>
          <p class="sr-sub">按放号时刻自动抢座，可同时开启到点自动签到；只在勾选的星期执行，冲突或没有新放号日期时本轮记为失败。</p>
        </div>
        <div class="sr-actions">
          <span v-if="releaseTime" class="sr-updated">
            放号时刻 <span class="sr-mono">{{ releaseTime }}</span>
            · 自动签到 <span class="sr-mono">{{ signInEnable === 1 ? '开启' : '关闭' }}</span>
          </span>
          <el-button @click="goSetting">
            <el-icon><Setting /></el-icon>
            放号与签到
          </el-button>
          <el-button :loading="loading" @click="reloadAll">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
          <el-button type="primary" :disabled="!store.isTokenValid" @click="openCreate">
            <el-icon><Plus /></el-icon>
            新建任务
          </el-button>
        </div>
      </header>

      <div class="ar-tip sr-note" role="note">
        <el-icon><InfoFilled /></el-icon>
        <span v-if="releaseTime">
          每天 <strong class="sr-mono">{{ releaseTime }}</strong> 触发启用中的任务；自动签到{{ signInEnable === 1 ? '已开启' : '未开启' }}。小程序 token 失效时任务会自动暂停，重新绑定后需手动恢复。
        </span>
        <span v-else>
          还没有读取到放号时刻，<el-button link type="primary" @click="goSetting">先去配置</el-button>后再创建任务。
        </span>
      </div>

      <section v-if="loadError" class="sr-card ar-feedback" role="alert">
        <div class="sr-empty">
          <el-empty :description="loadError" :image-size="56" />
          <el-button type="primary" @click="reloadAll">重新加载</el-button>
        </div>
      </section>

      <template v-else>
        <section class="ar-list" v-loading="loading">
          <div v-if="tasks.length" class="ar-task-grid">
            <TaskCard
              v-for="task in tasks"
              :key="task.id"
              :task="task"
              :executing="executingId === task.id"
              :action-loading="actionLoadingId === task.id"
              :token-valid="store.isTokenValid"
              @records="openRecords(task)"
              @execute="executeTask(task)"
              @toggle="toggleTask(task)"
              @command="command => onTaskCommand(command, task)"
            />
          </div>

          <div v-else-if="loaded" class="sr-card ar-feedback">
            <div class="sr-empty">
              <el-empty description="还没有自动预约任务" :image-size="64" />
              <p class="ar-empty-hint">创建任务后，系统会在每天的放号时刻为你抢座。</p>
              <el-button type="primary" :disabled="!store.isTokenValid" @click="openCreate">新建第一个任务</el-button>
            </div>
          </div>
        </section>

        <div v-if="total > pageSize" class="ar-pagination">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :total="total"
            :page-size="pageSize"
            :current-page="pageNum"
            @current-change="onPageChange"
          />
        </div>
      </template>
    </div>

    <TaskFormDialog
      v-model:visible="formVisible"
      :task="editingTask"
      @saved="onTaskSaved"
    />

    <RecordDialog
      ref="recordDialogRef"
      v-model:visible="recordsVisible"
      :task="recordsTask"
    />
  </StudyShell>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import StudyShell from './components/study-shell.vue'
import TaskCard from './components/auto-reserve/task-card.vue'
import TaskFormDialog from './components/auto-reserve/task-form-dialog.vue'
import RecordDialog from './components/auto-reserve/record-dialog.vue'
import { studyAutoReserveApi } from '@/api/study/auto-reserve'
import useStudyStore from '@/store/modules/study'
import { clockOf } from '@/utils/study/time'
import { AUTO_RESERVE_ENABLE_STATUS, PAGE_PATH } from '@/utils/study/constants'
import { useLatestRequest } from '@/composables/study/useLatestRequest'
import { useStudyRefresh } from '@/composables/study/useStudyRefresh'

const store = useStudyStore()
const router = useRouter()

/* ---------- 任务列表 ---------- */
const tasks = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')
const releaseTime = ref('')
const signInEnable = ref(0)
const executingId = ref(null)
const actionLoadingId = ref(null)

const listRequest = useLatestRequest()

/* ---------- 弹窗 ---------- */
const formVisible = ref(false)
const editingTask = ref(null)

const recordsVisible = ref(false)
const recordsTask = ref(null)
const recordDialogRef = ref(null)

function isEnabled(task) {
  return Number(task?.enableStatus) === AUTO_RESERVE_ENABLE_STATUS.ENABLED
}

/* ---------- 列表加载 ---------- */
async function loadTasks({ quiet = false } = {}) {
  if (!store.isTokenValid) {
    return
  }
  const seq = listRequest.next()
  if (!quiet) {
    loading.value = true
  }
  loadError.value = ''
  try {
    const res = await studyAutoReserveApi.taskList({ pageNum: pageNum.value, pageSize: pageSize.value })
    if (!listRequest.isLatest(seq)) {
      return
    }
    tasks.value = Array.isArray(res?.rows) ? res.rows : []
    total.value = Number(res?.total) || 0
    loaded.value = true
    // 当前页被删空时回退一页
    if (!tasks.value.length && pageNum.value > 1) {
      pageNum.value -= 1
      await loadTasks({ quiet })
    }
  } catch (e) {
    if (!listRequest.isLatest(seq)) {
      return
    }
    if (store.handleApiError(e, { openBind: true })) {
      return
    }
    tasks.value = []
    total.value = 0
    loadError.value = e?.msg || '任务加载失败，请稍后重试。'
  } finally {
    if (listRequest.isLatest(seq)) {
      loading.value = false
    }
  }
}

async function loadReleaseTime() {
  try {
    const res = await studyAutoReserveApi.setting()
    releaseTime.value = clockOf(res?.data?.releaseTime) || ''
    signInEnable.value = Number(res?.data?.signInEnable) === 1 ? 1 : 0
  } catch (e) {
    releaseTime.value = ''
    signInEnable.value = 0
  }
}

function reloadAll() {
  if (!store.requireToken()) {
    return
  }
  loadTasks()
  loadReleaseTime()
}

function onPageChange(page) {
  pageNum.value = page
  loadTasks()
}

/* ---------- 任务操作 ---------- */
async function executeTask(task) {
  if (!store.requireToken()) {
    return
  }
  if (!isEnabled(task)) {
    ElMessage.warning('任务已暂停，请先恢复')
    return
  }
  try {
    await ElMessageBox.confirm(
      '立即执行会马上发起一次抢座，最长约 1 分钟，结果写入执行记录。确定继续？',
      '立即执行',
      { confirmButtonText: '开始抢座', cancelButtonText: '取消', type: 'warning', customClass: 'sr-message-box' }
    )
  } catch (e) {
    return
  }

  executingId.value = task.id
  try {
    await studyAutoReserveApi.executeTask(task.id)
    ElMessage.success('已执行，可在「执行记录」查看结果')
    await loadTasks({ quiet: true })
    if (recordsVisible.value && recordsTask.value?.id === task.id) {
      recordDialogRef.value?.refresh()
    }
  } catch (e) {
    store.handleApiError(e, { openBind: true })
  } finally {
    executingId.value = null
  }
}

async function toggleTask(task) {
  if (!store.requireToken()) {
    return
  }
  actionLoadingId.value = task.id
  try {
    if (isEnabled(task)) {
      await studyAutoReserveApi.pauseTask(task.id)
      ElMessage.success('任务已暂停')
    } else {
      await studyAutoReserveApi.resumeTask(task.id)
      ElMessage.success('任务已恢复')
    }
    await loadTasks({ quiet: true })
  } catch (e) {
    store.handleApiError(e, { openBind: true })
  } finally {
    actionLoadingId.value = null
  }
}

async function removeTask(task) {
  try {
    await ElMessageBox.confirm(
      `删除后「${task.venueName || '该门店'}」的任务及全部执行记录会一并删除，且无法恢复。`,
      '删除任务',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning', customClass: 'sr-message-box' }
    )
  } catch (e) {
    return
  }

  try {
    await studyAutoReserveApi.removeTask(task.id)
    ElMessage.success('任务已删除')
    if (recordsTask.value?.id === task.id) {
      recordsVisible.value = false
      recordsTask.value = null
    }
    await loadTasks()
  } catch (e) {
    store.handleApiError(e, { openBind: true })
  }
}

function onTaskCommand(command, task) {
  if (command === 'edit') {
    openEdit(task)
  } else if (command === 'delete') {
    removeTask(task)
  }
}

/* ---------- 弹窗 ---------- */
function openCreate() {
  if (!store.requireToken()) {
    return
  }
  editingTask.value = null
  formVisible.value = true
}

function openEdit(task) {
  editingTask.value = task
  formVisible.value = true
}

async function onTaskSaved() {
  await loadTasks()
  loadReleaseTime()
}

function openRecords(task) {
  recordsTask.value = task
  recordsVisible.value = true
}

function goSetting() {
  router.push(PAGE_PATH.AUTO_RESERVE_SETTING)
}

useStudyRefresh(() => {
  pageNum.value = 1
  loadTasks()
  loadReleaseTime()
})

onMounted(() => {
  store.ensureStatus()
})
</script>

<style lang="scss" scoped>
.auto-reserve-page {
  min-width: 0;
}

.ar-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 16px;

  .el-icon {
    flex: none;
    margin-top: 1px;
    color: var(--sr-green-2);
    font-size: 14px;
  }

  strong {
    font-weight: 600;
    color: var(--sr-green-ink);
  }
}

.ar-list {
  min-height: 220px;
}

.ar-task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  min-width: 0;
}

.ar-feedback .sr-empty {
  padding: 44px 18px;
}

.ar-empty-hint {
  margin: 0;
  color: var(--sr-muted);
  font-size: 12px;
}

.ar-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 900px) {
  .ar-task-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
