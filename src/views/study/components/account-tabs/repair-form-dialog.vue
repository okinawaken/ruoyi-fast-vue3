<template>
  <el-dialog
    :model-value="visible"
    class="sr-dialog"
    title="提交报修"
    width="480px"
    :close-on-click-modal="false"
    @update:model-value="value => emit('update:visible', value)"
  >
    <div class="form-body">
      <div class="form-field">
        <label class="sr-field-label" for="repairVenue">门店</label>
        <el-select id="repairVenue" v-model="form.venueId" placeholder="请选择门店" filterable style="width: 100%">
          <el-option v-for="venue in venues" :key="venue.id" :label="venue.venueName" :value="venue.id" />
        </el-select>
      </div>
      <div class="form-field">
        <label class="sr-field-label" for="repairDesc">问题描述</label>
        <el-input id="repairDesc" v-model="form.repairDesc" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="请描述遇到的问题" />
      </div>
      <div class="form-field">
        <label class="sr-field-label" for="repairImgs">图片地址（可选，每行一个）</label>
        <el-input id="repairImgs" v-model="form.imageText" type="textarea" :rows="2" placeholder="当前不支持上传，可填写图片 URL" />
      </div>
      <div class="sr-dialog-note">提交后门店会收到报修工单，处理进度可在「报修」中查看。</div>
      <div class="sr-dialog-foot form-actions">
        <el-button :disabled="submitting" @click="emit('update:visible', false)">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitRepair">提交</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { studyRepairApi } from '@/api/study'
import useStudyStore from '@/store/modules/study'

const props = defineProps({
  visible: { type: Boolean, default: false },
  venues: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:visible', 'submitted'])

const store = useStudyStore()

const submitting = ref(false)
const form = reactive({ venueId: null, repairDesc: '', imageText: '' })

function resetForm() {
  form.venueId = null
  form.repairDesc = ''
  form.imageText = ''
}

async function submitRepair() {
  if (submitting.value) {
    return
  }
  if (!form.venueId) {
    ElMessage.warning('请选择门店')
    return
  }
  if (!form.repairDesc.trim()) {
    ElMessage.warning('请填写问题描述')
    return
  }
  const images = form.imageText
    .split(/[\n,，]/)
    .map(item => item.trim())
    .filter(Boolean)

  submitting.value = true
  try {
    await studyRepairApi.submit({
      venueId: form.venueId,
      repairDesc: form.repairDesc.trim(),
      repairImgList: images.length ? images : undefined
    })
    ElMessage.success('报修已提交')
    emit('update:visible', false)
    emit('submitted')
  } catch (e) {
    store.handleApiError(e)
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.visible,
  visible => {
    if (visible) {
      resetForm()
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

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.form-field :deep(.el-select) {
  width: 100%;
}

.form-actions {
  margin-top: 18px;
}
</style>
