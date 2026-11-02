import request from '@/utils/study/request'

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
