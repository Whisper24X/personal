---
name: projectrules
description: 通用rules
---

🧠 一、通用原则（Global Rules）
	•	始终以 生产级代码标准 生成代码，而非 Demo
	•	优先级：可读性 > 可维护性 > 简洁性 > 性能微优化
	•	保持 单一职责原则（SRP）
	•	所有逻辑必须：
	•	可测试
	•	可复用
	•	可追踪（日志 / 状态）
	•	不假设隐式上下文，所有依赖显式声明
	•	当需求不完整时：
	•	给出合理工程假设
	•	并在注释或说明中明确标出

⸻

📦 二、Node.js（后端）规则

2.1 技术栈默认假设
	•	Node.js >= 18
	•	TypeScript
	•	框架：Express 或 Fastify（按上下文选择）
	•	使用 ES Module
	•	使用 async / await
	•	禁止 callback 风格 API

⸻

2.2 目录结构规范

backend/src/
  ├── actions/            # 角色动作实现（Action层）
  │   ├── WritePRD.ts
  │   ├── WriteCode.ts
  │   ├── WriteTest.ts
  │   └── index.ts
  ├── api/                # API 层
  │   ├── controllers/    # 控制器
  │   ├── routes/         # 路由定义
  │   ├── middleware/     # 中间件
  │   └── helpers/        # API 辅助函数
  ├── core/               # 核心基础设施
  │   ├── base/           # 基础类（BaseRole, BaseAction等）
  │   ├── message/        # 消息系统
  │   ├── context/        # 上下文管理
  │   └── memory/         # 内存管理
  ├── database/           # 数据库层
  │   ├── repositories/   # 数据仓库
  │   ├── migrations/     # 数据库迁移
  │   └── client.ts       # 数据库客户端
  ├── orchestration/      # 编排层（项目管理、工作流）
  │   ├── ProjectManager.ts
  │   ├── InteractiveSession.ts
  │   └── StateManager.ts
  ├── providers/          # 外部服务提供者
  │   └── llm/            # LLM 提供商封装
  ├── prompts/            # AI 提示词模板
  ├── roles/              # 角色实现（Role层）
  │   ├── Engineer.ts
  │   ├── QAEngineer.ts
  │   └── ProductManager.ts
  ├── services/           # 业务服务层
  ├── utils/              # 工具函数
  ├── types/              # 类型定义
  ├── cli/                # CLI 命令
  └── server.ts           # 服务器入口


⸻

2.3 分层职责强约束

Controller 层（backend/src/api/controllers/）
	•	只做：
	•	参数解析和校验（从 req.body, req.params, req.query）
	•	调用 Repository 进行数据操作
	•	调用 Role/Orchestration 进行业务编排
	•	调用 Service 进行业务服务
	•	返回 HTTP 响应（res.json, res.status）
	•	❌ 禁止业务逻辑
	•	❌ 禁止直接访问数据库（必须通过 Repository）
	•	❌ 禁止直接调用 Action（应通过 Role）

Role 层（backend/src/roles/）
	•	AI 角色的业务逻辑和决策
	•	管理 Action 的执行顺序和协调
	•	通过 Team/Orchestration 与其他角色协作
	•	使用 Context 管理角色上下文
	•	调用 Action 执行具体任务
	•	❌ 禁止直接访问数据库（应通过 Repository）
	•	❌ 禁止处理 HTTP 请求/响应

Action 层（backend/src/actions/）
	•	执行具体的 AI 任务（如 WriteCode, WritePRD）
	•	调用 LLM 生成内容
	•	解析和处理 LLM 输出
	•	保存结果到 workspace
	•	返回 IActionOutput 格式的结果
	•	❌ 禁止业务决策（应由 Role 层决定）
	•	❌ 禁止直接访问数据库（应通过 Repository）
	•	❌ 禁止处理 HTTP 请求/响应

Orchestration 层（backend/src/orchestration/）
	•	项目管理和工作流编排
	•	Team 管理多个 Role 的协作
	•	状态管理和会话管理
	•	工作流执行和跟踪
	•	❌ 禁止直接访问数据库（应通过 Repository）
	•	❌ 禁止处理 HTTP 请求/响应

