<template>
  <section class="sr-card account-card" v-loading="loading || profileLoading">
    <div class="account-top">
      <div class="account-identity">
        <div class="account-avatar" aria-hidden="true">
          <img v-if="headImg && !avatarFailed" :src="headImg" alt="" @error="avatarFailed = true" />
          <span v-else>{{ avatarText }}</span>
        </div>
        <div class="account-main">
          <div class="account-name-row">
            <h2 class="account-name">{{ displayName }}</h2>
            <span class="sr-chip" :class="feeOwed ? 'sr-chip-danger' : 'sr-chip-green'">
              <span class="sr-dot"></span>{{ feeOwed ? '有欠费' : '账号正常' }}
            </span>
            <span class="sr-chip" :class="store.isTokenValid ? 'sr-chip-green' : 'sr-chip-amber'">
              <span class="sr-dot"></span>{{ store.isTokenValid ? '已绑定' : 'token 失效' }}
            </span>
          </div>
          <p class="account-meta">
            <span v-if="mobileText">手机号 {{ mobileText }}</span>
            <span v-if="mobileText && detail?.memberCardNo" class="account-sep">·</span>
            <span v-if="detail?.memberCardNo">会员卡 {{ detail.memberCardNo }}</span>
            <span v-if="!mobileText && !detail?.memberCardNo">资料待同步</span>
          </p>
          <p v-if="detail?.studyFirstDate || detail?.userSysCode" class="account-meta">
            <span v-if="detail?.studyFirstDate">首次学习 {{ detail.studyFirstDate }}</span>
            <span v-if="detail?.studyFirstDate && detail?.userSysCode" class="account-sep">·</span>
            <span v-if="detail?.userSysCode">编号 {{ detail.userSysCode }}</span>
          </p>
          <p class="account-note">数据更新于 {{ updatedAt }}</p>
        </div>
      </div>

      <div class="account-actions">
        <el-button type="danger" text @click="store.openBindModal()">重新绑定</el-button>
        <el-button type="danger" text @click="confirmCancelAuthorize">解除授权</el-button>
        <el-button type="danger" text @click="confirmUnbind">解绑</el-button>
      </div>
    </div>

    <div class="account-stats">
      <div class="account-stat">
        <span class="account-stat-label">累计签到</span>
        <strong class="account-stat-value">
          <span class="sr-mono">{{ signTotalNum }}</span><em>次</em>
        </strong>
        <span class="account-stat-note">自开通账号起</span>
      </div>

      <div class="account-stat">
        <span class="account-stat-label">累计学习</span>
        <strong class="account-stat-value">
          <template v-if="studyParts.length">
            <template v-for="(part, index) in studyParts" :key="index">
              <span class="sr-mono">{{ part.text }}</span><em v-if="part.unit">{{ part.unit }}</em>
            </template>
          </template>
          <span v-else class="sr-mono">—</span>
        </strong>
        <span class="account-stat-note">来自小程序学习时长</span>
      </div>

      <div class="account-stat">
        <span class="account-stat-label">进行中预约</span>
        <strong class="account-stat-value">
          <span class="sr-mono">{{ reserveCount }}</span><em>个</em>
        </strong>
        <span class="account-stat-note">{{ reserveNote }}</span>
      </div>
    </div>

    <slot name="seat"></slot>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import useStudyStore from '@/store/modules/study'
import { studyUserApi } from '@/api/study'
import { maskMobile } from '@/utils/study/format'

const props = defineProps({
  user: { type: Object, default: null },
  detail: { type: Object, default: null },
  fee: { type: Object, default: null },
  reserveCount: { type: Number, default: 0 },
  reserveNote: { type: String, default: '' },
  updatedAt: { type: String, default: '--:--' },
  loading: { type: Boolean, default: false },
  profileLoading: { type: Boolean, default: false }
})

const store = useStudyStore()
const avatarFailed = ref(false)

const displayName = computed(
  () => props.detail?.nickName || props.detail?.userName || props.user?.nickName || props.user?.userName || '未命名用户'
)

const headImg = computed(() => props.detail?.headImg || props.user?.headImg || '')

const avatarText = computed(() => {
  const name = displayName.value || ''
  return Array.from(name)[0] || '·'
})

const mobileText = computed(() => maskMobile(props.detail?.mobile || props.user?.mobile))

const feeOwed = computed(() => Number(props.fee?.hasOwnFee) === 1)

const signTotalNum = computed(() => {
  const value = Number(props.user?.signTotalNum)
  return Number.isFinite(value) ? value : 0
})

