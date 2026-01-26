# mind2build API 参考文档

**文档版本**: v1.4  
**创建日期**: 2025-12-24
**最后更新**: 2026-01-26（添加 MRD 管理 API、项目版本管理 API、Git 分支管理 API，更新所有控制器端点）

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

**请求体**:
```json
{
  "instruction": "调整指令"
}
```

#### 改进 PRD

**POST** `/api/projects/:id/prds/:prdId/improve`

根据审查报告改进PRD文档。

**请求体**:
```json
{
  "reviewContent": "审查报告内容"
}
```

### 1.4.1 MRD 管理 API

#### 生成 MRD

**POST** `/api/projects/:id/mrd`

为项目生成MRD（市场需求文档）文档。

**请求体**:
```json
{
  "requirement": "需求描述"
}
```

**响应**:
```json
{
  "success": true,
  "mrd": {
    "id": "MRD UUID",
    "content": "MRD文档内容",
    "createdAt": "2025-12-25T00:00:00Z"
  }
}
```

#### 获取 MRD 列表

**GET** `/api/projects/:id/mrds`

获取项目的所有MRD版本。

**响应**:
```json
{
  "success": true,
  "mrds": [
    {
      "id": "MRD UUID",
      "version": 1,
      "createdAt": "2025-12-25T00:00:00Z"
    }
  ]
}
```

#### 获取特定 MRD

**GET** `/api/projects/:id/mrds/:mrdId`

获取特定版本的MRD内容。

**响应**:
```json
{
  "success": true,
  "mrd": {
    "id": "MRD UUID",
    "content": "MRD文档内容",
    "version": 1,
    "createdAt": "2025-12-25T00:00:00Z"
  }
}
```

#### 调整 MRD 章节

**POST** `/api/projects/:id/mrds/:mrdId/adjust-section`

调整MRD的特定章节。

**请求体**:
```json
{
  "sectionNumber": 1,
  "instruction": "调整指令"
}
```

#### 审查 MRD

**POST** `/api/projects/:id/mrds/:mrdId/review`

审查MRD文档。

**响应**:
```json
{
  "success": true,
  "review": {
    "content": "审查报告内容",
    "createdAt": "2025-12-25T00:00:00Z"
  }
}
```

#### 改进 MRD

**POST** `/api/projects/:id/mrds/:mrdId/improve`

根据审查报告改进MRD文档。

**请求体**:
```json
{
  "reviewContent": "审查报告内容"
}
```

### 1.3.1 项目版本管理 API

#### 创建项目版本

**POST** `/api/projects/:id/versions`

为项目创建新版本。如果项目关联了Git仓库，会自动创建版本分支。

**请求体**:
```json
{
  "name": "v1.0",
  "description": "初始版本",
  "idea": "版本需求描述（可选）"
}
```

**响应**:
```json
{
  "success": true,
  "version": {
    "id": "版本UUID",
    "name": "v1.0",
    "description": "初始版本",
    "branchName": "my-project/v1.0",
    "isActive": false,
    "createdAt": "2025-12-25T00:00:00Z"
  }
}
```

**Git分支说明**:
- 如果项目关联了Git仓库，系统会自动创建版本分支
- 分支命名规则：`{projectAlias}/{versionName}`（如：`my-project/v1.0`）
- 分支创建后会自动checkout到该分支

#### 获取项目版本列表

**GET** `/api/projects/:id/versions`

获取项目的所有版本列表。

**响应**:
```json
{
  "success": true,
  "versions": [
    {
      "id": "版本UUID",
      "name": "v1.0",
      "description": "初始版本",
      "branchName": "my-project/v1.0",
      "isActive": true,
      "createdAt": "2025-12-25T00:00:00Z"
    }
  ]
}
```

#### 获取活跃版本

**GET** `/api/projects/:id/versions/active`

获取项目的当前活跃版本。

**响应**:
```json
{
  "success": true,
  "version": {
    "id": "版本UUID",
    "name": "v1.0",
    "isActive": true
  }
}
```

#### 获取版本详情

**GET** `/api/projects/:id/versions/:versionId`

获取特定版本的详细信息。

