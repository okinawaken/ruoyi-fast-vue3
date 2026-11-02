/**
 * 自习室模块常量
 */

/**
 * 座位预约状态（与后端 StudyRoomSeatStateEnum 一致）
 * FREE 10 空闲 / PARTIAL 20 部分时段可约 / UNAVAILABLE 30 不可预约
 */
export const SEAT_STATE = {
  FREE: 10,
  PARTIAL: 20,
  UNAVAILABLE: 30
}

/**
 * 小程序 token 失效错误码（后端 StudyRoomErrorCode.TOKEN_INVALID）
 */
export const TOKEN_INVALID_CODE = 40102

/**
 * 已结束的预约状态关键词（按包含匹配）
 * 上游「我的预约」只给中文描述、不给状态码
 * 用「取消 / 爽约」而非「已取消 / 已爽约」，覆盖「爽约系统取消」等变体描述
 */
export const RESERVE_ENDED_STATUS = ['取消', '已完成', '已结束', '已过期', '已违约', '已签退', '爽约']

/**
 * 预约页默认隐藏的门店关键词（押金专用门店不能选座预约）
 */
export const HIDDEN_VENUE_KEYWORDS = ['押金']

/**
 * 时间选项步长（分钟）
 */
export const TIME_STEP_MINUTES = 30

/**
 * 默认预约时长（分钟）
 */
export const DEFAULT_DURATION_MINUTES = 300

/**
 * 快捷预约时长（小时）
 */
export const QUICK_HOURS = [5, 6, 7, 8, 9]

/**
 * 预约时是否再约一个座位：0 否
 */
export const RESERVE_ANOTHER_FLAG = 0

/**
 * 最近一次预约时段缓存 key
 */
export const LAST_SLOT_KEY = 'studyroom_last_slot'

/**
 * 最近一次选择门店缓存 key
 */
export const LAST_VENUE_KEY = 'studyroom_last_venue'

/**
 * 自动预约执行星期（1 周一 … 7 周日，与后端一致）
 */
export const AUTO_RESERVE_WEEKDAYS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' }
]

/**
 * 自动预约任务启用状态
 */
export const AUTO_RESERVE_ENABLE_STATUS = {
  PAUSED: 0,
  ENABLED: 1
}

/**
 * 自动预约执行记录状态
 */
export const AUTO_RESERVE_RECORD_STATUS = {
  SKIPPED: 0,
  SUCCESS: 1,
  FAILED: 2
}

/**
 * 自动预约触发方式
 */
export const AUTO_RESERVE_TRIGGER_TYPE = {
  SCHEDULED: 0,
  MANUAL: 1
}

/**
 * 页面路径
 */
export const PAGE_PATH = {
  OVERVIEW: '/study/overview',
  RESERVE: '/study/reserve',
  AUTO_RESERVE: '/study/auto-reserve',
  AUTO_RESERVE_SETTING: '/study/auto-reserve-setting',
  PACKAGES: '/study/packages',
  SIGN: '/study/sign',
  CABINET: '/study/cabinet'
}

/**
 * 门店二维码默认内容（签到专用码），扫码门店的输入框默认填入该值
 */
export const DEFAULT_VENUE_QR_CODE = '签到专用码'
