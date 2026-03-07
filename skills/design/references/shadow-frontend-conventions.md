# ainative-shadow 前端规范（Design 参考）

Design 文档第 4 章（前端技术方案）必须遵循本规范，与当前项目实现一致。

## 1. 目录结构

```
ainative-shadow/src/
├── pages/                    # 页面组件（非 views/）
│   ├── {XxxManagement}/     # 业务模块，如 courseManagement、storedCardManagement
│   │   ├── {子模块}/        # 如 info、config、flow
│   │   │   ├── index.vue    # 页面入口
│   │   │   ├── form.vue     # 表单页（如有）
│   │   │   ├── service.ts   # 该子模块的 API 调用
│   │   │   └── service.type.ts  # 可选，复杂模块的类型
│   │   └── ...
│   ├── authority/           # 权限相关（登录、账号、角色等）
│   ├── exception/           # 404、403 等异常页
│   └── layouts/             # 布局组件
├── routers/modules/          # 路由模块，按业务分文件
├── store/modules/           # Pinia 状态
├── types/api/               # API 类型（api.d.ts）
├── components/              # 公共组件
├── service/                 # 全局服务（如 axios.interceptor）
└── utils/                   # 工具函数
```

- **页面**：统一放在 `pages/`，按 `{XxxManagement}/{子模块}` 组织
- **禁止**：在文件清单中出现 `src/views/`、`src/api/{模块}.ts` 形式的集中 API

## 2. API 放置规范

- **位置**：`pages/{XxxManagement}/{子模块}/service.ts`，与页面同目录
- **引用**：页面通过 `import { ... } from './service'` 引用
- **类型**：优先使用 `src/types/api/api.d.ts` 的 `Api.*` 命名空间；复杂模块可增加 `service.type.ts`

**参考示例**：

| 模块       | 路径                                               | 说明                             |
| ---------- | -------------------------------------------------- | -------------------------------- |
| 课程管理   | `pages/courseManagement/info/service.ts`           | 课程 CRUD、状态更新              |
| 储值卡配置 | `pages/storedCardManagement/config/service.ts`     | 配置列表、详情、创建、更新、状态 |
| 储值卡流水 | `pages/storedCardManagement/flow/service.ts`       | 流水列表                         |
| 储值卡统计 | `pages/storedCardManagement/statistics/service.ts` | 统计数据                         |

## 3. API 路径规范

- **格式**：`/api/shadow/v1/{资源}/{动作}`，**不带** `/yanxue` 前缀
- **原因**：`BASE_API_URL` 已包含 `/yanxue`（沙箱为 `/api/yanxue`），路径再带会重复导致 404

| 正确                                 | 错误                                        |
| ------------------------------------ | ------------------------------------------- |
| `/api/shadow/v1/stored-card/configs` | `/yanxue/api/shadow/v1/stored-card/configs` |
| `/api/shadow/v1/course/list`         | `/yanxue/api/shadow/v1/course/list`         |

## 4. 路由配置

- **位置**：`src/routers/modules/{业务}.ts`，如 `storedCard.ts`、`course.ts`
- **引用**：`component: () => import('@/pages/{XxxManagement}/{子模块}/index.vue')`
- **结构**：支持嵌套 children，meta 含 title、icon、permissions、hidden 等

```typescript
// 示例
{
  path: 'config',
  name: 'StoredCardConfig',
  component: () => import('@/pages/storedCardManagement/config/index.vue'),
  meta: {
    title: '配置管理',
    icon: 'setting',
    permissions: ['stored-card:config'],
  },
}
```

## 5. 类型定义

- **位置**：`src/types/api/api.d.ts`
- **组织**：`declare namespace Api { namespace ModuleName { ... } }`
- **命名**：Params/Response/Item 后缀，复用 `Api.Common.PaginatedResponse` 等

## 6. 组件与 Hooks

- **表格**：CommonTable + fetch-data 模式，或 useTable
- **表单**：ElForm + FormRules
- **状态**：跨组件共享用 Pinia store（`store/modules/`）

## 7. 与 DESIGN.md 的衔接

第 4 章文件清单应：

- 列出 `pages/{模块}/{子模块}/index.vue`、`form.vue`、`service.ts`
- 列出 `routers/modules/{业务}.ts`
- 禁止出现 `src/api/{模块}.ts`、`src/views/` 路径
- 目录结构示例体现 pages + service 同级组织
