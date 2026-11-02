import request from '@/utils/study/request'

/**
 * 自习室 - 门禁
 */
export const studyGuardApi = {
  select: venueId => request.get('/business/study/guard/select', { params: { venueId } }),
  open: guardId => request.post('/business/study/guard/open', { guardId })
}
