import request from '@/utils/study/request'

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
