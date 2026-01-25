/**
 * Vue Router 路由配置
 */

import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../views/dashboard/Dashboard.vue';
import SystemConfig from '../views/config/SystemConfig.vue';
import KnowledgeBase from '../views/knowledge/KnowledgeBase.vue';

// 业务线相关组件
import BusinessLineList from '../views/businessLine/BusinessLineList.vue';
import WorkflowManagement from '../views/businessLine/WorkflowManagement.vue';

// 平台相关组件
import PlatformList from '../views/platform/PlatformList.vue';
import PlatformWorkflow from '../views/platform/PlatformWorkflow.vue';
import PlatformDetail from '../views/platform/PlatformDetail.vue';
import PlatformVersions from '../views/platform/PlatformVersions.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 首页
    {
      path: '/',
      name: 'Dashboard',
      component: Dashboard,
    },
    
    // ==================== 业务线相关路由 ====================
    {
      path: '/business-lines',
      name: 'BusinessLineList',
      component: BusinessLineList,
    },
    {
      path: '/business-line/:id/platforms',
      name: 'PlatformList',
      component: PlatformList,
      props: true,
    },
    {
      path: '/business-line/:id/workflows',
      name: 'WorkflowManagement',
      component: WorkflowManagement,
      props: true,
    },
    
    // ==================== 平台相关路由 ====================
    {
      path: '/platform/:id/versions',
      name: 'PlatformVersions',
      component: PlatformVersions,
      props: true,
    },
    {
      path: '/platform/:id/workflow',
      name: 'PlatformWorkflow',
      component: PlatformWorkflow,
      props: true,
    },
    {
      path: '/platform/:id',
      name: 'PlatformDetail',
      component: PlatformDetail,
      props: true,
    },
    {
      path: '/platform/:id/knowledge-base',
      name: 'KnowledgeBase',
      component: KnowledgeBase,
      props: true,
    },
    
    // ==================== 配置相关路由 ====================
    // 统一配置页面（支持 tab 参数：llm, roles, prompts）
    {
      path: '/config',
      name: 'SystemConfig',
      component: SystemConfig,
    },
    // 兼容旧路由，重定向到新的统一配置页面
    {
      path: '/config/llm',
      redirect: '/config?tab=llm',
    },
    {
      path: '/config/role-llm',
      redirect: '/config?tab=roles',
    },
    {
      path: '/config/prompts',
      redirect: '/config?tab=prompts',
    },
  ],
});

// Add navigation guard to refresh platform list when returning from workflow page
router.afterEach((to, from) => {
  // If navigating from workflow page to dashboard or platform list, refresh data
  if (from.name === 'PlatformWorkflow' && (to.name === 'Dashboard' || to.name === 'PlatformList')) {
    // Use nextTick to ensure component is mounted before refreshing
    setTimeout(() => {
      // Trigger refresh by dispatching a custom event
      window.dispatchEvent(new CustomEvent('refresh-platform-list'));
    }, 100);
  }
});

export default router;