**响应**:
```json
{
  "success": true,
  "version": {
    "id": "版本UUID",
    "name": "v1.0",
    "description": "初始版本",
    "idea": "版本需求描述",
    "branchName": "my-project/v1.0",
    "isActive": true,
    "workspacePath": "/path/to/workspace",
    "createdAt": "2025-12-25T00:00:00Z",
    "updatedAt": "2025-12-25T00:00:00Z"
  }
}
```

#### 更新版本

**PUT** `/api/projects/:id/versions/:versionId`

更新版本信息。

**请求体**:
```json
{
  "name": "v1.1",
  "description": "更新后的描述"
}
```

#### 删除版本

**DELETE** `/api/projects/:id/versions/:versionId`

删除项目版本（软删除）。

**响应**:
```json
{
  "success": true,
  "message": "Version deleted successfully"
}
```

#### 激活版本

**POST** `/api/projects/:id/versions/:versionId/activate`

激活指定版本。如果项目关联了Git仓库，会自动checkout到对应的分支。

**响应**:
```json
{
  "success": true,
  "message": "Version activated successfully",
  "version": {
    "id": "版本UUID",
    "name": "v1.0",
    "isActive": true
  }
}
```

#### 获取Git分支列表

**GET** `/api/projects/:id/branches`

获取项目Git仓库的所有分支列表（仅当项目关联了Git仓库时可用）。

**响应**:
```json
{
  "success": true,
  "branches": {
    "local": ["main", "my-project/v1.0", "my-project/v2.0"],
    "remote": ["main", "my-project/v1.0"],
    "current": "my-project/v1.0"
  }
}
```

### 1.5 应用管理 API

#### 创建应用

**POST** `/api/applications`

创建新应用（应用用于组织相关项目）。创建后会自动创建默认工作流。

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

**响应**:
```json
{
  "success": true,
  "applications": [
    {
      "id": "应用UUID",
      "name": "应用名称",
      "description": "应用描述",
      "createdAt": "2025-12-25T00:00:00Z"
    }
  ]
}
```

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

### 1.5.1 应用工作流管理 API

#### 获取应用的工作流列表

**GET** `/api/applications/:applicationId/workflows`

获取应用的所有工作流配置。

**响应**:
```json
{
  "success": true,
  "workflows": [
    {
      "id": "工作流UUID",
      "name": "默认工作流",
      "description": "标准软件开发流程",
      "isDefault": true,
      "workflowConfig": { ... }
    }
  ]
}
```

#### 获取默认工作流

**GET** `/api/applications/:applicationId/workflows/default`

获取应用的默认工作流配置。

#### 创建工作流

**POST** `/api/applications/:applicationId/workflows`

为应用创建新的工作流配置。

**请求体**:
```json
{
  "name": "自定义工作流",
  "description": "工作流描述",
  "workflowConfig": {
    "roles": [
      {
        "profile": "Salesperson",
        "name": "Salesperson",
        "order": 0,
        "actions": ["WriteMRD", "MRDReview", "ImproveMRD"],
        "watch_actions": ["User"]
      }
    ]
  }
}
```

#### 更新工作流

**PUT** `/api/applications/:applicationId/workflows/:workflowId`

更新工作流配置。

#### 删除工作流

**DELETE** `/api/applications/:applicationId/workflows/:workflowId`

删除工作流配置。

#### 设置默认工作流

**POST** `/api/applications/:applicationId/workflows/:workflowId/set-default`

将指定工作流设置为应用的默认工作流。

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

获取所有LLM配置（包括提供商和角色特定配置）。

**响应**:
```json
{
  "success": true,
  "configs": [
    {
      "id": "配置UUID",
      "configScope": "provider",
      "provider": "zhipuai",
      "model": "glm-4-flash",
      "isActive": true
    }
  ]
}
```

**获取激活的 LLM 配置**

**GET** `/api/config/llm/active`

获取当前激活的LLM配置。

**获取所有提供商列表**

**GET** `/api/config/llm/providers`

获取所有可用的LLM提供商列表。

**获取特定提供商的配置**

**GET** `/api/config/llm/providers/:provider`

获取特定提供商的配置详情。

**创建或更新提供商配置**

**POST** `/api/config/llm/providers`

创建或更新LLM提供商配置。

**请求体**:
```json
{
  "provider": "zhipuai",
  "apiKey": "API密钥",
  "model": "glm-4-flash",
  "baseURL": "https://open.bigmodel.cn/api/paas/v4",
  "temperature": 0.7,
  "maxTokens": 8000
}
```

