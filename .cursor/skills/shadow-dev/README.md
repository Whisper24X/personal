# shadow-dev Skill

## 概述

ainative-shadow 管理后台开发技能，提供 7 步开发流程和企业级最佳实践。

## 技术栈

- **框架**: Vue 3 + TypeScript + Vite
- **UI**: Element Plus + TailwindCSS
- **状态**: Pinia
- **路由**: Vue Router
- **工具**: VueUse

## 核心特性

### 1. 7 步标准流程

清晰的开发步骤，从 API 定义到测试验证。

### 2. 企业级模式

- `useTable` Hook：自动处理表格分页、搜索、加载
- `art-table` 组件：增强的 Element Plus Table
- TypeScript 严格模式
- 统一的错误处理

### 3. 渐进式披露

- **SKILL.md**: 快速流程、核心模式、常见场景（178 行）
- **references**: 详细文档、完整示例、最佳实践

## 文件结构

```
shadow-dev/
├── SKILL.md                        # 核心指南（178 行）
├── README.md                       # 本文档
└── references/                     # 详细文档
    ├── api-types.md               # API 类型定义完整指南
    ├── api-implementation.md      # API 实现详细规范
    ├── component-patterns.md      # 组件模式和示例
    ├── core-hooks.md              # 核心 Hooks 使用
    ├── routing.md                 # 路由配置和权限
    └── state-management.md        # Pinia 状态管理
```

## 使用场景

AI Agent 会在以下情况自动使用：

- 开发 ainative-shadow 页面
- 创建管理后台列表/表单
- 用户提到"管理后台"、"后台管理"、"admin"
- 用户明确提到 ainative-shadow

## 7 步流程

| 步骤 | 说明 | 场景 |
|------|------|------|
| 1. 审计需求 | 确认开发范围 | 所有场景 |
| 2. 定义 API 类型 | TypeScript 类型定义 | 新增页面/接口 |
| 3. 实现 API 调用 | 创建 API 函数 | 新增页面/接口 |
| 4. 状态管理 | Pinia Store（可选） | 跨组件共享状态 |
| 5. 组件开发 | Vue 组件编写 | 所有场景 |
| 6. 路由配置 | 路由和菜单 | 新增页面 |
| 7. 测试验证 | 功能测试和 lint | 所有场景 |

### 场景快速索引

| 场景 | 起始步骤 |
|------|---------|
| 新增页面模块 | 步骤 2 |
| 已有页面新增功能 | 步骤 4 或 5 |
| 仅修改 UI | 步骤 5 |
| 新增路由/菜单 | 步骤 6 |

## 推荐模式

### 列表页面

```typescript
// 使用 useTable Hook
const { data, loading, pagination, fetchData } = useTable({
  core: { apiFn: fetchList, immediate: true }
})
```

```vue
<!-- 使用 art-table 组件 -->
<art-table :data="data" :loading="loading">
  <el-table-column prop="name" label="名称" />
</art-table>
```

### 表单页面

```typescript
// 使用 FormInstance 和 FormRules
const formRef = ref<FormInstance>()
const rules: FormRules = {
  name: [{ required: true, message: '请输入名称' }]
}
```

## 代码规范

- **TypeScript**: 严格模式，避免 `any`
- **命名**: 组件 PascalCase，函数 camelCase
- **组件**: 使用 `<script setup>`，添加 `defineOptions`
- **类型**: Props/Emits 完整定义

## 示例覆盖

### API 开发
- ✅ 类型定义规范（namespace 组织）
- ✅ CRUD 接口实现
- ✅ 文件上传/下载
- ✅ 并发请求处理

### 组件开发
- ✅ 列表页面（useTable）
- ✅ 表单页面（验证规则）
- ✅ 对话框表单（新增/编辑）
- ✅ 搜索组件（独立封装）
- ✅ 详情页面

### 路由和权限
- ✅ 静态路由配置
- ✅ 动态路由加载
- ✅ 路由守卫
- ✅ 权限控制（v-auth 指令）

### 状态管理
- ✅ Store 定义（Composition API）
- ✅ 状态持久化
- ✅ Store 间通信
- ✅ 重置 Store

## 常用命令

```bash
pnpm dev              # 开发服务器
pnpm build            # 生产构建
pnpm lint             # 代码检查
pnpm lint:prettier    # 格式化
pnpm preview          # 预览构建结果
```

## 相关文档

- [项目概览](../../../docs/dev-spec/ainative-shadow/README.md)
- [完整规范](../../../docs/dev-spec/ainative-shadow/references/)
- [架构文档](../../../docs/dev-spec/ainative-shadow/references/architecture.md)

## 与其他技能的关系

- **prototype**: 先用 prototype 验证想法，再用 shadow-dev 完整实现
- **test**: shadow-dev 开发完成后，用 test 生成测试用例

## 最佳实践总结

### DO ✅

- ✅ 使用 TypeScript 严格类型
- ✅ 使用 `useTable` 管理列表
- ✅ 使用 `art-table` 增强表格
- ✅ Props/Emits 完整类型定义
- ✅ 添加 JSDoc 注释
- ✅ 复用项目工具和组件

### DON'T ❌

- ❌ 使用 `any` 类型
- ❌ 过度使用 Pinia（简单状态用 ref）
- ❌ 在 API 层处理业务逻辑
- ❌ 直接修改 Store state（用 action）
- ❌ 重复造轮子（优先用现有组件/工具）

---

**版本**: 1.0.0  
**最后更新**: 2026-02-03  
**维护者**: AI Agent
