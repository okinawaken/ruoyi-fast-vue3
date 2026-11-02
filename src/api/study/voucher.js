import request from '@/utils/study/request'

/**
 * 自习室 - 团购券核销
 */
export const studyVoucherApi = {
  receiptConsume: data => request.post('/business/study/misc/receipt/consume', data),
  douyinVerify: data => request.post('/business/study/misc/douyin/verify', data)
}
