import request from '@/utils/study/request'

/**
 * 自习室 - 储物柜
 */
export const studyCabinetApi = {
  leaseOrderList: () => request.post('/business/study/misc/cabinet/lease/order/list'),
  leasePay: (leaseId, userId) =>
    request.post('/business/study/misc/cabinet/lease/pay', null, { params: { leaseId, userId } }),
  leaseCommit: data => request.post('/business/study/misc/cabinet/lease/commit', data),
  leaseOverduePay: (leaseId, userCode) =>
    request.post('/business/study/misc/cabinet/lease/overdue/pay', null, { params: { leaseId, userCode } }),
  leaseAutoCheckout: lastLeaseId =>
    request.get('/business/study/misc/cabinet/lease/auto-checkout', { params: { lastLeaseId } }),
  wifiOpen: gripId => request.post('/business/study/misc/cabinet/wifi/open', { gripId }),
  venueList: venueId =>
    request.get('/business/study/misc/cabinet/venue/list', { params: { venueId } }),
  gridList: cabinetId =>
    request.get('/business/study/misc/cabinet/grid/list', { params: { cabinetId } }),
  userGridList: venueId =>
    request.get('/business/study/misc/cabinet/user/grid/list', { params: { venueId } }),
  gridPrice: gridId =>
    request.get('/business/study/misc/cabinet/grid/price', { params: { gridId } })
}
