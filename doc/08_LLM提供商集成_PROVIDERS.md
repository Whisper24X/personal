# mind2build LLM 提供商集成文档

**文档版本**: v1.1  
**创建日期**: 2025-12-24  
**最后更新**: 2025-12-25

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
- gpt-4
- gpt-3.5-turbo

**实现位置**: `backend/src/providers/llm/OpenAILLM.ts`

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

**实现位置**: `backend/src/providers/llm/ZhipuLLM.ts`

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

**实现位置**: `backend/src/providers/llm/ArkLLM.ts`

### 4. Cursor Agent ✅

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

**实现位置**: `backend/src/providers/llm/CursorLLM.ts`

**使用说明**:
Cursor LLM使用Cursor Agent API，通过创建Agent来执行任务。每个Agent对应一个GitHub仓库和分支，可以在仓库中创建PR。

**注意事项**:
- Cursor Agent API不提供token使用量信息，系统会进行估算
- Agent执行可能需要较长时间（最长10分钟）
- 需要有效的Cursor API Key和GitHub仓库访问权限

## 计划中的提供商 🚧

以下提供商在配置中已定义，但实现尚未完成：

### 4. Anthropic Claude 🚧

**状态**: 🚧 计划中

**配置** (已支持，但会抛出错误):
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_MODEL=claude-3-opus-20240229
```

**计划支持的模型**:
- claude-3-opus
- claude-3-sonnet
- claude-3-haiku

### 5. Google Gemini 🚧

**状态**: 🚧 计划中

**配置** (已支持，但会抛出错误):
```env
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your-api-key
GOOGLE_MODEL=gemini-pro
```

### 6. 百度千帆 (Qianfan) 🚧

**状态**: 🚧 计划中

**配置** (已支持，但会抛出错误):
```env
LLM_PROVIDER=qianfan
QIANFAN_API_KEY=your-api-key
# 默认模型: ERNIE-Bot
```

### 7. 阿里云 DashScope (通义千问) 🚧

**状态**: 🚧 计划中

**配置** (已支持，但会抛出错误):
```env
LLM_PROVIDER=dashscope
DASHSCOPE_API_KEY=your-api-key
# 默认模型: qwen-turbo
```

### 8. Ollama (本地模型) 🚧

**状态**: 🚧 计划中

**配置** (已支持，但会抛出错误):
```env
LLM_PROVIDER=ollama
# apiKey 不需要
# 默认 baseURL: http://localhost:11434
# 默认模型: llama2
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

# 使用 Cursor Agent
LLM_PROVIDER=cursor
```

## 自定义提供商

要实现新的LLM提供商，需要：

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
  switch (config.provider) {
    case 'custom':
      return new CustomLLM(config);
    // ...
  }
}
```

3. **更新类型定义**:
在 `shared/src/types/index.ts` 中添加新的 provider 类型：
```typescript
export type LLMProvider = 'openai' | 'zhipuai' | 'ark' | 'cursor' | 'custom' | ...;
```

**注意**: Cursor LLM需要额外的配置字段（`repository`、`branchName`等），这些字段需要在`ILLMConfig`接口中定义。

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

# 通用参数
TEMPERATURE=0.7
MAX_TOKENS=8000
```

---

**参考**: 
- 完整实现见 `backend/src/providers/llm/`
- 工厂模式实现: `backend/src/providers/llm/factory.ts`
- 基础类: `backend/src/providers/llm/BaseLLM.ts`
- Cursor Agent客户端: `backend/src/utils/CursorAgentClient.ts`

**当前支持的提供商列表**:
- ✅ OpenAI
- ✅ 智谱AI (ZhipuAI)
- ✅ 火山引擎 Ark (豆包)
- ✅ Cursor Agent
