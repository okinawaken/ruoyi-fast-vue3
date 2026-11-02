import request from '@/utils/study/request'

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
