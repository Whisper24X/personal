import { RouteRecordRaw } from 'vue-router'

const contractRoutes: RouteRecordRaw[] = [
    {
        path: '/contract',
        name: 'Contract',
        meta: {
            title: '合同管理',
            icon: 'document',
            ignoreAuth: true
        },
        children: [
            {
                path: 'template',
                name: 'ContractTemplate',
                component: () => import('@/pages/contractManagement/template/index.vue'),
                meta: {
                    ignoreAuth: true,
                    title: '合同模板',
                    icon: 'files',
                    permissions: ['contract_template_view']
                },
            },
            {
                path: 'record',
                name: 'ContractRecord',
                component: () => import('@/pages/contractManagement/record/index.vue'),
                meta: {
                    ignoreAuth: true,
                    title: '合同列表',
                    icon: 'document',
                    permissions: ['contract_record_view']
                },
            },
            // 可以在这里添加更多合同管理相关路由
        ],
    },
]

export default contractRoutes