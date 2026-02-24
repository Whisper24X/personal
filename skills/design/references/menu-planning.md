# 菜单规划指南

在 DESIGN.md 生成后，若项目存在 `ainative-shadow` 且第 4 章包含 routers 新增或修改，按本指南补充 DESIGN.md。

## 检测时机

检测在 DESIGN.md 生成完成后执行。先确认存在 `ainative-shadow` 目录；再检查第 4 章（前端技术方案设计）的文件清单、路由配置是否包含 routers 新增或修改。若涉及，则执行补充。

## 补充要求

在 DESIGN.md 中补充以下内容：

1. **第 4 章 "前端技术方案设计"** 中添加：
   - **4.5 路由与菜单配置**（新增子章节）
     - 列出所有新增菜单的路由配置
     - 说明菜单的路径、名称、标题、图标
     - 说明菜单的权限要求（permissions）
     - 说明菜单的层级关系（如果有嵌套菜单）
     - 明确标识：**需要执行菜单数据库注入任务**

2. **第 6 章 "数据模型设计"** 中添加：
   - 如果涉及菜单权限表，添加 `menus` 表设计说明

## 菜单配置格式

在 Design 文档第 4.5 章节中，使用以下格式：

### 4.5 路由与菜单配置

#### 新增菜单列表

| 路径         | 名称       | 标题     | 图标 | 权限      | 父菜单  | 说明                 |
| ------------ | ---------- | -------- | ---- | --------- | ------- | -------------------- |
| /user        | User       | 用户管理 | user | user:view | -       | 用户列表页面         |
| /system/user | SystemUser | 用户管理 | user | user:view | /system | 系统管理下的用户管理 |

#### 路由配置示例

```typescript
// src/router/routes/staticRoutes.ts
export const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/user',
    name: 'User',
    component: () => import('@/views/user/index.vue'),
    meta: {
      title: '用户管理',
      icon: 'user',
      permissions: ['user:view'],
      requiresAuth: true,
    },
  },
];
```

## 菜单数据库注入任务

**重要**：新增菜单需要同步到数据库，执行菜单权限数据库注入任务。

- **任务位置**：将在 openspec 任务规划阶段自动添加
- **执行时机**：前端路由配置完成后
- **说明**：project-management skill 会检测第 4.5 章节，自动在 `tasks.md` 中添加菜单注入任务

## 检查清单

补充 DESIGN.md 后，确保：

- [ ] 在第 4 章添加了 "4.5 路由与菜单配置" 子章节
- [ ] 列出了所有新增菜单的路由配置
- [ ] 说明了菜单的权限要求
- [ ] 明确了需要执行菜单数据库注入任务
- [ ] 在第 6 章添加了菜单权限表设计（如需要）
