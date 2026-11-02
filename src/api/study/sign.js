import request from '@/utils/study/request'

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
