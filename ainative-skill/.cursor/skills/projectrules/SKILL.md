---
name: projectrules
description: Enforces production-grade coding standards for the testflow project. Defines backend (Node.js/TypeScript) and frontend (Vue 3) architecture, layer boundaries, and AI code generation workflow. Use when writing or modifying backend code, frontend code, API controllers, roles, actions, services, or when the user asks about project conventions.
---

# Project Rules

## Quick Reference

- **Backend structure**: See [references/backend.md](references/backend.md)
- **Frontend structure**: See [references/frontend.md](references/frontend.md)

---

## 1. Global Principles

- 生产级代码标准，非 Demo
- 优先级：可读性 > 可维护性 > 简洁性 > 性能微优化
- 单一职责原则（SRP）
- 所有逻辑必须：可测试、可复用、可追踪（日志/状态）
- 依赖显式声明，不假设隐式上下文
- 需求不完整时：给出合理假设，并在注释中明确标出

---

## 2. Backend Layer Constraints

### Controller (`api/controllers/`)

- 只做：参数解析校验、调用 Repository/Service/Role、返回 HTTP 响应
- 禁止：业务逻辑、直接访问 DB、直接调用 Action

### Role (`roles/`)

- AI 角色业务逻辑与决策，管理 Action 执行顺序
- 禁止：直接访问 DB、处理 HTTP

### Action (`actions/`)

- 执行具体 AI 任务（WriteCode, WritePRD 等），调用 LLM，返回 IActionOutput
- 禁止：业务决策、直接访问 DB、处理 HTTP

### Orchestration (`orchestration/`)

- 项目与工作流编排，Team 管理多 Role 协作
- 禁止：直接访问 DB、处理 HTTP

### Service (`services/`)

- 业务服务（RAGService, EmbeddingService 等）
- 禁止：直接访问 DB、处理 HTTP

### Repository (`database/repositories/`)

- 仅负责数据访问，封装 SQL/事务
- 禁止：业务逻辑、调用 Role/Action/Service

---

## 3. Backend Conventions

**错误与日志**

- 使用 `BusinessError`、`ValidationError`，禁止 `throw string`
- 关键路径必须有日志：info（流程）、warn（可恢复）、error（不可恢复）

**API 返回**

```typescript
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
```

- 错误码语义化，禁止只返回 500

---

## 4. Frontend Conventions

- 必须使用 Composition API
- 组件结构顺序：props/emits → state → computed → methods → lifecycle
- 禁止：组件内直接请求 API、template 中写复杂表达式
- 逻辑拆分：页面私有 → 当前组件；可复用 → composables；跨页面 → Pinia
- API 请求统一放在 services，组件只调用 service，显式处理异常

---

## 5. Collaboration

- 接口字段 camelCase 一致
- 前端不依赖后端隐式字段
- 后端字段变更须同步类型定义

---

## 6. Testability

- Service / Composable 须具备单测友好结构
- 避免强耦合全局状态
- 逻辑必须可测试（不强制生成测试代码）

---

## 7. AI Code Generation Workflow

生成代码时须遵循：

1. 先给出整体方案说明
2. 明确文件结构与职责
3. 再生成核心代码
4. 对关键设计取舍给出说明

**禁止**

- 一次性生成完整项目
- 跳过关键逻辑
- 使用「自行实现」「略」等方式逃避实现

---

## 8. Output Style

- 默认 TypeScript
- 代码块完整、可运行
- 注释解释「为什么」，非「做了什么」
- 命名清晰，拒绝缩写
