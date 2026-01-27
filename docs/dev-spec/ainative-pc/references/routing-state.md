# 路由与状态规范

## 路由
- 路由入口在 `src/router/index.ts`
- 使用 `createWebHistory(import.meta.env.BASE_URL)` 作为 history
- 页面组件放在 `src/views/` 目录

### 新增页面步骤
1. 在 `src/views/` 新建页面组件（建议以 `XxxView.vue` 命名）
2. 在 `src/router/index.ts` 添加路由配置
3. 体积较大的页面使用懒加载：
   - `component: () => import('../views/YourView.vue')`

## 状态管理
- Pinia Store 统一放在 `src/stores/`
- Store 命名建议与业务域一致，如 `useUserStore`
- 组件内通过 `const store = useUserStore()` 使用
