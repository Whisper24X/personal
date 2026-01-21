# mind2build API 参考文档

**文档版本**: v1.3  
**创建日期**: 2025-12-24
**最后更新**: 2026-01-21（添加 Role Action Execution API，更新为 TypeScript API 参考）

---

## 1. REST API

### 1.1 基础信息

**Base URL**: `http://localhost:3000/api`

**Content-Type**: `application/json`

**认证**: MVP阶段认证可选，生产环境需要JWT Token

### 1.2 健康检查

**GET** `/api/health`

检查服务状态。

**响应**:
```json
{
  "status": "ok",
  "service": "mind2build-api",
  "version": "1.0.0"
}
```

### 1.3 项目管理 API

#### 创建项目

**POST** `/api/projects`

创建新项目。

**请求体**:
```json
{
  "name": "项目名称",
  "idea": "项目需求描述",
  "description": "项目描述（可选）",
  "investment": 10.0,
  "nRound": 5,
  "applicationId": "应用ID（可选）",
  "version": 1,
  "gitRepositoryUrl": "https://github.com/user/project.git"
}
```

**Git仓库管理说明**:
- 如果提供 `gitRepositoryUrl`，系统会自动执行 `git clone` 拉取仓库
- 如果仓库中已有文档或代码，系统会根据 `version` 创建新分支（如 `v2`, `v3`）
- 所有生成的文档和代码会自动提交到对应版本分支

**响应**:
```json
{
  "success": true,
  "project": {
    "id": "项目UUID",
    "name": "项目名称",
    "status": "pending",
    "createdAt": "2025-12-25T00:00:00Z"
  }
}
```

#### 启动项目

**POST** `/api/projects/:id/start`

启动项目执行。

**响应**:
```json
{
  "success": true,
  "message": "Project started"
}
```

#### 获取项目状态

**GET** `/api/projects/:id`

获取项目详细信息。

**响应**:
```json
{
  "success": true,
  "project": {
    "id": "项目UUID",
    "name": "项目名称",
    "status": "running",
    "progress": 50,
    "currentRound": 2,
    "nRound": 5,
    "totalCost": 2.5
  }
}
```

#### 获取项目消息

**GET** `/api/projects/:id/messages`

获取项目的消息历史。

**查询参数**:
- `limit`: 返回数量限制（默认：100）
- `offset`: 偏移量（默认：0）

**响应**:
```json
{
  "success": true,
  "messages": [
    {
      "id": "消息UUID",
      "content": "消息内容",
      "roleType": "user",
      "sentFrom": "Salesperson",
      "causeBy": "UserRequirement",
      "createdAt": "2025-12-25T00:00:00Z"
    }
  ],
  "total": 50
}
```

#### 获取项目文档

**GET** `/api/projects/:id/documents`

获取项目生成的所有文档。

**响应**:
```json
{
  "success": true,
  "documents": [
    {
      "id": "文档UUID",
      "filename": "PRD.md",
      "docType": "prd",
      "version": 1,
      "createdAt": "2025-12-25T00:00:00Z"
    }
  ]
}
```

#### 下载项目文件

**GET** `/api/projects/:id/download/:zipPath(*)`

下载项目文件或ZIP压缩包。

### 1.3.1 Git仓库管理 API

#### Git仓库初始化

**POST** `/api/projects/:id/git/init`

初始化项目的Git仓库。

**请求体**:
```json
{
  "repositoryUrl": "https://github.com/user/project.git",
  "version": 1
}
```

**响应**:
```json
{
  "success": true,
  "message": "Git repository initialized",
  "repositoryUrl": "https://github.com/user/project.git",
  "branch": "v1"
}
```

#### 创建版本分支

**POST** `/api/projects/:id/git/branch`

为项目创建新的版本分支。

**请求体**:
```json
{
  "version": 2,
  "baseBranch": "main"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Branch created",
  "branch": "v2"
}
```

#### 提交到Git仓库

**POST** `/api/projects/:id/git/commit`