**获取特定提供商的配置（兼容接口）**

**GET** `/api/config/llm/:provider`

**创建或更新 LLM 配置**

**POST** `/api/config/llm`

创建或更新LLM配置（支持提供商和角色特定配置）。

**请求体**:
```json
{
  "configScope": "provider",  // provider 或 role
  "provider": "zhipuai",
  "roleProfile": "ProductManager",  // 角色特定配置时必需
  "apiKey": "API密钥",
  "model": "glm-4-flash",
  "baseURL": "https://open.bigmodel.cn/api/paas/v4",
  "isActive": true
}
```

**激活 LLM 配置**

**POST** `/api/config/llm/:id/activate`

激活指定的LLM配置（同一提供商只能有一个激活配置）。

**删除 LLM 配置**

**DELETE** `/api/config/llm/:id`

删除LLM配置。

#### 角色 LLM 配置

**获取所有角色 LLM 配置**

**GET** `/api/config/role-llm`

获取所有角色的LLM配置。

**获取特定角色的配置**

**GET** `/api/config/role-llm/:profile`

获取特定角色的LLM配置（如 ProductManager, Architect）。

**创建或更新角色配置**

**POST** `/api/config/role-llm/:profile`

为特定角色创建或更新LLM配置。

**请求体**:
```json
{
  "llmConfigId": "LLM配置ID",  // 引用已存在的LLM配置
  "model": "glm-4-flash"  // 可选，覆盖模型
}
```

**删除角色配置**

**DELETE** `/api/config/role-llm/:profile`

删除角色的LLM配置。

#### Prompt 配置

**获取所有 Prompt 配置**

**GET** `/api/config/prompts`

获取所有Prompt配置。

**获取分组后的 Prompt 配置**

**GET** `/api/config/prompts/grouped`

按类型分组获取Prompt配置。

**响应**:
```json
{
  "success": true,
  "grouped": {
    "prd": {
      "write_prd": { ... },
      "review_prd": { ... }
    },
    "mrd": { ... }
  }
}
```

**获取特定类型的 Prompt**

**GET** `/api/config/prompts/:type`

获取特定类型的所有Prompt（如 prd, mrd, design）。

**获取特定 Prompt**

**GET** `/api/config/prompts/:type/:key`

获取特定类型的特定Prompt（如 prd/write_prd）。

**创建或更新 Prompt**

**POST** `/api/config/prompts`

创建或更新Prompt配置。

**请求体**:
```json
{
  "type": "prd",
  "key": "write_prd",
  "content": "Prompt内容",
  "description": "Prompt描述（可选）",
  "isActive": true
}
```

**删除 Prompt**

**DELETE** `/api/config/prompts/:type/:key`

删除Prompt配置。

#### 角色和Action元数据管理

**获取所有角色**

**GET** `/api/config/roles`

获取所有已定义的角色元数据。

**创建角色**

**POST** `/api/config/roles`

创建新的角色定义（通常通过数据库迁移完成）。

**获取所有Actions**

**GET** `/api/config/actions`

获取所有已定义的Action元数据。

**创建Action**

**POST** `/api/config/actions`

创建新的Action定义（通常通过数据库迁移完成）。

**获取角色和Actions关联**

**GET** `/api/config/roles-actions`

获取角色和Actions的关联关系。

### 1.9 知识库 API

#### 创建知识库文档

**POST** `/api/projects/:projectId/knowledge-base`

为项目创建知识库文档（数据库存储）。

**请求体**:
```json
{
  "title": "API设计规范",
  "content": "文档内容...",
  "description": "API设计最佳实践",
  "tags": ["api", "design", "best-practices"]
}
```

**响应**:
```json
{
  "success": true,
  "document": {
    "id": "文档UUID",
    "title": "API设计规范",
    "createdAt": "2025-12-25T00:00:00Z"
  }
}
```

#### 获取知识库文档列表

**GET** `/api/projects/:projectId/knowledge-base`

获取项目的所有知识库文档。

**查询参数**:
- `tags`: 按标签过滤（逗号分隔）
- `limit`: 返回数量限制
- `offset`: 偏移量

#### 获取知识库文档详情

**GET** `/api/projects/:projectId/knowledge-base/:docId`

获取特定知识库文档的详情。

#### 更新知识库文档

