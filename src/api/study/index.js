/**
 * 自习室接口兼容入口。
 *
 * 新代码建议直接从对应领域模块导入，例如：
 * import { studyReserveApi } from '@/api/study/reserve'
 *
 * 保留此文件用于兼容已有 import。
 */

export { studyTokenApi, studyConfigApi } from './token'
export { studyUserApi } from './user'
export { studyVenueApi } from './venue'
export { studyReserveApi } from './reserve'
export { studyAutoReserveApi } from './auto-reserve'
export { studySignApi } from './sign'
export { studyGuardApi } from './guard'
export { studyPackageApi } from './package'
export { studyLeaveApi } from './leave'
export { studyRepairApi } from './repair'
export { studyMiscApi } from './misc'
