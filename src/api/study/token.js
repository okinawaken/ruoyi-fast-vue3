import request from '@/utils/study/request'

/**
 * 自习室 - 小程序账号 token
 */
export const studyTokenApi = {
  detail: () => request.get('/business/study/token/detail'),
  bind: token => request.post('/business/study/token/bind', { token }),
  unbind: () => request.delete('/business/study/token/unbind')
}
