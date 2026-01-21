# mind2build 配置管理文档

**文档版本**: v1.2  
**创建日期**: 2025-12-24
**最后更新**: 2026-01-21（更新LLM提供商配置，添加DeepSeek）

## 1. 配置文件结构

**注意**: 系统使用 TypeScript 配置文件（`backend/src/config/config.ts`）和 PostgreSQL 数据库存储配置，而非 YAML 配置文件。以下为配置说明。

### 1.1 系统配置（TypeScript）

**位置**: `backend/src/config/config.ts`

```typescript
export interface SystemConfig {
  server: {
    port: number;
    host: string;
  };
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
  };
  llm: {
    defaultProvider: 'openai' | 'zhipuai' | 'ark' | 'cursor';
    defaultModel: string;
    timeout: number;
    maxRetries: number;
  };
  workspace: {
    path: string;
    maxSize: number;
  };
  cost: {
    defaultBudget: number;
    warningThreshold: number;
  };
}
```

### 1.2 LLM 配置（数据库存储）

LLM 配置存储在 PostgreSQL 数据库的 `llm_configs` 表中，支持系统默认配置和角色特定配置。

**系统默认配置**:
- 通过环境变量设置：`LLM_PROVIDER`, `ZHIPUAI_API_KEY`, `ZHIPUAI_MODEL` 等
- 存储在数据库 `llm_configs` 表中（`role_name` 为 NULL）

**角色特定配置**:
- 通过 API 或数据库直接配置
- 存储在数据库 `llm_configs` 表中（`role_name` 为具体角色名称）
- 优先级高于系统默认配置

### 1.3 知识库配置

**项目级知识库配置**（通过 API 配置）:

```typescript
interface KnowledgeBaseConfig {
  applicationId: string;
  version: string;
  documents?: Array<{
    name: string;
    path: string;
    type: string;
  }>;
  codeRepository?: {
    name: string;
    type: 'git' | 'local';
    url?: string;
    path?: string;
    branch?: string;
    languages?: string[];
    extractPatterns?: boolean;
    sync?: boolean;
  };
  apis?: Array<{
    name: string;
    path: string;
    type: string;
  }>;
  retrieval: {
    topK: number;
    threshold: number;
    rerank: boolean;
  };
}
```

### 1.4 工作流配置

**工作流配置**（通过 API 或 YAML 文件）:

```yaml
# workflows/multi-role-chain.yaml
name: 多角色串联工作流
description: ProductManager -> Architect -> Engineer
version: "1.0"

workflow:
  chain:
    - id: step1
      role: ProductManager
      actions: [WritePRD]
      input:
        source: user
        mapping:
          idea: ${user.idea}
      output:
        target: step2
        mapping:
          prd: ${output.prd}
    # ... 更多步骤
```

### 1.5 工作空间配置

```typescript
interface WorkspaceConfig {
  path: string;  // 默认: ./workspace
  maxSize: number;  // 默认: 10GB
}
```

### 1.6 Git 配置

```typescript
interface GitConfig {
  enabled: boolean;  // 是否启用Git管理
  autoInit: boolean;  // 自动初始化Git仓库
  autoCommit: boolean;  // 自动提交到Git仓库
  branchPrefix: string;  // 版本分支前缀（默认 "v"）
}
```

### 1.7 成本配置

```typescript
interface CostConfig {
  defaultBudget: number;  // 默认预算（默认: 10.0）
  warningThreshold: number;  // 警告阈值（默认: 0.8）
}
```

## 2. 环境变量

```bash
# LLM 提供商选择
export LLM_PROVIDER="zhipuai"  # openai, zhipuai, ark, deepseek, cursor

# 智谱AI配置（默认）
export ZHIPUAI_API_KEY="your-api-key"
export ZHIPUAI_MODEL="glm-4-flash"
export ZHIPUAI_BASE_URL="https://open.bigmodel.cn/api/paas/v4"

# OpenAI配置（备用）
export OPENAI_API_KEY="sk-xxx"
export OPENAI_MODEL="gpt-4-turbo"
export OPENAI_BASE_URL="https://api.openai.com/v1"

# 火山引擎 Ark配置
export ARK_API_KEY="your-api-key"
export ARK_MODEL="doubao-1-5-pro-32k-250115"
export ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"

# DeepSeek配置
export DEEPSEEK_API_KEY="your-api-key"
export DEEPSEEK_MODEL="deepseek-chat"
export DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"

# Cursor Agent配置
export CURSOR_API_KEY="your-api-key"
export CURSOR_MODEL="auto"
export CURSOR_REPOSITORY="https://github.com/owner/repo"

# 数据库配置
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="mind2build_db"
export DB_USER="postgres"
export DB_PASSWORD="your-password"

# 工作空间配置
export WORKSPACE_PATH="./workspace"

# 服务器配置
export PORT="3000"
export HOST="0.0.0.0"

# 成本配置
export DEFAULT_BUDGET="10.0"

# 代理（国内用户）
export HTTP_PROXY="http://127.0.0.1:7890"
export HTTPS_PROXY="http://127.0.0.1:7890"

# 日志
export LOG_LEVEL="INFO"  # DEBUG, INFO, WARNING, ERROR
```

