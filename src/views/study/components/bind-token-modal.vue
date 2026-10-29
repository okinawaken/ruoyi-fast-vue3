<template>
  <el-dialog
    v-model="visible"
    class="sr-dialog"
    title="绑定小程序 token"
    width="440px"
    :close-on-click-modal="false"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
    destroy-on-close
    @opened="focusInput"
  >
    <form class="sr-bind-modal" novalidate @submit.prevent="submit">
      <label for="sr-bind-modal-token" class="sr-modal-label">小程序 token</label>
      <el-input
        id="sr-bind-modal-token"
        ref="inputRef"
        v-model="token"
        type="password"
        autocomplete="off"
        spellcheck="false"
        placeholder="粘贴以 eyJ 开头的 JWT"
        clearable
        :disabled="submitting"
        :aria-invalid="error ? 'true' : 'false'"
        :aria-describedby="error ? 'sr-bind-modal-error sr-bind-modal-hint' : 'sr-bind-modal-hint'"
        @input="clearError"
      />
      <p id="sr-bind-modal-hint" class="sr-modal-hint">输入框会遮蔽内容，绑定成功后立即清空，不会再次回显。</p>
      <p v-if="error" id="sr-bind-modal-error" class="sr-modal-error" role="alert">{{ error }}</p>

      <div class="sr-modal-warning" role="note">
        绑定新 token 会替换当前账号，旧 token 立即失效。
      </div>

      <div class="sr-modal-actions">
        <el-button :disabled="submitting" @click="cancel">取消</el-button>
        <el-button type="primary" native-type="submit" :loading="submitting" :disabled="submitting">确认绑定</el-button>
      </div>
    </form>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import useStudyStore from '@/store/modules/study'

const store = useStudyStore()

const token = ref('')
const error = ref('')
const submitting = ref(false)
const inputRef = ref()

const visible = computed({
  get: () => store.bindModalVisible,
  set: value => {
    if (!value && !submitting.value) {
      store.closeBindModal()
    }
  }
})

watch(
  () => store.bindModalVisible,
  open => {
    if (open) {
      token.value = ''
      error.value = ''
    }
  }
)

function clearError() {
  if (error.value) {
    error.value = ''
  }
}

function focusInput() {
  nextTick(() => inputRef.value?.focus?.())
}

function validate(value) {
  if (!value) {
    error.value = 'token 不能为空'
    return false
  }
  if (!value.startsWith('eyJ')) {
    error.value = 'token 格式不正确，应以 eyJ 开头。'
    return false
  }
  return true
}

function readErrorMessage(e) {
  return e?.msg || e?.message || '绑定失败，请稍后重试'
}

function cancel() {
  if (submitting.value) {
    return
  }
  store.closeBindModal()
}

async function submit() {
  if (submitting.value) {
    return
  }
  error.value = ''
  const value = token.value.trim()
  if (!validate(value)) {
    inputRef.value?.focus?.()
    return
  }

  submitting.value = true
  try {
    await store.bindToken(value)
    token.value = ''
    store.closeBindModal()
    ElMessage.success('绑定成功')
  } catch (e) {
    error.value = readErrorMessage(e)
    inputRef.value?.focus?.()
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.sr-bind-modal {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sr-modal-label {
  color: #2a3a32;
  font-size: 12px;
  font-weight: 600;
}

.sr-modal-hint {
  margin: 0;
  color: #75827a;
  font-size: 11px;
  line-height: 1.6;
}

.sr-modal-error {
  margin: 0;
  color: #a64035;
  font-size: 11.5px;
  line-height: 1.5;
}

.sr-modal-warning {
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #e7c98f;
  border-radius: 9px;
  background: #fbf0dc;
  color: #6b4a12;
  font-size: 11.5px;
  line-height: 1.6;
}

.sr-modal-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}

@media (max-width: 640px) {
  .sr-modal-actions :deep(.el-button) {
    flex: 1 1 auto;
  }
}
</style>
