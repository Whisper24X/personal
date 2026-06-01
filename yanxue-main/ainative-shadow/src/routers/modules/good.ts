import { RouteRecordRaw } from 'vue-router'

const goodRoutes: RouteRecordRaw[] = [
  {
    path: '/good',
    name: 'Good',
    meta: {
      title: '商品管理',
      icon: 'goods',
      ignoreAuth: true,
    },
    children: [
      {
        path: 'list',
        name: 'GoodList',
        component: () => import('@/pages/goodManagement/list/index.vue'),
        meta: {
          title: '平台商品管理',
          icon: 'shopping-bag',
          permissions: ['good_list_view'],
        },
      },
      {
        path: 'channel/:id',
        name: 'GoodChannelList',
        component: () => import('@/pages/goodManagement/channel/index.vue'),
        meta: {
          title: '商品渠道管理',
          icon: 'shop',
          permissions: ['good_channel_view'],
          hidden: true,
        },
      },
    ],
  },
]

export default goodRoutes
