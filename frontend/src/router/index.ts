/**
 * Vue Router 路由配置
 */

import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import ProjectCreate from '../views/ProjectCreate.vue';
import ProjectDetail from '../views/ProjectDetail.vue';
import ProjectInteractive from '../views/ProjectInteractive.vue';
import ApplicationList from '../views/ApplicationList.vue';
import ApplicationDetail from '../views/ApplicationDetail.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Dashboard',
      component: Dashboard,
    },
    {
      path: '/applications',
      name: 'ApplicationList',
      component: ApplicationList,
    },
    {
      path: '/application/:id',
      name: 'ApplicationDetail',
      component: ApplicationDetail,
      props: true,
    },
    {
      path: '/create',
      name: 'ProjectCreate',
      component: ProjectCreate,
    },
    {
      path: '/project/interactive',
      name: 'ProjectInteractive',
      component: ProjectInteractive,
    },
    {
      path: '/project/:id',
      name: 'ProjectDetail',
      component: ProjectDetail,
      props: true,
    },
  ],
});

export default router;

