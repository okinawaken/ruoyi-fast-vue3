<template>
  <section class="sr-bind-gate" aria-labelledby="sr-bind-gate-title">
    <div class="sr-card sr-gate-card">
      <div class="sr-gate-icon" aria-hidden="true">
        <el-icon><Lock /></el-icon>
      </div>

      <h2 id="sr-bind-gate-title" class="sr-gate-title">先绑定小程序 token</h2>
      <p class="sr-gate-desc">
        个人信息、预约与签到记录都通过你的自习室小程序账号读取。一个账号只能绑定一个 token。
      </p>

      <ol class="sr-gate-steps">
        <li class="sr-gate-step">
          <span class="sr-step-n" aria-hidden="true">1</span>
          <span>打开「时不我待自习馆」小程序，完成登录。</span>
        </li>
        <li class="sr-gate-step">
          <span class="sr-step-n" aria-hidden="true">2</span>
          <span>复制登录态中的小程序 token（形如 <code>eyJ0eXAi…</code>）。</span>
        </li>
        <li class="sr-gate-step">
          <span class="sr-step-n" aria-hidden="true">3</span>
          <span>粘贴到下方输入框，绑定后即可查看数据与预约座位。</span>
        </li>
      </ol>

      <form class="sr-gate-form" novalidate @submit.prevent="submit">
        <div class="sr-gate-field">
          <label for="sr-gate-token" class="sr-gate-label">小程序 token</label>
          <el-input
            id="sr-gate-token"
            ref="inputRef"
            v-model="token"
            type="password"
            autocomplete="off"
            spellcheck="false"
            placeholder="粘贴小程序 token（JWT）"
            clearable
            :disabled="submitting"
            :aria-invalid="error ? 'true' : 'false'"
            :aria-describedby="error ? 'sr-gate-error' : undefined"
            @blur="validateOnBlur"
            @input="clearError"
          />
        </div>
        <el-button class="sr-gate-submit" type="primary" native-type="submit" :loading="submitting" :disabled="submitting">
          绑定 token
        </el-button>
      </form>

      <p v-if="error" id="sr-gate-error" class="sr-gate-error" role="alert">{{ error }}</p>

      <div class="sr-gate-note">
        token 仅保存在服务端，用于代你调用小程序接口；本页面不会再次显示 token 原文。重新绑定会替换当前 token。
      </div>

      <details class="sr-gate-details">
        <summary>如何获取 token？</summary>
        <p>
          登录小程序后，用抓包工具查看发往 <code>mini.winsalesaas.com</code> 的请求，复制请求头里的
          <code>token</code> 字段。token 是一段以 <code>eyJ</code> 开头的 JWT。
        </p>
      </details>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import useStudyStore from '@/store/modules/study'

const store = useStudyStore()

const token = ref('')
const error = ref('')
const submitting = ref(false)
const inputRef = ref()

function clearError() {
  if (error.value) {
    error.value = ''
  }
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

function validateOnBlur() {
  const value = token.value.trim()
  if (value) {
    validate(value)
  }
}

function readErrorMessage(e) {
  return e?.msg || e?.message || '绑定失败，请稍后重试'
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
.sr-bind-gate {
  max-width: 580px;
  margin: 48px auto 24px;
}

.sr-gate-card {
  padding: 28px;
}

.sr-gate-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1px solid var(--sr-green-line);
  border-radius: 14px;
  background: var(--sr-green-soft);
  color: var(--sr-green);
  font-size: 22px;
}

.sr-gate-title {
  margin: 16px 0 6px;
  font-family: var(--sr-font-display);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--sr-ink);
}

.sr-gate-desc {
  margin: 0;
  color: var(--sr-muted);
  font-size: 12.5px;
  line-height: 1.6;
}

.sr-gate-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 20px 0;
  padding: 0;
  list-style: none;
}

.sr-gate-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--sr-ink-2);
  font-size: 12px;
  line-height: 1.55;
}

.sr-step-n {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--sr-line-strong);
  border-radius: 50%;
  background: var(--sr-paper-2);
  color: var(--sr-green);
  font-family: var(--sr-font-mono);
  font-size: 10px;
  flex: none;
}

code {
  padding: 1px 4px;
  border: 1px solid var(--sr-line);
  border-radius: 4px;
  background: var(--sr-paper-2);
  color: var(--sr-ink-2);
  font-family: var(--sr-font-mono);
  font-size: 10.5px;
}

.sr-gate-form {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.sr-gate-field {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.sr-gate-label {
  color: var(--sr-ink-2);
  font-size: 11.5px;
  font-weight: 500;
}

.sr-gate-submit {
  flex: none;
}

.sr-gate-error {
  margin: 6px 0 0;
  color: var(--sr-danger);
  font-size: 11.5px;
  line-height: 1.5;
}

.sr-gate-note {
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid var(--sr-line);
  border-radius: 9px;
  background: var(--sr-card-2);
  color: var(--sr-muted);
  font-size: 10.5px;
  line-height: 1.6;
}

.sr-gate-details {
  margin-top: 14px;
  color: var(--sr-muted);
  font-size: 11px;

  summary {
    width: fit-content;
    color: var(--sr-green-ink);
    font-weight: 500;
    cursor: pointer;
  }

  p {
    margin: 7px 0 0;
    line-height: 1.65;
  }
}

@media (max-width: 640px) {
  .sr-bind-gate {
    margin: 24px auto 12px;
  }

  .sr-gate-card {
    padding: 20px;
  }

  .sr-gate-title {
    font-size: 21px;
  }

  .sr-gate-form {
    flex-direction: column;
    align-items: stretch;
  }

  .sr-gate-submit {
    width: 100%;
  }
}
</style>
