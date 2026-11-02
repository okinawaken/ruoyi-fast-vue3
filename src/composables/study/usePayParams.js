import { computed } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 支付参数展示与复制。
 *
 * @param {import('vue').Ref<object|null>} payParams 后端返回的支付参数
 */
export function usePayParams(payParams) {
  const payParamsText = computed(() => (payParams.value ? JSON.stringify(payParams.value, null, 2) : ''))

  async function copyPayParams() {
    if (!payParamsText.value) {
      ElMessage.warning('请先获取支付参数')
      return
    }
    try {
      await navigator.clipboard.writeText(payParamsText.value)
      ElMessage.success('支付参数已复制')
    } catch (e) {
      ElMessage.warning('当前浏览器不支持自动复制，请手动选择复制')
    }
  }

  return { payParamsText, copyPayParams }
}
