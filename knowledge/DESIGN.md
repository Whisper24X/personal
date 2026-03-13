# 设计原则与模式

## 设计原则

- **Simplicity First**：默认简单实现，避免过度设计
- **依赖向内**：外层依赖内层，内层不依赖外层
- **依赖倒置**：Biz 层定义接口，Data 层实现
- **业务逻辑在 Biz 层**：不要放在 Service 或 Data 层

---

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| Vue 组件 | PascalCase | `TabbarItem.vue` |
| TypeScript 工具 | camelCase | `useRequest.ts` |
| Go 文件 | snake_case | `app_v1_auth.go` |
| Proto 文件 | snake_case | `sys_admin.proto` |
| 数据库表 | snake_case + 前缀 | `sys_admin` |
| Proto messages | PascalCase | `SysAdminListReq` |
| Proto fields | snake_case | `admin_id` |

---

## 代码风格

### 前端 (TypeScript/Vue)

- ESLint + Prettier
- Vue SFC 使用 `<script setup>` 语法
- SFC 块顺序：`<script>` 或 `<template>` 优先，然后 `<style>`
- TypeScript strict 模式
- SCSS 用于组件样式，使用 scoped

### 后端 (Go)

- gofmt + goimports
- gci 用于 import 分组
- golangci-lint 代码检查
- gosec 安全扫描
- 生成代码（`Code generated` / `DO NOT EDIT`）禁止手动修改

---

## 核心模式

### 1. Composition API (Vue)

全面采用 Vue 3 Composition API，`<script setup>` 语法。

### 2. Hooks 模式 (前端)

封装可复用业务逻辑，如 `useTable`、`useAuth`。

### 3. Repository 接口 (后端)

```go
// Biz 层定义
type SysAdminRepo interface {
    List(ctx context.Context, params *ListParams) ([]*Admin, int64, error)
}

// Data 层实现
var _ biz.SysAdminRepo = (*SysAdminRepo)(nil)
```

### 4. 依赖注入 (Wire)

每层 `ProviderSet` 注册 Provider，`make wire` 生成依赖图。

---

## Git 提交规范

使用 Conventional Commits：

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档
- `style`: 格式（无逻辑变更）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `build` / `ci` / `chore` / `revert` / `wip`

---

## 相关文档

- [openspec/project.md](../openspec/project.md)
- [docs/dev-spec/README.md](../docs/dev-spec/README.md)
- [docs/dev-spec/ainative-shadow/references/architecture.md](../docs/dev-spec/ainative-shadow/references/architecture.md)
