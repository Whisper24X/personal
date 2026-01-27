import type { RouteRecordRaw } from 'vue-router'

const miniProgramRoutes: RouteRecordRaw[] = [
  {
    path: '/miniProgram',
    name: 'MiniProgramManagement',
    meta: {
      title: '小程序管理',
    },
    children: [
      {
        path: 'recommendation',
        name: 'RecommendationIndex',
        component: () =>
          import('@/pages/miniProgramManagement/recommendation/index.vue'),
        meta: {
          title: '首页推荐管理',
        },
      },
      {
        path: 'coupon',
        name: 'CouponList',
        component: () =>
          import('@/pages/miniProgramManagement/coupon/index.vue'),
        meta: {
          title: '优惠券列表',
        },
      },
      {
        path: 'couponRecord',
        name: 'CouponRecord',
        component: () =>
          import('@/pages/miniProgramManagement/couponRecord/index.vue'),
        meta: {
          title: '优惠券领取记录',
        },
      },
    ],
  },
]

export default miniProgramRoutes
