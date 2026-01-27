import { RouteRecordRaw } from 'vue-router'

const courseRoutes: RouteRecordRaw[] = [
  {
    path: '/course',
    name: 'Course',
    meta: {
      title: '课程管理',
      icon: 'reading',
      ignoreAuth: true,
    },
    children: [
      {
        path: 'info',
        name: 'CourseInfo',
        component: () => import('@/pages/courseManagement/info/index.vue'),
        meta: {
          title: '课程信息管理',
          icon: 'notebook',
          permissions: ['course_info_view'],
        },
      },
      {
        path: 'inventory',
        name: 'CourseInventory',
        component: () => import('@/pages/courseManagement/inventory/index.vue'),
        meta: {
          title: '课程库存管理',
          icon: 'tickets',
          permissions: ['course_inventory_view'],
        },
      },
      {
        path: 'appointment',
        name: 'CourseAppointment',
        component: () =>
          import('@/pages/courseManagement/appointment/index.vue'),
        meta: {
          title: '课程预约管理',
          icon: 'calendar',
          permissions: ['course_appointment_view'],
        },
      },
    ],
  },
]

export default courseRoutes
