import { RouteRecordRaw } from 'vue-router'

/**
 * 评价管理路由
 */
const evaluationRoutes: RouteRecordRaw[] = [
  {
    path: '/evaluation',
    name: 'Evaluation',
    redirect: '/evaluation/template',
    meta: {
      title: '评价管理',
    },
    children: [
      {
        path: 'template',
        name: 'EvaluationTemplate',
        component: () =>
          import('@/pages/evaluationManagement/template/index.vue'),
        meta: {
          title: '评价模板管理',
          permissions: ['evaluation_template_view'],
        },
      },
      {
        path: 'display',
        name: 'EvaluationDisplay',
        component: () =>
          import('@/pages/evaluationManagement/display/index.vue'),
        meta: {
          title: '课程评价管理',
          permissions: ['evaluation_display_view'],
        },
      },
    ],
  },
]

export default evaluationRoutes
