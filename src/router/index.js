import { createWebHistory, createRouter } from 'vue-router'
/* Layout */
import Layout from '@/layout'

/**
 * Note: 路由配置项
 *
 * hidden: true                     // 当设置 true 的时候该路由不会再侧边栏出现 如401，login等页面，或者如一些编辑页面/edit/1
 * alwaysShow: true                 // 当你一个路由下面的 children 声明的路由大于1个时，自动会变成嵌套的模式--如组件页面
 *                                  // 只有一个时，会将那个子路由当做根路由显示在侧边栏--如引导页面
 *                                  // 若你想不管路由下面的 children 声明的个数都显示你的根路由
 *                                  // 你可以设置 alwaysShow: true，这样它就会忽略之前定义的规则，一直显示根路由
 * redirect: noRedirect             // 当设置 noRedirect 的时候该路由在面包屑导航中不可被点击
 * name:'router-name'               // 设定路由名称
 * query: '{"id": 1, "name": "ry"}' // 访问路由的默认传递参数
 * roles: ['admin', 'common']       // 访问路由的角色权限
 * permissions: ['a:a:a', 'b:b:b']  // 访问路由的菜单权限
 * meta : {
    title: 'title'                  // 设置该路由在侧边栏和面包屑中展示的名字
    icon: 'svg-name'                // 设置该路由的图标，对应路径src/assets/icons/svg
    breadcrumb: false               // 如果设置为false，则不会在breadcrumb面包屑中显示
    activeMenu: '/system/user'      // 当路由设置了该属性，则会高亮相对应的侧边栏。
  }
 */

// 公共路由
export const constantRoutes = [
  {
    path: '/redirect',
    component: Layout,
    hidden: true,
    children: [
      {
        path: '/redirect/:path(.*)',
        component: () => import('@/views/redirect/index.vue')
      }
    ]
  },
  {
    path: '/login',
    component: () => import('@/views/login'),
    hidden: true
  },
  {
    path: "/:pathMatch(.*)*",
    component: () => import('@/views/error/404'),
    hidden: true
  },
  {
    path: '/401',
    component: () => import('@/views/error/401'),
    hidden: true
  },
  {
    path: '',
    component: Layout,
    redirect: '/index',
    children: [
      {
        path: '/index',
        component: () => import('@/views/index'),
        name: 'Index',
        meta: { title: '首页', icon: 'dashboard' }
      }
    ]
  },
  {
    path: '/study',
    component: Layout,
    redirect: '/study/overview',
    name: 'Study',
    meta: { title: '自习室', icon: 'education', alwaysShow: true },
    children: [
      {
        path: 'overview',
        component: () => import('@/views/study/index'),
        name: 'StudyOverview',
        meta: { title: '概览', icon: 'dashboard' }
      },
      {
        path: 'reserve',
        component: () => import('@/views/study/reserve'),
        name: 'StudyReserve',
        meta: { title: '预约选座', icon: 'date' }
      },
      {
        path: 'auto-reserve',
        component: () => import('@/views/study/auto-reserve'),
        name: 'StudyAutoReserve',
        meta: { title: '自动预约', icon: 'time' }
      },
      {
        path: 'auto-reserve-setting',
        component: () => import('@/views/study/auto-reserve-setting'),
        name: 'StudyAutoReserveSetting',
        meta: { title: '自动预约配置', icon: 'edit' }
      },
      {
        path: 'sign',
        component: () => import('@/views/study/sign'),
        name: 'StudySign',
        meta: { title: '在座与签到', icon: 'time' }
      },
      {
        path: 'packages',
        component: () => import('@/views/study/packages'),
        name: 'StudyPackages',
        meta: { title: '套餐中心', icon: 'shopping' }
      },
      {
        path: 'voucher',
        component: () => import('@/views/study/voucher'),
        name: 'StudyVoucher',
        meta: { title: '团购券核销', icon: 'money' }
      },
      {
        path: 'cabinet',
        component: () => import('@/views/study/cabinet'),
        name: 'StudyCabinet',
        meta: { title: '储物柜', icon: 'lock' }
      }
    ]
  },
  {
    path: '/system',
    component: Layout,
    redirect: '/system/user',
    name: 'System',
    meta: { title: '系统管理', icon: 'system', alwaysShow: true },
    children: [
      {
        path: 'user',
        component: () => import('@/views/system/user/index'),
        name: 'User',
        meta: { title: '用户管理', icon: 'user' }
      },
      {
        path: 'dict',
        component: () => import('@/views/system/dict/index'),
        name: 'Dict',
        meta: { title: '字典管理', icon: 'dict' }
      },
      {
        path: 'config',
        component: () => import('@/views/system/config/index'),
        name: 'Config',
        meta: { title: '参数设置', icon: 'edit' }
      },
      {
        path: 'dict-data/index/:dictId(\\d+)',
        component: () => import('@/views/system/dict/data'),
        name: 'Data',
        hidden: true,
        meta: { title: '字典数据', activeMenu: '/system/dict' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_APP_CONTEXT_PATH),
  routes: constantRoutes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
});

export default router;
