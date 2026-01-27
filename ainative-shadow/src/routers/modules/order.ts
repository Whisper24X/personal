import { RouteRecordRaw } from 'vue-router'

const orderRoutes: RouteRecordRaw[] = [
    {
        path: '/order',
        name: 'Order',
        meta: {
            title: '订单管理',
            icon: 'order',
            ignoreAuth: true,
        },
        children: [
            {
                path: 'channel',
                name: 'Channel',
                component: () => import('@/pages/orderManagement/channel/index.vue'),
                meta: {
                    title: '渠道订单管理',
                    icon: 'notebook',
                    permissions: ['channel_order_view'],
                },
            },
            {
                path: 'subOrder',
                name: 'SubOrder',
                component: () => import('@/pages/orderManagement/subOrder/index.vue'),
                meta: {
                    title: '子订单管理',
                    icon: 'document',
                    permissions: ['sub_order_view'],
                },
            }
        ],
    },
]

export default orderRoutes
