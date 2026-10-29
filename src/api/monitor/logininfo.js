import request from '@/utils/request'

// 查询登录日志列表
export function list(query) {
  return request({
    url: '/monitor/logininfo/list',
    method: 'get',
    params: query
  })
}

// 删除登录日志
export function delLogininfo(infoId) {
  return request({
    url: '/monitor/logininfo/' + infoId,
    method: 'delete'
  })
}

// 解锁用户登录状态
export function unlockLogininfo(userName) {
  return request({
    url: '/monitor/logininfo/unlock/' + userName,
    method: 'get'
  })
}

// 清空登录日志
export function cleanLogininfo() {
  return request({
    url: '/monitor/logininfo/clean',
    method: 'delete'
  })
}