将项目文件提交到Git仓库。

**请求体**:
```json
{
  "message": "feat: 生成v1版本文档和代码",
  "version": 1,
  "files": ["MRD/", "PRD/", "DESIGN/", "CODE/"]
}
```

**响应**:
```json
{
  "success": true,
  "message": "Committed successfully",
  "commitHash": "abc123...",
  "branch": "v1"
}
```

#### 获取Git仓库信息

**GET** `/api/projects/:id/git/info`

获取项目的Git仓库信息。

**响应**:
```json
{
  "success": true,
  "repositoryUrl": "https://github.com/user/project.git",
  "currentBranch": "v1",
  "branches": ["main", "v1", "v2"],
  "lastCommit": {
    "hash": "abc123...",
    "message": "feat: 生成v1版本文档和代码",
    "author": "mind2build",
    "date": "2025-12-25T00:00:00Z"
  }
}
```

#### 列出所有项目

**GET** `/api/projects`

获取用户的所有项目列表。

**查询参数**:
- `status`: 按状态过滤（pending, running, completed, failed）
- `limit`: 返回数量限制
- `offset`: 偏移量

**响应**:
```json
{
  "success": true,
  "projects": [
    {
      "id": "项目UUID",
      "name": "项目名称",
      "status": "completed",
      "createdAt": "2025-12-25T00:00:00Z"
    }
  ],
  "total": 10
}
```

### 1.4 PRD 管理 API

#### 生成 PRD

**POST** `/api/projects/:id/prd`

为项目生成PRD文档。

**请求体**:
```json
{
  "requirement": "需求描述"
}
```

#### 获取 PRD 列表

**GET** `/api/projects/:id/prds`

获取项目的所有PRD版本。

#### 获取 PRD 版本列表

**GET** `/api/projects/:id/prds/versions`

获取PRD的所有版本信息。

#### 获取特定 PRD

**GET** `/api/projects/:id/prds/:prdId`

获取特定版本的PRD内容。

#### 删除 PRD

**DELETE** `/api/projects/:id/prds/:prdId`

软删除PRD文档。

#### 恢复 PRD

**POST** `/api/projects/:id/prds/:prdId/restore`

恢复已删除的PRD文档。

#### 获取 PRD 章节

**GET** `/api/projects/:id/prds/:prdId/sections`

获取PRD的所有章节。

#### 调整 PRD 章节

**POST** `/api/projects/:id/prds/:prdId/sections/:sectionNumber/adjust`

调整PRD的特定章节。

**请求体**:
```json
{
  "instruction": "调整指令"
}
```

#### 从工作区调整章节

**POST** `/api/projects/:id/sections/:sectionNumber/adjust`

从工作区直接调整PRD章节。

### 1.5 应用管理 API

#### 创建应用

**POST** `/api/applications`

创建新应用（应用用于组织相关项目）。

**请求体**:
```json
{
  "name": "应用名称",
  "description": "应用描述（可选）",
  "metadata": {}
}
```

**响应**:
```json
{
  "success": true,
  "application": {
    "id": "应用UUID",
    "name": "应用名称",
    "createdAt": "2025-12-25T00:00:00Z"
  }
}
```

#### 列出所有应用

**GET** `/api/applications`

获取用户的所有应用列表。

#### 获取应用详情

**GET** `/api/applications/:id`

获取应用的详细信息。

#### 更新应用

**PUT** `/api/applications/:id`

更新应用信息。

**请求体**:
```json
{
  "name": "新名称",
  "description": "新描述",
  "metadata": {}
}
```

#### 删除应用

**DELETE** `/api/applications/:id`

删除应用（软删除）。

#### 获取应用的项目列表

**GET** `/api/applications/:id/projects`

获取应用下的所有项目。

### 1.6 交互式会话 API

#### 创建交互式会话

**POST** `/api/interactive`

创建新的交互式会话。

