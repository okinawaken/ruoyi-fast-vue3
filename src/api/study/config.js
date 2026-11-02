import request from '@/utils/study/request'

/**
 * 自习室 - 全局配置与公告
 */
export const studyConfigApi = {
  sys: () => request.get('/business/study/config/sys'),
  notice: venueId => request.get('/business/study/config/notice', { params: { venueId } })
}
