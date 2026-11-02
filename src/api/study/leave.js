import request from '@/utils/study/request'

/**
 * 自习室 - 请假
 */
export const studyLeaveApi = {
  enter: userPackageId =>
    request.get('/business/study/leave/enter', { params: { userPackageId } }),
  confirm: data => request.post('/business/study/leave/confirm', data),
  cancel: userLeaveId => request.post('/business/study/leave/cancel', { userLeaveId })
}
