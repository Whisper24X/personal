# 路由与权限规范

## 目录结构
- `ainative-shadow/src/router/index.ts` - 路由实例与守卫入口
- `ainative-shadow/src/router/routes/staticRoutes.ts` - 静态路由（无需权限）
- `ainative-shadow/src/router/routes/asyncRoutes.ts` - 动态路由入口
- `ainative-shadow/src/router/modules/` - 业务路由模块
- `ainative-shadow/src/router/core/` - 路由注册与转换核心
- `ainative-shadow/src/router/guards/` - 全局守卫

## 权限模式
- `VITE_ACCESS_MODE=frontend`：菜单来源于 `asyncRoutes`，通过角色过滤
- `VITE_ACCESS_MODE=backend`：菜单来源于后端接口 `fetchGetMenuList`

## 路由配置规范
- 路由类型使用 `AppRouteRecord`（`src/types/router`）
- `meta.title` 必填，推荐使用 `menus.*` i18n key
- 一级路由通常使用布局容器：`component: '/index/index'` 或 `RoutesAlias.Layout`
- `component` 为字符串时，路径相对 `src/views`，不带 `.vue` 后缀
- 子路由路径禁止以 `/` 开头（外链/iframe 除外）
- 外链：`meta.link` + `path` 指向 `http(s)://`
- iframe：`meta.isIframe=true` 且 `path` 使用 `/outside/iframe/:path`

## 常用 meta 字段
- `title` - 菜单标题
- `icon` - 图标
- `roles` - 角色权限
- `authList` - 操作权限列表（按钮级别）
- `isHide` - 菜单隐藏
- `isHideTab` - 标签页隐藏
- `keepAlive` - 页面缓存
- `fixedTab` - 固定标签页
- `link` / `isIframe` - 外链与 iframe

## 路由示例
```ts
import { AppRouteRecord } from '@/types/router'

export const systemRoutes: AppRouteRecord = {
  path: '/system',
  name: 'System',
  component: '/index/index',
  meta: {
    title: 'menus.system.title',
    icon: 'ri:user-3-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'admin',
      name: 'Admin',
      component: '/system/admin',
      meta: {
        title: 'menus.system.admin',
        keepAlive: true
      }
    }
  ]
}
```

## 注意事项
- 新增路由后同步补充 `src/locales/langs/zh.json` 与 `en.json`
- 变更菜单层级时，注意子路径不要使用绝对路径
