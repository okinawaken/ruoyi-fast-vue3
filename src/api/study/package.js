import request from '@/utils/study/request'

/**
 * 自习室 - 套餐
 */
export const studyPackageApi = {
  list: () => request.get('/business/study/package/list'),
  v2List: data => request.post('/business/study/package/v2/list', data),
  v2OptList: (currentLng, currentLat) =>
    request.get('/business/study/package/v2/opt-list', { params: { currentLng, currentLat } }),
  v2LabelList: venueId =>
    request.get('/business/study/package/v2/label/select-list', { params: { venueId } }),
  v2Detail: packageId => request.get('/business/study/package/v2/detail/' + packageId),
  confirm: data => request.post('/business/study/package/confirm', data),
  v2Confirm: data => request.post('/business/study/package/v2/confirm', data),
  payOrder: data => request.post('/business/study/package/pay-order', data),
  userOrderList: () => request.get('/business/study/package/user/order/list'),
  userPackageList: () => request.get('/business/study/package/user/package/list'),
  wxQueryStatus: payId => request.post('/business/study/package/wx/query/status/' + payId)
}
