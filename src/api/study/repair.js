import request from '@/utils/study/request'

/**
 * 自习室 - 报修
 */
export const studyRepairApi = {
  submit: data => request.post('/business/study/repair/submit', data),
  list: () => request.get('/business/study/repair/list'),
  detail: id => request.get('/business/study/repair/detail/' + id)
}