**请求体**:
```json
{
  "name": "会话名称",
  "idea": "项目想法",
  "description": "描述（可选）",
  "investment": 10.0,
  "nRound": 5,
  "userId": "用户ID（可选）"
}
```

**响应**:
```json
{
  "sessionId": "会话UUID",
  "config": {
    "name": "会话名称",
    "idea": "项目想法",
    "investment": 10.0,
    "nRound": 5
  }
}
```

#### 获取会话信息

**GET** `/api/interactive/:sessionId`

获取交互式会话的详细信息。

#### 删除会话

**DELETE** `/api/interactive/:sessionId`

删除交互式会话。

#### 获取会话统计

**GET** `/api/interactive-stats`

获取所有会话的统计信息。

**响应**:
```json
{
  "stats": {
    "totalSessions": 10,
    "activeSessions": 2,
    "completedSessions": 8
  }
}
```

#### 轮询消息（Polling）

**GET** `/api/interactive/:sessionId/poll`

轮询获取会话的新消息（用于不支持 WebSocket 的场景）。

**查询参数**:
- `lastMessageId`: 上次获取的最后一条消息ID（可选）

**响应**:
```json
{
  "messages": [
    {
      "id": "消息UUID",
      "type": "agent_output",
      "content": "消息内容",
      "role": "Salesperson",
      "action": "WriteMRD",
      "timestamp": "2025-12-25T00:00:00Z"
    }
  ],
  "lastMessageId": "最后一条消息ID",
  "hasMore": false
}
```

#### 发送用户操作

**POST** `/api/interactive/:sessionId/action`

发送用户操作（确认、修改、跳过等）。

**请求体**:
```json
{
  "action": "continue",  // continue, edit, regenerate, skip, quit
  "modifiedContent": "修改后的内容（可选，edit 时必需）"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Action processed successfully"
}
```

**支持的操作**:
- `continue` / `c`: 确认继续
- `edit` / `e`: 修改后继续（需要提供 `modifiedContent`）
- `regenerate` / `r`: 重新生成
- `skip` / `s`: 跳过当前节点
- `quit` / `q`: 退出流程

### 1.7 WebSocket API

#### 连接 WebSocket

**WS** `ws://localhost:3000/ws`

建立 WebSocket 连接以接收实时消息更新。

**连接参数**:
- `sessionId`: 会话ID（必需）

