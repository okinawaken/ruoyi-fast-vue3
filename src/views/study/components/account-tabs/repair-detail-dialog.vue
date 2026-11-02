<template>
  <el-dialog
    :model-value="visible"
    class="sr-dialog"
    title="报修详情"
    width="480px"
    @update:model-value="value => emit('update:visible', value)"
  >
    <div v-loading="loading" class="form-body">
      <template v-if="repairDetail">
        <div class="sr-kv"><span class="sr-kv-key">门店</span><span class="sr-kv-value">{{ repairDetail.venueName || '—' }}</span></div>
        <div class="sr-kv"><span class="sr-kv-key">状态</span><span class="sr-kv-value">{{ Number(repairDetail.handleState) === 1 ? '已处理' : '处理中' }}</span></div>
        <div class="sr-kv"><span class="sr-kv-key">提交时间</span><span class="sr-kv-value">{{ repairDetail.createTimeStr || '—' }}</span></div>
        <div class="sr-kv"><span class="sr-kv-key">处理时间</span><span class="sr-kv-value">{{ repairDetail.handleTimeStr || '—' }}</span></div>
        <p class="repair-detail-desc">{{ repairDetail.repairDesc || '—' }}</p>
        <p v-if="repairDetail.handleRemark" class="repair-detail-remark">处理备注：{{ repairDetail.handleRemark }}</p>
        <div v-if="repairDetail.repairImgList?.length" class="repair-imgs">
          <img v-for="(img, index) in repairDetail.repairImgList" :key="index" :src="img" alt="" />
        </div>
      </template>
      <div v-else-if="!loading" class="sr-empty">
        <el-empty description="报修详情加载失败" />
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { studyRepairApi } from '@/api/study/repair'
import useStudyStore from '@/store/modules/study'
import { useLatestRequest } from '@/composables/study/useLatestRequest'

const props = defineProps({
  visible: { type: Boolean, default: false },
  repairId: { type: [String, Number], default: null }
})

const emit = defineEmits(['update:visible'])

const store = useStudyStore()

const loading = ref(false)
const repairDetail = ref(null)
const detailRequest = useLatestRequest()

async function loadDetail(id) {
  const seq = detailRequest.next()
  loading.value = true
  repairDetail.value = null
  try {
    const res = await studyRepairApi.detail(id)
    if (!detailRequest.isLatest(seq)) {
      return
    }
    repairDetail.value = res?.data || null
  } catch (e) {
    if (!detailRequest.isLatest(seq)) {
      return
    }
    repairDetail.value = null
    store.handleApiError(e)
  } finally {
    if (detailRequest.isLatest(seq)) {
      loading.value = false
    }
  }
}

watch(
  () => props.visible,
  visible => {
    if (!visible) {
      detailRequest.invalidate()
      return
    }
    repairDetail.value = null
    if (props.repairId !== null && props.repairId !== undefined) {
      loadDetail(props.repairId)
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.form-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.repair-detail-desc {
  margin: 12px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--sr-line);
  border-radius: 9px;
  background: var(--sr-card-2);
  color: var(--sr-ink-2);
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.repair-detail-remark {
  margin: 10px 0 0;
  color: var(--sr-muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.repair-imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;

  img {
    width: 84px;
    height: 84px;
    border-radius: 8px;
    object-fit: cover;
    border: 1px solid var(--sr-line);
  }
}
</style>
