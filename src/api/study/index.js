import request from '@/utils/study/request'

/**
 * 自习室 - 小程序账号 token
 */
export const studyTokenApi = {
  detail: () => request.get('/business/study/token/detail'),
  bind: token => request.post('/business/study/token/bind', { token }),
  unbind: () => request.delete('/business/study/token/unbind')
}

/**
 * 自习室 - 全局配置与公告
 */
export const studyConfigApi = {
  sys: () => request.get('/business/study/config/sys'),
  notice: venueId => request.get('/business/study/config/notice', { params: { venueId } })
}

/**
 * 自习室 - 小程序用户
 */
export const studyUserApi = {
  index: () => request.get('/business/study/user/index'),
  detail: () => request.get('/business/study/user/detail'),
  fee: () => request.get('/business/study/user/fee'),
  updateInfo: data => request.post('/business/study/user/update-info', data),
  authorizeHeadImg: data => request.post('/business/study/user/authorize/head-img', data),
  cancelAuthorize: () => request.post('/business/study/user/authorize/cancel'),
  signList: id => request.get('/business/study/user/sign/list', { params: { id } }),
  signListMore: () => request.get('/business/study/user/sign/list/more')
}

/**
 * 自习室 - 门店
 */
export const studyVenueApi = {
  select: (currentLng, currentLat) =>
    request.get('/business/study/venue/select', { params: { currentLng, currentLat } }),
  reserveSelect: () => request.get('/business/study/venue/reserve/select'),
  reserveDetail: venueId => request.get('/business/study/venue/reserve/detail', { params: { venueId } }),
  reserveIndex: params => request.get('/business/study/venue/reserve/index', { params }),
  reserveAreaSelect: () => request.get('/business/study/venue/reserve/area/select'),
  receiptSelect: (currentLng, currentLat) =>
    request.get('/business/study/venue/receipt/select', { params: { currentLng, currentLat } }),
  douyinSelect: (currentLng, currentLat) =>
    request.get('/business/study/venue/douyin/select', { params: { currentLng, currentLat } })
}

/**
 * 自习室 - 预约
 */
export const studyReserveApi = {
  check: () => request.get('/business/study/reserve/check'),
  dateSelect: venueId => request.get('/business/study/reserve/v2/date/select', { params: { venueId } }),
  seatList: data => request.post('/business/study/reserve/v2/seat/list', data),
  seatConfirm: data => request.post('/business/study/reserve/v2/seat/confirm', data),
  anotherCheck: userReserveId =>
    request.get('/business/study/reserve/another/check', { params: { userReserveId } }),
  userList: () => request.get('/business/study/reserve/user/list'),
  cancelTip: userReserveId =>
    request.get('/business/study/reserve/user/cancel/tip', { params: { userReserveId } }),
  cancel: userReserveId => request.post('/business/study/reserve/user/cancel', { userReserveId })
}

/**
 * 自习室 - 自动预约
 */
export const studyAutoReserveApi = {
  taskList: params => request.get('/business/study/auto-reserve/task/list', { params }),
  taskDetail: id => request.get('/business/study/auto-reserve/task/' + id),
  createTask: data => request.post('/business/study/auto-reserve/task', data),
  updateTask: (id, data) => request.put('/business/study/auto-reserve/task/' + id, data),
  removeTask: id => request.delete('/business/study/auto-reserve/task/' + id),
  pauseTask: id => request.post('/business/study/auto-reserve/task/' + id + '/pause'),
  resumeTask: id => request.post('/business/study/auto-reserve/task/' + id + '/resume'),
  // 立即执行会在服务端同步抢座，最长约 1 分钟，单独放宽超时
  executeTask: id => request.post('/business/study/auto-reserve/task/' + id + '/execute', null, { timeout: 90000 }),
  recordList: (taskId, params) =>
    request.get('/business/study/auto-reserve/task/record/' + taskId, { params }),
  setting: () => request.get('/business/study/auto-reserve/setting/'),
  updateSetting: data => request.put('/business/study/auto-reserve/setting/', data)
}

/**
 * 自习室 - 签到 / 在座
 */
export const studySignApi = {
  index: params => request.get('/business/study/sign/index', { params }),
  seatList: data => request.post('/business/study/sign/seat/list', data),
  seatConfirm: data => request.post('/business/study/sign/seat/confirm', data),
  changeSeatList: data => request.post('/business/study/sign/change/seat/list', data),
  changeSeatConfirm: data => request.post('/business/study/sign/change/seat/confirm', data),
  settlePackageSelect: data => request.post('/business/study/sign/settle-package/select', data),
  anotherCheck: venueId => request.get('/business/study/sign/another/check', { params: { venueId } }),
  signOut: data => request.post('/business/study/sign/out', data),
  rank: data => request.post('/business/study/sign/rank/index', data),
  settlement: data => request.post('/business/study/sign/settlement', data),
  userPackageConfirm: data => request.post('/business/study/sign/user-package/confirm', data),
  espLightTurn: data => request.post('/business/study/sign/esp-light/turn', data)
}

/**
 * 自习室 - 门禁
 */
export const studyGuardApi = {
  select: venueId => request.get('/business/study/guard/select', { params: { venueId } }),
  open: guardId => request.post('/business/study/guard/open', { guardId })
}

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

/**
 * 自习室 - 请假
 */
export const studyLeaveApi = {
  enter: userPackageId =>
    request.get('/business/study/leave/enter', { params: { userPackageId } }),
  confirm: data => request.post('/business/study/leave/confirm', data),
  cancel: userLeaveId => request.post('/business/study/leave/cancel', { userLeaveId })
}

/**
 * 自习室 - 报修
 */
export const studyRepairApi = {
  submit: data => request.post('/business/study/repair/submit', data),
  list: () => request.get('/business/study/repair/list'),
  detail: id => request.get('/business/study/repair/detail/' + id)
}

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
