import request from '@/utils/study/request'

/**
 * 自习室 - 储物柜 / 券核销
 */
export const studyMiscApi = {
  cabinetLeaseOrderList: () => request.post('/business/study/misc/cabinet/lease/order/list'),
  cabinetLeasePay: (leaseId, userId) =>
    request.post('/business/study/misc/cabinet/lease/pay', null, { params: { leaseId, userId } }),
  cabinetLeaseCommit: data => request.post('/business/study/misc/cabinet/lease/commit', data),
  cabinetLeaseOverduePay: (leaseId, userCode) =>
    request.post('/business/study/misc/cabinet/lease/overdue/pay', null, { params: { leaseId, userCode } }),
  cabinetLeaseAutoCheckout: lastLeaseId =>
    request.get('/business/study/misc/cabinet/lease/auto-checkout', { params: { lastLeaseId } }),
  cabinetWifiOpen: gripId => request.post('/business/study/misc/cabinet/wifi/open', { gripId }),
  cabinetVenueList: venueId =>
    request.get('/business/study/misc/cabinet/venue/list', { params: { venueId } }),
  cabinetGridList: cabinetId =>
    request.get('/business/study/misc/cabinet/grid/list', { params: { cabinetId } }),
  cabinetUserGridList: venueId =>
    request.get('/business/study/misc/cabinet/user/grid/list', { params: { venueId } }),
  cabinetGridPrice: gridId =>
    request.get('/business/study/misc/cabinet/grid/price', { params: { gridId } }),
  receiptConsume: data => request.post('/business/study/misc/receipt/consume', data),
  douyinVerify: data => request.post('/business/study/misc/douyin/verify', data)
}