**PUT** `/api/projects/:projectId/knowledge-base/:docId`

更新知识库文档内容。

**请求体**:
```json
{
  "title": "更新的标题",
  "content": "更新的内容",
  "tags": ["updated", "tags"]
}
```

#### 删除知识库文档

**DELETE** `/api/projects/:projectId/knowledge-base/:docId`

删除知识库文档（软删除）。

#### 搜索知识库

**POST** `/api/projects/:projectId/knowledge-base/search`

在项目的知识库中搜索相关内容（支持向量搜索）。

**请求体**:
```json
{
  "query": "支付模块设计",
  "topK": 5,
  "tags": ["api", "design"]  // 可选
}
```

**响应**:
```json
{
  "success": true,
  "results": [
    {
      "id": "文档UUID",
      "title": "支付API设计",
      "content": "相关文档片段...",
      "score": 0.85,
      "tags": ["api", "payment"]
    }
  ]
}
```

### 1.9.1 知识库文件上传 API（CLI知识输入）

#### 上传知识文件

**POST** `/api/projects/:projectId/knowledge/upload`

上传Markdown文件到项目的知识库（文件存储，用于CLI知识输入）。

**Content-Type**: `multipart/form-data`

**请求参数**:
- `file`: Markdown文件（.md格式，最大5MB）

**响应**:
```json
{
  "success": true,
  "filename": "api-design.md",
  "size": 1024,
  "uploadedAt": "2025-12-25T00:00:00Z"
}
```

#### 获取知识文件列表

**GET** `/api/projects/:projectId/knowledge/files`

获取项目上传的所有知识文件列表。

#### 获取知识文件内容

**GET** `/api/projects/:projectId/knowledge/files/:filename`

获取特定知识文件的内容。

#### 删除知识文件

**DELETE** `/api/projects/:projectId/knowledge/files/:filename`

删除知识文件。

### 1.10 工作流执行 API

工作流执行API用于控制项目的工作流执行生命周期。

#### 获取活跃工作流（管理员）

**GET** `/api/workflow/active`

获取所有正在执行的工作流（管理员功能）。

#### 获取工作流状态

**GET** `/api/workflow/:projectId/state`

获取项目当前的工作流执行状态。

**响应**:
```json
{
  "success": true,
  "state": {
    "status": "running",
    "currentRole": "ProductManager",
    "currentAction": "WritePRD",
    "completedSteps": [...],
    "pendingConfirmation": null
  }
}
```

#### 获取工作流执行记录

**GET** `/api/workflow/:projectId/execution`

获取完整的工作流执行记录。

#### 检查恢复状态

**GET** `/api/workflow/:projectId/recovery-status`

检查工作流是否需要恢复（如中断后）。

#### 启动工作流

**POST** `/api/workflow/:projectId/start`

启动项目的工作流执行。

**请求体**:
```json
{
  "workflowConfig": { ... }  // 可选，使用应用默认工作流
}
```

#### 确认并继续

**POST** `/api/workflow/:projectId/confirm`

在交互模式下确认当前步骤并继续执行。

**请求体**:
```json
{
  "action": "continue",  // continue, edit, regenerate, skip
  "modifiedContent": "修改后的内容（可选）"
}
```

#### 重置到指定角色

**POST** `/api/workflow/:projectId/reset`

重置工作流到指定的角色，重新执行。

**请求体**:
```json
{
  "roleProfile": "ProductManager",
  "actionName": "WritePRD"  // 可选
}
```

#### 暂停工作流

**POST** `/api/workflow/:projectId/pause`

暂停正在执行的工作流。

#### 恢复工作流

**POST** `/api/workflow/:projectId/resume`

恢复已暂停的工作流。

#### 重试失败的工作流

**POST** `/api/workflow/:projectId/retry`

重试失败的工作流步骤。

#### 触发恢复

**POST** `/api/workflow/:projectId/recover`

手动触发工作流恢复流程。

#### 删除工作流执行

**DELETE** `/api/workflow/:projectId`

删除项目的工作流执行记录。

### 1.10.1 工作流配置 API（已废弃，使用应用工作流API）

#### 创建工作流（已废弃）

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
| QAEngineer | WriteTestPlan, WriteTest, TestCaseReview |
| AutomationEngineer | AutomationPlanning, AutomationExecution, CoverageQualityCheck, QAConclusion |
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
