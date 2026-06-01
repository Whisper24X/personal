# mind2build LLM 提供商集成文档

**文档版本**: v1.2  
**创建日期**: 2025-12-24  
**最后更新**: 2026-01-21（更新统一 OpenAICompatibleLLM 架构说明，添加 DeepSeek 提供商）

## 架构说明

### 统一的 OpenAI 兼容架构

Mind2Build 使用统一的 `OpenAICompatibleLLM` 类处理所有 OpenAI 兼容的 API 提供商。这种设计简化了代码结构，因为大多数 LLM 提供商都采用了 OpenAI 兼容的 API 格式。

**核心类**:
- `BaseLLM` - 抽象基类，定义 LLM 接口
- `OpenAICompatibleLLM` - 统一处理所有 OpenAI 兼容 API 的实现类
- `CursorLLM` - 特殊实现，用于 Cursor Agent API（非 OpenAI 兼容）

**工厂函数** (`factory.ts`):
```typescript
export function createLLM(config: ILLMConfig): BaseLLM {
  // CursorLLM 使用完全不同的 API（Cursor Agent API）
  if (config.provider === 'cursor') {
    return new CursorLLM(config);
  }
  
  // 所有其他提供商使用 OpenAI 兼容 API
  // 提供商特定的 baseURL 由 OpenAICompatibleLLM 内部处理
  return new OpenAICompatibleLLM(config);
}
```

**默认 baseURL 配置**:

`OpenAICompatibleLLM` 会根据提供商自动选择正确的 baseURL：
- `openai`: `https://api.openai.com/v1`
- `zhipuai`: `https://open.bigmodel.cn/api/paas/v4`
- `ark`: `https://ark.cn-beijing.volces.com/api/v3`
- `deepseek`: `https://api.deepseek.com`
- 其他提供商可通过 `baseURL` 配置项自定义

---

## 已实现的提供商 ✅

### 1. OpenAI ✅

**状态**: ✅ 已实现

**配置**:
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选，默认使用官方API
```

**支持的模型**:
- gpt-4-turbo (默认)
- gpt-4o
- gpt-4
- gpt-3.5-turbo

**实现**: 通过 `OpenAICompatibleLLM` 类实现

### 2. 智谱 AI (ZhipuAI) ✅

**状态**: ✅ 已实现（默认提供商）

**配置**:
```env
LLM_PROVIDER=zhipuai
ZHIPUAI_API_KEY=your-api-key
ZHIPUAI_MODEL=glm-4-flash  # 默认模型
ZHIPUAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4  # 可选
```

**支持的模型**:
- glm-4-flash (默认，推荐)
- glm-4
- glm-3-turbo

**实现**: 通过 `OpenAICompatibleLLM` 类实现

**参考文档**: 详见 [智谱AI配置指南](./20_智谱AI配置指南_GLM.md)

### 3. 火山引擎 Ark (豆包) ✅

**状态**: ✅ 已实现

**配置**:
```env
LLM_PROVIDER=ark
ARK_API_KEY=your-api-key
ARK_MODEL=doubao-1-5-pro-32k-250115  # 默认模型
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3  # 默认
```

**支持的模型**:
- doubao-1-5-pro-32k-250115 (默认)
- 其他豆包系列模型

**实现**: 通过 `OpenAICompatibleLLM` 类实现

### 4. DeepSeek ✅

**状态**: ✅ 已实现

**配置**:
```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-api-key
DEEPSEEK_MODEL=deepseek-chat  # 默认模型
DEEPSEEK_BASE_URL=https://api.deepseek.com  # 默认
```

**支持的模型**:
- deepseek-chat (默认)
- deepseek-coder

**实现**: 通过 `OpenAICompatibleLLM` 类实现

### 5. Cursor Agent ✅

**状态**: ✅ 已实现

**配置**:
```env
LLM_PROVIDER=cursor
CURSOR_API_KEY=your-api-key
CURSOR_MODEL=auto  # 或指定模型名称
CURSOR_REPOSITORY=https://github.com/owner/repo  # GitHub仓库URL
CURSOR_BRANCH_NAME=cursor/feature-branch  # 可选，默认自动生成
CURSOR_AUTO_CREATE_PR=true  # 可选，默认true
```

**支持的模型**:
- auto (默认，由Cursor自动选择)
- 其他Cursor支持的模型

**特殊配置**:
- `repository`: 必需，GitHub仓库URL（支持多种格式：`https://github.com/owner/repo`、`owner/repo`、`git@github.com:owner/repo.git`）
- `branchName`: 可选，分支名称（默认自动生成）
- `autoCreatePr`: 可选，是否自动创建PR（默认：true）

**实现**: 通过独立的 `CursorLLM` 类实现（非 OpenAI 兼容 API）

**使用说明**:
Cursor LLM使用Cursor Agent API，通过创建Agent来执行任务。每个Agent对应一个GitHub仓库和分支，可以在仓库中创建PR。

**注意事项**:
- Cursor Agent API不提供token使用量信息，系统会进行估算
- Agent执行可能需要较长时间（最长10分钟）
- 需要有效的Cursor API Key和GitHub仓库访问权限

---

## 通过 OpenAICompatibleLLM 支持的提供商