**连接示例**:
```javascript
const ws = new WebSocket('ws://localhost:3000/ws?sessionId=your-session-id');

ws.on('open', () => {
  console.log('WebSocket connected');
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

**消息格式**:

**客户端发送**:
```json
{
  "type": "action",
  "action": "continue",  // continue, edit, regenerate, skip, quit
  "modifiedContent": "修改后的内容（可选）"
}
```

**服务器推送**:
```json
{
  "type": "agent_output",
  "id": "消息UUID",
  "role": "Salesperson",
  "action": "WriteMRD",
  "content": "消息内容",
  "files": ["MRD.md"],
  "timestamp": "2025-12-25T00:00:00Z"
}
```

**消息类型**:
- `agent_output`: Agent 输出消息
- `user_action`: 用户操作确认
- `error`: 错误消息
- `status`: 状态更新（开始、暂停、完成等）

### 1.8 配置管理 API

#### LLM 配置

**获取所有 LLM 配置**

**GET** `/api/config/llm`

**获取激活的 LLM 配置**

**GET** `/api/config/llm/active`

**获取特定提供商的配置**

**GET** `/api/config/llm/:provider`

**创建或更新 LLM 配置**

**POST** `/api/config/llm`

**请求体**:
```json
{
  "provider": "zhipuai",
  "apiKey": "API密钥",
  "model": "glm-4-flash",
  "baseURL": "https://open.bigmodel.cn/api/paas/v4",
  "isActive": true
}
```

**激活 LLM 配置**

**POST** `/api/config/llm/:id/activate`

**删除 LLM 配置**

**DELETE** `/api/config/llm/:id`

#### 角色 LLM 配置

**获取所有角色 LLM 配置**

**GET** `/api/config/role-llm`

**获取特定角色的配置**

**GET** `/api/config/role-llm/:profile`

**创建或更新角色配置**

**POST** `/api/config/role-llm/:profile`

**请求体**:
```json
{
  "llmConfigId": "LLM配置ID",
  "model": "glm-4-flash"
}
```

**删除角色配置**

**DELETE** `/api/config/role-llm/:profile`

#### Prompt 配置

**获取所有 Prompt 配置**

**GET** `/api/config/prompts`

**获取分组后的 Prompt 配置**

**GET** `/api/config/prompts/grouped`

**获取特定类型的 Prompt**

**GET** `/api/config/prompts/:type`

**获取特定 Prompt**

**GET** `/api/config/prompts/:type/:key`

**创建或更新 Prompt**

**POST** `/api/config/prompts`

**请求体**:
```json
{
  "type": "prd",
  "key": "write_prd",
  "content": "Prompt内容",
  "metadata": {}
}
```

**删除 Prompt**

**DELETE** `/api/config/prompts/:type/:key`

### 1.9 知识库 API

#### 关联知识库

**POST** `/api/projects/:projectId/knowledge-base`

为项目关联知识库和代码仓库。

**请求体**:
```json
{
  "documents": [
    {
      "name": "技术规范",
      "path": "./knowledge/tech-specs",
      "type": "markdown"
    }
  ],
  "codeRepository": {
    "name": "参考代码仓库",
    "type": "git",
    "url": "https://github.com/company/repo",
    "branch": "main",
    "languages": ["typescript", "javascript"],
    "extractPatterns": true,
    "sync": true
  },
  "apis": [
    {
      "name": "支付API",
      "path": "./knowledge/api/payment.yaml",
      "type": "openapi"
    }
  ],
  "retrieval": {
    "topK": 5,
    "threshold": 0.7,
    "rerank": true
  }
}
```

**响应**:
```json
{
  "success": true,
  "message": "Knowledge base associated successfully"
}
```

#### 检索知识库

**POST** `/api/knowledge-base/search`

检索知识库中的相关内容。

**请求体**:
```json
{
  "applicationId": "ecommerce-app",
  "query": "支付模块设计",
  "topK": 5,
  "documentTypes": ["PRD", "DESIGN"],
  "includeCode": true
}
```

**响应**:
```json
{
  "success": true,
  "results": [
    {
      "type": "document",
      "source": "PRD",
      "content": "相关文档片段...",
      "score": 0.85,
      "metadata": {
        "filename": "PRD.md",
        "version": 1
      }
    },
    {
      "type": "code",
      "source": "codeRepository",
      "content": "相关代码片段...",
      "score": 0.78,
      "metadata": {
        "file": "src/payment.ts",
        "line": 10
      }
    }
  ]
}
```

#### 更新知识库

**POST** `/api/projects/:projectId/knowledge-base/update`

手动更新知识库（将项目产出添加到知识库）。

**请求体**:
```json
{
  "documentType": "PRD",
  "content": "PRD文档内容...",
  "autoIndex": true
}
```

**响应**:
```json
{
  "success": true,
  "message": "Knowledge base updated successfully"
}
```

### 1.10 工作流 API

#### 创建工作流

**POST** `/api/v1/workflow/create`

创建多角色串联工作流。

**请求体**:
```json
{
  "name": "自定义串联工作流",
  "description": "ProductManager -> Architect -> Engineer",
  "version": "1.0",
  "chain": [
    {
      "id": "step1",
      "role": "ProductManager",
      "actions": ["WritePRD"],
      "input": {
        "source": "user",
        "mapping": {
          "idea": "${user.idea}"
        }
      },
      "output": {
        "target": "step2",
        "mapping": {
          "prd": "${output.prd}"
        }
      }
    },
    {
      "id": "step2",
      "role": "Architect",
      "actions": ["WriteDesign"],
      "input": {
        "source": "step1",
        "mapping": {
          "prd": "${step1.output.prd}"
        }
      },
      "output": {
        "target": "step3",
        "mapping": {
          "design": "${output.design}"
        }
      }
    }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "workflowId": "workflow-uuid",
  "message": "Workflow created successfully"
}
```

#### 执行工作流

**POST** `/api/v1/workflow/execute`

执行指定的工作流。

**请求体**:
```json
{
  "workflowId": "workflow-uuid",
  "input": {
    "idea": "Create a todo app"
  },
  "options": {
    "interactive": false,
    "autoUpdateKnowledge": true
  }
}
```

**响应**:
```json
{
  "success": true,
  "result": {
    "code": "...",
    "files": ["src/index.ts", "src/api.ts"]
  }
}
```

#### 调整工作流顺序

**PUT** `/api/v1/workflow/:workflowId/reorder`

调整工作流中角色的执行顺序。

**请求体**:
```json
{
  "stepOrder": ["step1", "step3", "step2"]
}
```

**响应**:
```json
{
  "success": true,
  "message": "Workflow order updated"
}
```

#### 更新输入输出映射

**PUT** `/api/v1/workflow/:workflowId/mapping`

更新工作流中某个步骤的输入输出映射。

**请求体**:
```json
{
  "stepId": "step2",
  "input": {
    "source": "step1",
    "mapping": {
      "prd": "${step1.output.prd}",
      "additional_context": "${step1.output.metadata}"
    }
  },
  "output": {
    "target": ["step3", "user"],
    "mapping": {
      "design": "${output.design}"
    }
  }
}
```

**响应**:
```json
{
  "success": true,
  "message": "Mapping updated successfully"
}
```

#### 获取工作流列表

**GET** `/api/v1/workflow`

获取所有工作流列表。

**查询参数**:
- `limit`: 返回数量限制
- `offset`: 偏移量

**响应**:
```json
{
  "success": true,
  "workflows": [
    {
      "id": "workflow-uuid",
      "name": "自定义串联工作流",
      "description": "ProductManager -> Architect -> Engineer",
      "version": "1.0",
      "createdAt": "2025-12-25T00:00:00Z"
    }
  ],
  "total": 10
}
```

#### 获取工作流详情

**GET** `/api/v1/workflow/:workflowId`

获取工作流的详细信息。

**响应**:
```json
{
  "success": true,
  "workflow": {
    "id": "workflow-uuid",
    "name": "自定义串联工作流",
    "description": "ProductManager -> Architect -> Engineer",
    "version": "1.0",
    "chain": [...],
    "createdAt": "2025-12-25T00:00:00Z",
    "updatedAt": "2025-12-25T00:00:00Z"
  }
}
```

### 1.11 角色调试 API

#### 角色独立调试

**POST** `/api/v1/role/debug`

独立运行和调试某个角色。

**请求体**:
```json
{
  "roleName": "ProductManager",
  "input": {
    "mrd": "市场研究文档内容...",
    "context": {}
  },
  "options": {
    "breakpoints": ["WritePRD"],
    "verbose": true,
    "saveLogs": true,
    "stepMode": false
  }
}
```

**响应**:
```json
{
  "success": true,
  "sessionId": "debug-session-uuid",
  "result": {
    "content": "PRD文档内容...",
    "data": {
      "type": "PRD",
      "filename": "PRD.md"
    }
  },
  "logs": [
    {
      "timestamp": "2025-12-25T00:00:00Z",
      "level": "info",
      "message": "Role started",
      "role": "ProductManager"
    }
  ],
  "metrics": {
    "executionTime": 1234,
    "tokenUsage": {
      "promptTokens": 1000,
      "completionTokens": 500,
      "totalTokens": 1500
    },
    "apiCalls": 1
  }
}
```

#### 获取调试日志

**GET** `/api/v1/role/:roleName/logs`

获取角色的调试日志。

**查询参数**:
- `sessionId`: 调试会话ID（可选）
- `limit`: 返回数量限制（默认：100）

**响应**:
```json
{
  "success": true,
  "logs": [
    {
      "timestamp": "2025-12-25T00:00:00Z",
      "level": "info",
      "message": "Role started",
      "role": "ProductManager",
      "action": "WritePRD"
    }
  ],
  "total": 50
}
```

#### 获取角色性能指标

**GET** `/api/v1/role/:roleName/metrics`

获取角色的性能指标。

**查询参数**:
- `sessionId`: 调试会话ID（可选）

**响应**:
```json
{
  "success": true,
  "metrics": {
    "executionTime": 1234,
    "tokenUsage": {
      "promptTokens": 1000,
      "completionTokens": 500,
      "totalTokens": 1500
    },
    "apiCalls": 1,
    "averageResponseTime": 1.2
  }
}
```

### 1.12 测试 API

#### 获取工程师信息

**GET** `/api/test/engineer/info`

获取Engineer角色的详细信息。

#### 测试 WriteCode Action

**POST** `/api/test/engineer/write-code`

测试WriteCode Action的执行。

**请求体**:
```json
{
  "designDoc": "设计文档内容",
  "taskDescription": "任务描述"
}
```

#### 测试 ExecuteSubtask Action

**POST** `/api/test/engineer/execute-subtask`

测试ExecuteSubtask Action的执行。

#### 自定义测试场景

**POST** `/api/test/engineer/custom`

执行自定义测试场景。

### 1.13 角色 Action 执行 API

角色 Action 执行 API 允许独立执行特定角色的特定 Action，无需运行完整工作流。

#### 执行角色 Action

**POST** `/api/projects/:projectId/roles/:roleName/actions/:actionName/execute`

独立执行特定角色的特定 Action。

**请求参数**:
- `projectId`: 项目ID
- `roleName`: 角色名称（如 Salesperson, ProductManager, Architect, Engineer, QAEngineer）
- `actionName`: Action 名称（如 WriteMRD, WritePRD, WriteDesign, WriteCode）

**请求体**:
```json
{
  "input": "用户需求或输入内容",
  "workspaceOptions": {
    "applicationId": "应用ID（必须）",
    "projectId": "项目ID",
    "version": 1
  },
  "contextMessages": []
}
```

**响应**:
```json
{
  "success": true,
  "result": {
    "content": "Action 输出内容",
    "data": {
      "type": "prd",
      "filename": "PRD.md",
      "timestamp": "2026-01-21T00:00:00Z",
      "workspaceDir": "workspace/app-id/project-id/v1/PRD/"
    }
  },
  "executionTime": 1234
}
```

**支持的角色和 Actions**:

| 角色 | 支持的 Actions |
|------|---------------|
| Salesperson | WriteMRD, MRDReview, ImproveMRD |
| ProductManager | WritePRD, PRDReview, ImprovePRD, SearchEnhancedQA |
| Architect | WriteDesign, DesignReview, ImproveDesign |
| ProjectManager | BreakdownTasks, WriteSubProjectDesign, SubProjectDesignReview |
| Engineer | WriteCode, ExecuteSubtask, RunCode, FixBug |
| QAEngineer | TestabilityReview, WriteTestPlan, WriteTest, TestCaseReview, AutomationPlanning, AutomationExecution, CoverageQualityCheck, QAConclusion |
| TeamLeader | Coordinate |
| DataAnalyst | DataAnalysis |

**功能特性**:
- 独立执行任何角色的 Action
- 灵活的输入方式（自定义输入、上下文消息、从历史自动加载）
- 基于 Action 需求自动加载上下文
- 支持 Workspace 选项进行文档组织
- 完整的错误处理和超时控制
- 结果自动保存到项目历史

---

## 2. CLI 命令

### 2.1 generate 命令

```bash
pnpm --filter backend cli generate [OPTIONS] "IDEA"
```

**参数**:
- `IDEA`: 项目需求描述（必需）

**选项**:
```bash
-o, --output <path>        输出目录
-i, --interactive          启用交互模式
-b, --budget <number>      投资预算（默认：3.0）
-r, --rounds <number>      运行轮数（默认：5）
--help                     显示帮助
```

**示例**:
```bash
# 基础使用
pnpm --filter backend cli generate "Create a 2048 game" -o ./game-2048

# 交互模式
pnpm --filter backend cli generate "Create a blog API" -i -o ./blog-api

# 完整参数
pnpm --filter backend cli generate "Create a TODO app" -i -o ./todo-app -b 10.0 -r 5
```

---

## 3. TypeScript API

Mind2Build 是一个 Node.js/TypeScript 项目。以下是核心 TypeScript API 参考。

### 3.1 Team 类

**位置**: `backend/src/orchestration/Team.ts`

```typescript
import { Team } from './orchestration/Team';
import { Context } from './core/context/Context';
import { ProductManager, Architect, Engineer } from './roles';

// 创建上下文
const context = new Context();

// 创建团队
const team = new Team(context);

// 雇佣角色
team.hire([
  new ProductManager(context),
  new Architect(context),
  new Engineer(context)
]);

// 设置预算
team.invest(10.0);

// 运行团队
const messages = await team.run('Create a TODO app', 5);
```

### 3.2 Role 类

**位置**: `backend/src/roles/Role.ts`

**可用角色**:
```typescript
import {
  Salesperson,
  ProductManager,
  Architect,
  ProjectManager,
  Engineer,
  QAEngineer,
  TeamLeader,
  DataAnalyst
} from './roles';
```

**角色方法**:
```typescript
// 观察新消息
await role.observe();

// 思考下一步行动
const hasAction = await role.think();

// 执行行动
const message = await role.act();

// 完整运行循环
const result = await role.run();
```

### 3.3 Action 类

**位置**: `backend/src/core/base/BaseAction.ts`

**自定义 Action**:
```typescript
import { BaseAction } from './core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';

export class CustomAction extends BaseAction {
  constructor() {
    super('CustomAction', 'Custom action description');
  }

  async run(input: string, options?: any): Promise<IActionOutput> {
    // 调用 LLM
    const content = await this.aask(prompt);
    
    // 保存到 workspace
    await this.saveToWorkspace('output.md', content, options);
    
    return {
      content,
      data: { type: 'custom', timestamp: new Date().toISOString() }
    };
  }
}
```

### 3.4 Context 类

**位置**: `backend/src/core/context/Context.ts`

```typescript
import { Context } from './core/context/Context';

const context = new Context();

// 获取 LLM 实例
const llm = context.llm;

// 获取成本管理器
const costManager = context.costManager;

// 设置/获取值
context.set('key', value);
const value = context.get('key');
```

### 3.5 LLM API

**位置**: `backend/src/providers/llm/`

```typescript
import { createLLM } from './providers/llm/factory';
import { ILLMConfig } from '@mind2build/shared';

// 创建 LLM 实例
const config: ILLMConfig = {
  provider: 'zhipuai',
  apiKey: 'your-api-key',
  model: 'glm-4-flash'
};

const llm = createLLM(config);

// 调用 LLM
const response = await llm.aask('What is mind2build?');
```

### 3.6 Memory API

**位置**: `backend/src/core/memory/Memory.ts`

```typescript
import { Memory } from './core/memory/Memory';
import { Message } from './core/message/Message';

const memory = new Memory();

// 添加消息
memory.add(message);

// 获取最近消息
const recent = memory.getRecent(10);

// 按 action 过滤
const prdMessages = memory.getByAction('WritePRD');

// 清空
memory.clear();
```

### 3.7 WorkspaceManager

**位置**: `backend/src/utils/WorkspaceManager.ts`

```typescript
import { WorkspaceManager, WorkspaceOptions } from './utils/WorkspaceManager';

const options: WorkspaceOptions = {
  applicationId: 'my-app',
  projectId: 'project-1',
  version: 1,
  documentType: 'PRD'
};

// 保存文件
await WorkspaceManager.saveFile('PRD.md', content, options);

// 读取文件
const content = await WorkspaceManager.readFile('PRD.md', options);

// 获取工作区目录
const dir = WorkspaceManager.getWorkspaceDir(options);
```

---

## 4. 共享类型定义

**位置**: `shared/src/types/index.ts`

### 4.1 LLM 类型

```typescript
export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'zhipuai' | 
                          'qianfan' | 'dashscope' | 'ollama' | 'ark' | 
                          'cursor' | 'deepseek';

export interface ILLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  repository?: string;      // Cursor Agent 专用
  branchName?: string;      // Cursor Agent 专用
  autoCreatePr?: boolean;   // Cursor Agent 专用
}