## 3. 配置加载

### 3.1 TypeScript 配置加载

```typescript
// backend/src/config/config.ts
import { defaultConfig } from './config';

// 使用默认配置
const config = defaultConfig;

// 从环境变量覆盖
config.llm.defaultProvider = process.env.LLM_PROVIDER || 'zhipuai';
config.llm.defaultModel = process.env.LLM_MODEL || 'glm-4-flash';
```

### 3.2 LLM 配置加载（数据库）

```typescript
// 从数据库加载LLM配置
const llmConfig = await LLMConfigRepository.getActiveConfig();
// 或获取角色特定配置
const roleConfig = await LLMConfigRepository.getByRole('ProductManager');
```

### 3.3 知识库配置加载

```typescript
// 通过API配置知识库
POST /api/projects/:projectId/knowledge-base
{
  "documents": [...],
  "codeRepository": {...},
  "apis": [...]
}
```

### 3.4 工作流配置加载

```typescript
// 通过API创建工作流
POST /api/v1/workflow/create
{
  "name": "...",
  "chain": [...]
}

// 或从YAML文件加载
import yaml from 'yaml';
const workflowConfig = yaml.parse(fs.readFileSync('workflow.yaml', 'utf8'));
```

## 4. 多 LLM 配置示例

### 4.1 智谱AI（默认）

```bash
export LLM_PROVIDER="zhipuai"
export ZHIPUAI_API_KEY="your-api-key"
export ZHIPUAI_MODEL="glm-4-flash"
```

### 4.2 OpenAI

```bash
export LLM_PROVIDER="openai"
export OPENAI_API_KEY="sk-xxx"
export OPENAI_MODEL="gpt-4-turbo"
```

### 4.3 火山引擎 Ark

```bash
export LLM_PROVIDER="ark"
export ARK_API_KEY="your-api-key"
export ARK_MODEL="doubao-1-5-pro-32k-250115"
```

### 4.4 DeepSeek

```bash
export LLM_PROVIDER="deepseek"
export DEEPSEEK_API_KEY="your-api-key"
export DEEPSEEK_MODEL="deepseek-chat"
export DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
```

### 4.5 Cursor Agent

```bash
export LLM_PROVIDER="cursor"
export CURSOR_API_KEY="your-api-key"
export CURSOR_REPOSITORY="https://github.com/owner/repo"
```

## 5. 知识库配置示例

### 5.1 关联文档知识库

```typescript
POST /api/projects/:projectId/knowledge-base
{
  "documents": [
    {
      "name": "技术规范",
      "path": "./knowledge/tech-specs",
      "type": "markdown"
    },
    {
      "name": "架构最佳实践",
      "path": "./knowledge/architecture",
      "type": "markdown"
    }
  ]
}
```

### 5.2 关联代码仓库

```typescript
POST /api/projects/:projectId/knowledge-base
{
  "codeRepository": {
    "name": "参考代码仓库",
    "type": "git",
    "url": "https://github.com/company/repo",
    "branch": "main",
    "languages": ["typescript", "javascript"],
    "extractPatterns": true,
    "sync": true
  }
}
```

## 6. 工作流配置示例

### 6.1 多角色串联工作流

```yaml
name: 快速原型工作流
description: ProductManager -> Architect -> Engineer
version: "1.0"

workflow:
  chain:
    - id: step1
      role: ProductManager
      actions: [WritePRD]
      input:
        source: user
        mapping:
          idea: ${user.idea}
      output:
        target: step2
        mapping:
          prd: ${output.prd}
    - id: step2
      role: Architect
      actions: [WriteDesign]
      input:
        source: step1
        mapping:
          prd: ${step1.output.prd}
      output:
        target: step3
        mapping:
          design: ${output.design}
    - id: step3
      role: Engineer
      actions: [WriteCode]
      input:
        source: [step1, step2]
        mapping:
          prd: ${step1.output.prd}
          design: ${step2.output.design}
      output:
        target: user
        mapping:
          code: ${output.code}
```

## 7. 角色特定 LLM 配置

### 7.1 通过 API 配置

```typescript
POST /api/config/role-llm/ProductManager
{
  "llmConfigId": "llm-config-uuid",
  "model": "glm-4"
}
```

### 7.2 配置优先级

1. 角色特定配置（最高优先级）
2. 系统默认配置
3. 环境变量配置（最低优先级）

---

**参考**: 
- 完整配置见 `backend/src/config/config.ts`
- LLM配置存储在数据库 `llm_configs` 表
- 知识库配置通过 API 动态配置
- 工作流配置支持 YAML 文件和 API 两种方式
