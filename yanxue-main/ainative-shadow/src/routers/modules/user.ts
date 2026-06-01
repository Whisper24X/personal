import { RouteRecordRaw } from 'vue-router'

const userRoutes: RouteRecordRaw[] = [
    {
        path: '/user',
        name: 'User',
        meta: {
            title: '用户管理',
            icon: 'user',
        },
        children: [
            {
                path: 'list',
                name: 'UserList',
                component: () => import('@/pages/userManagement/list/index.vue'),
                meta: {
                    title: '用户列表',
                    icon: 'user-list',
                },
            },
        ],
    },
]

export default userRoutes 