export interface ILLMResponse {
  content: string;
  usage: ILLMUsage;
  model: string;
}
```

### 4.2 项目类型

```typescript
export enum ProjectStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface IProject {
  id: string;
  userId: string;
  name: string;
  idea: string;
  description?: string;
  status: ProjectStatus;
  progress: number;
  nRound: number;
  currentRound: number;
  investment: number;
  totalCost: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.3 角色类型

```typescript
export enum RoleReactMode {
  REACT = 'react',
  BY_ORDER = 'by_order',
  PLAN_AND_ACT = 'plan_and_act',
}

export interface IRoleConfig {
  name: string;
  profile: string;
  goal: string;
  constraints?: string;
  description?: string;
  llm?: ILLMConfig;
}
```

### 4.4 Action 常量

```typescript
// Action 名称常量
export const ACTION_WRITE_MRD = 'WriteMRD';
export const ACTION_WRITE_PRD = 'WritePRD';
export const ACTION_WRITE_DESIGN = 'WriteDesign';
export const ACTION_BREAKDOWN_TASKS = 'BreakdownTasks';
export const ACTION_WRITE_CODE = 'WriteCode';
export const ACTION_WRITE_TEST = 'WriteTest';
// ... 更多常量
```

---

## 5. 完整示例

### 示例 1: 使用 Team 类生成项目

```typescript
import { Team } from './orchestration/Team';
import { Context } from './core/context/Context';
import { Salesperson, ProductManager, Architect, Engineer } from './roles';

async function generateProject() {
  // 1. 创建上下文
  const context = new Context();
  
  // 2. 创建团队
  const team = new Team(context);
  
  // 3. 雇佣角色
  team.hire([
    new Salesperson(context),
    new ProductManager(context),
    new Architect(context),
    new Engineer(context)
  ]);
  
  // 4. 设置预算
  team.invest(10.0);
  
  // 5. 运行
  const messages = await team.run('Create a blog system', 10);
  
  // 6. 输出结果
  console.log(`Total cost: $${context.costManager.totalCost.toFixed(2)}`);
  console.log(`Messages generated: ${messages.length}`);
}

generateProject();
```

### 示例 2: 独立执行角色 Action

```typescript
import { ProductManager } from './roles';
import { Context } from './core/context/Context';

async function generatePRD() {
  const context = new Context();
  const pm = new ProductManager(context);
  
  // 执行 WritePRD action
  const message = await pm.executeAction('WritePRD', {
    input: 'MRD 文档内容...',
    workspaceOptions: {
      applicationId: 'my-app',
      projectId: 'project-1',
      version: 1
    }
  });
  
  console.log('PRD generated:', message?.content);
}

generatePRD();
```

### 示例 3: 使用 REST API

```typescript
// 创建交互式会话
const response = await fetch('http://localhost:3000/api/interactive', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Project',
    idea: 'Create a TODO app with React',
    investment: 10.0,
    nRound: 5
  })
});

const { sessionId } = await response.json();

// 连接 WebSocket 接收实时更新
const ws = new WebSocket(`ws://localhost:3000/ws?sessionId=${sessionId}`);

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

---

**更多信息**: 请参考源码 `backend/src/` 目录
