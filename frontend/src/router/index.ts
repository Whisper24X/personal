/**
 * Vue Router 路由配置
 */

import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../views/dashboard/Dashboard.vue';
import ProjectCreate from '../views/project/ProjectCreate.vue';
import ProjectDetail from '../views/project/ProjectDetail.vue';
import ProjectInteractive from '../views/project/ProjectInteractive.vue';
import ApplicationList from '../views/application/ApplicationList.vue';
import ApplicationDetail from '../views/application/ApplicationDetail.vue';
import WorkflowManagement from '../views/application/WorkflowManagement.vue';
import LLMConfig from '../views/config/LLMConfig.vue';
import RoleLLMConfig from '../views/config/RoleLLMConfig.vue';
import PromptConfig from '../views/config/PromptConfig.vue';
import KnowledgeBase from '../views/knowledge/KnowledgeBase.vue';

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
      path: '/application/:id/workflows',
      name: 'WorkflowManagement',
      component: WorkflowManagement,
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
    {
      path: '/project/:id/knowledge-base',
      name: 'KnowledgeBase',
      component: KnowledgeBase,
      props: true,
    },
    {
      path: '/config/llm',
      name: 'LLMConfig',
      component: LLMConfig,
    },
    {
      path: '/config/role-llm',
      name: 'RoleLLMConfig',
      component: RoleLLMConfig,
    },
    {
      path: '/config/prompts',
      name: 'PromptConfig',
      component: PromptConfig,
    },
  ],
});

// Add navigation guard to refresh project list when returning from interactive page
router.afterEach((to, from) => {
  // If navigating from interactive page to dashboard or application detail, refresh data
  if (from.name === 'ProjectInteractive' && (to.name === 'Dashboard' || to.name === 'ApplicationDetail')) {
    // Use nextTick to ensure component is mounted before refreshing
    setTimeout(() => {
      // Trigger refresh by dispatching a custom event
      window.dispatchEvent(new CustomEvent('refresh-project-list'));
    }, 100);
  }
});

export default router;