const studyParts = computed(() => {
  const text = props.user?.studyTotalTimeStr
  if (!text) {
    return []
  }
  const match = String(text).match(/(\d+)\s*小时\s*(\d+)\s*分/)
  if (!match) {
    return [{ text: String(text), unit: '' }]
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const parts = []
  if (hours > 0) {
    parts.push({ text: String(hours), unit: '小时' })
  }
  if (minutes > 0 || hours === 0) {
    parts.push({ text: String(minutes), unit: '分' })
  }
  return parts
})

watch(
  () => headImg.value,
  () => {
    avatarFailed.value = false
  }
)

/* ---------------- 账号操作 ---------------- */

function confirmCancelAuthorize() {
  ElMessageBox.confirm('解除授权后将退出小程序登录态，需要重新绑定 token 才能继续使用。', '解除授权', {
    confirmButtonText: '确认解除',
    cancelButtonText: '取消',
    type: 'warning',
    customClass: 'sr-message-box'
  })
    .then(async () => {
      try {
        await studyUserApi.cancelAuthorize()
        ElMessage.success('已解除授权')
        await store.fetchStatus()
        store.refreshKey += 1
      } catch (e) {
        store.handleApiError(e)
      }
    })
    .catch(() => {})
}

function confirmUnbind() {
  ElMessageBox.confirm('解绑后需要重新绑定 token 才能查看数据与预约座位，当前页面的数据会立即隐藏。', '解绑小程序账号', {
    confirmButtonText: '确认解绑',
    cancelButtonText: '取消',
    type: 'warning',
    customClass: 'sr-message-box'
  })
    .then(async () => {
      try {
        await store.unbindToken()
        ElMessage.success('已解绑小程序账号')
      } catch (e) {
        if (store.handleApiError(e)) {
          return
        }
      }
    })
    .catch(() => {})
}
</script>

<style lang="scss" scoped>
.account-card {
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(228, 237, 230, 0.55), transparent 46%), var(--sr-card);
  box-shadow: 0 6px 24px rgba(27, 42, 36, 0.05);
}

.account-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  min-width: 0;
}

.account-identity {
  display: flex;
  align-items: center;
  gap: 15px;
  min-width: 0;
}

.account-avatar {
  display: grid;
  place-items: center;
  width: 66px;
  height: 66px;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--sr-green-3), var(--sr-green));
  color: var(--sr-paper);
  font-family: var(--sr-font-display);
  font-size: 25px;
  font-weight: 700;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 4px 14px rgba(27, 42, 36, 0.15);
  flex: none;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.account-main {
  min-width: 0;
}

.account-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.account-name {
  margin: 0;
  font-family: var(--sr-font-display);
  font-size: 23px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--sr-ink);
  overflow-wrap: anywhere;
}

.account-meta {
  margin: 4px 0 0;
  color: var(--sr-muted);
  font-size: 12.5px;
  overflow-wrap: anywhere;
}

.account-sep {
  margin: 0 5px;
  color: var(--sr-muted-2);
}

.account-note {
  margin: 3px 0 0;
  color: var(--sr-muted-2);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.account-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  flex: none;
}

.account-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 20px;
  border-top: 1px solid var(--sr-line);
  border-bottom: 1px solid var(--sr-line);
}

.account-stat {
  min-width: 0;
  padding: 14px 18px;
}

.account-stat + .account-stat {
  border-left: 1px solid var(--sr-line);
}

.account-stat-label {
  display: block;
  margin-bottom: 3px;
  color: var(--sr-muted);
  font-size: 10.5px;
  letter-spacing: 0.06em;
}

.account-stat-value {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 5px;
  font-family: var(--sr-font-mono);
  font-size: 25px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--sr-ink);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;

  em {
    color: var(--sr-muted);
    font-family: inherit;
    font-size: 11.5px;
    font-style: normal;
    font-weight: 400;
    letter-spacing: 0;
  }
}

.account-stat-note {
  display: block;
  margin-top: 3px;
  color: var(--sr-muted-2);
  font-size: 10.5px;
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  .account-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .account-card {
    padding: 16px;
  }

  .account-avatar {
    width: 54px;
    height: 54px;
    font-size: 21px;
  }

  .account-name {
    font-size: 20px;
  }

  .account-stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .account-stat {
    padding: 11px 2px;
  }

  .account-stat + .account-stat {
    border-left: 0;
    border-top: 1px solid var(--sr-line);
  }

  .account-stat-value {
    font-size: 21px;
  }

  .account-actions :deep(.el-button) {
    flex: 1 1 auto;
  }
}
</style>