以下提供商可以通过 `OpenAICompatibleLLM` 类使用，只需配置正确的 `baseURL`：

### 6. Anthropic Claude

**配置**:
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_MODEL=claude-3-opus-20240229
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
```

**支持的模型**:
- claude-3-opus
- claude-3-sonnet
- claude-3-haiku

### 7. Google Gemini

**配置**:
```env
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your-api-key
GOOGLE_MODEL=gemini-pro
```

### 8. 百度千帆 (Qianfan)

**配置**:
```env
LLM_PROVIDER=qianfan
QIANFAN_API_KEY=your-api-key
QIANFAN_MODEL=ERNIE-Bot
```

### 9. 阿里云 DashScope (通义千问)

**配置**:
```env
LLM_PROVIDER=dashscope
DASHSCOPE_API_KEY=your-api-key
DASHSCOPE_MODEL=qwen-turbo
```

### 10. Ollama (本地模型)

**配置**:
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
# apiKey 不需要
```

**使用场景**: 本地部署，无需API密钥

## 提供商选择

系统默认使用智谱AI (`zhipuai`)，可以通过环境变量 `LLM_PROVIDER` 切换：

```env
# 使用 OpenAI
LLM_PROVIDER=openai

# 使用智谱AI (默认)
LLM_PROVIDER=zhipuai

# 使用火山引擎 Ark
LLM_PROVIDER=ark

# 使用 DeepSeek
LLM_PROVIDER=deepseek

# 使用 Cursor Agent
LLM_PROVIDER=cursor
```

---

## 自定义提供商

### 方式一：使用 OpenAICompatibleLLM（推荐）

如果新提供商的 API 兼容 OpenAI 格式，只需添加 baseURL 配置：

1. **更新类型定义**:
在 `shared/src/types/index.ts` 中添加新的 provider 类型：
```typescript
export type LLMProvider = 'openai' | 'zhipuai' | 'ark' | 'deepseek' | 'cursor' | 'custom' | ...;
```

2. **在 OpenAICompatibleLLM 中添加默认 baseURL**（可选）:
```typescript
// 在 OpenAICompatibleLLM.ts 的 getDefaultBaseURL() 方法中添加
case 'custom':
  return 'https://api.custom-provider.com/v1';
```

3. **配置环境变量**:
```env
LLM_PROVIDER=custom
CUSTOM_API_KEY=your-api-key
CUSTOM_MODEL=model-name
CUSTOM_BASE_URL=https://api.custom-provider.com/v1
```

### 方式二：实现独立的 LLM 类

如果 API 不兼容 OpenAI 格式（如 Cursor Agent），需要：

1. **继承 BaseLLM 类**:
```typescript
import { BaseLLM } from './BaseLLM';
import { ILLMConfig, ILLMResponse } from '@mind2build/shared';

export class CustomLLM extends BaseLLM {
  constructor(config: ILLMConfig) {
    super(config);
  }

  async completion(prompt: string): Promise<ILLMResponse> {
    // 实现 API 调用逻辑
    const response = await this.callAPI(prompt);
    return {
      content: response.content,
      usage: response.usage,
      model: this.config.model,
    };
  }
}
```

2. **在 factory.ts 中注册**:
```typescript
import { CustomLLM } from './CustomLLM';

export function createLLM(config: ILLMConfig): BaseLLM {
  if (config.provider === 'custom') {
    return new CustomLLM(config);
  }
  // 其他提供商使用 OpenAICompatibleLLM
  return new OpenAICompatibleLLM(config);
}
```

---

## 配置参考

**完整配置示例** (`.env` 文件):
```env
# LLM 提供商选择
LLM_PROVIDER=zhipuai

# 智谱AI配置
ZHIPUAI_API_KEY=your-zhipuai-api-key
ZHIPUAI_MODEL=glm-4-flash
ZHIPUAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# OpenAI配置（备用）
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo

# DeepSeek配置（备用）
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-chat

# 通用参数
TEMPERATURE=0.7
MAX_TOKENS=8000
```

---

**参考**: 
- 完整实现见 `backend/src/providers/llm/`
- 工厂模式实现: `backend/src/providers/llm/factory.ts`
- 基础类: `backend/src/providers/llm/BaseLLM.ts`
- OpenAI 兼容实现: `backend/src/providers/llm/OpenAICompatibleLLM.ts`
- Cursor LLM 实现: `backend/src/providers/llm/CursorLLM.ts`
- Cursor Agent 客户端: `backend/src/utils/CursorAgentClient.ts`
- LLM 管理器: `backend/src/providers/llm/LLMManager.ts`

**当前支持的提供商列表**:
- ✅ OpenAI
- ✅ 智谱AI (ZhipuAI)
- ✅ 火山引擎 Ark (豆包)
- ✅ DeepSeek
- ✅ Cursor Agent
- ⚙️ Anthropic Claude（通过 OpenAICompatibleLLM）
- ⚙️ Google Gemini（通过 OpenAICompatibleLLM）
- ⚙️ 百度千帆（通过 OpenAICompatibleLLM）
- ⚙️ 阿里云 DashScope（通过 OpenAICompatibleLLM）
- ⚙️ Ollama（通过 OpenAICompatibleLLM）