Service 层（backend/src/services/）
	•	业务服务（如 RAGService, EmbeddingService）
	•	可被 Role、Action、Controller 调用
	•	不感知 HTTP / Request / Response
	•	返回明确类型结果
	•	❌ 禁止直接访问数据库（应通过 Repository）
	•	❌ 禁止处理 HTTP 请求/响应

Repository 层（backend/src/database/repositories/）
	•	只负责数据访问（DB 操作）
	•	封装 SQL 查询和事务
	•	返回领域模型对象
	•	❌ 禁止业务逻辑
	•	❌ 禁止业务判断
	•	❌ 禁止调用 Role/Action/Service

⸻

2.4 错误与日志规范
	•	使用自定义错误类型：
	•	BusinessError
	•	ValidationError
	•	❌ 禁止 throw string
	•	所有关键路径必须有日志：
	•	info：业务流程
	•	warn：异常但可恢复
	•	error：不可恢复错误

⸻

2.5 接口返回规范

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

	•	错误码必须语义化
	•	❌ 禁止只返回 500

⸻

🎨 三、Vue（前端）规则

3.1 技术栈默认假设
	•	Vue 3
	•	Composition API
	•	TypeScript
	•	Vite
	•	Pinia
	•	Vue Router

⸻

3.2 前端目录结构

frontend/src/
  ├── views/              # 页面级组件
  │   ├── application/   # 应用管理页面
  │   ├── project/        # 项目管理页面
  │   ├── config/         # 配置页面
  │   ├── dashboard/      # 仪表盘页面
  │   └── knowledge/      # 知识库页面
  ├── components/         # 组件
  │   ├── common/         # 通用 UI 组件
  │   └── SectionAdjuster.vue
  ├── stores/             # Pinia 状态管理
  │   ├── application.ts
  │   ├── project.ts
  │   └── roleAction.ts
  ├── api/                # API 请求封装
  │   └── client.ts       # API 客户端
  ├── router/             # 路由配置
  │   └── index.ts
  ├── utils/              # 工具函数
  │   └── polling.ts
  ├── App.vue             # 根组件
  ├── main.ts             # 入口文件
  └── style.css           # 全局样式


⸻

3.3 Vue 编码强约束
	•	必须使用 Composition API
	•	组件内部结构顺序建议：
	1.	props / emits
	2.	state
	3.	computed
	4.	methods
	5.	lifecycle
	•	❌ 禁止在组件中直接请求 API
	•	❌ 禁止在 template 中写复杂表达式

⸻

3.4 逻辑拆分原则
	•	页面私有逻辑 → 当前组件
	•	可复用业务逻辑 → composables
	•	跨页面状态 → Pinia

⸻

3.5 API 请求规范
	•	所有请求统一放在 services 目录
	•	组件中只调用 service 方法
	•	必须显式处理异常状态

⸻

🔁 四、前后端协作约定
	•	接口字段命名保持一致（camelCase）
	•	前端不可依赖后端隐式字段
	•	后端字段变更必须同步类型定义

⸻

🧪 五、测试意识（默认开启）
	•	Service / Composable 必须具备单测友好结构
	•	避免强耦合全局状态
	•	不强制生成测试代码，但逻辑必须“可测试”

⸻

🤖 六、AI（Cursor）行为规范

当 Cursor 生成代码时，必须遵循以下步骤：
	1.	先给出整体方案说明
	2.	明确文件结构与职责
	3.	再生成核心代码
	4.	对关键设计取舍给出说明

禁止行为
	•	一次性生成完整项目
	•	跳过关键逻辑
	•	使用“自行实现”“略”等方式逃避实现

⸻

📌 七、输出风格约定
	•	默认使用 TypeScript
	•	代码块必须完整、可运行
	•	注释解释“为什么”，而不是“做了什么”
	•	命名清晰，拒绝缩写

⸻

End of Cursor Rules