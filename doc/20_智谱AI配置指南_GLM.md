# 智谱AI（GLM）配置指南

**文档版本**: v1.1  
**创建日期**: 2025-12-25  
**最后更新**: 2026-01-21

---

## 目录

1. [智谱AI简介](#1-智谱ai简介)
2. [获取API密钥](#2-获取api密钥)
3. [配置智谱AI](#3-配置智谱ai)
4. [模型选择](#4-模型选择)
5. [使用示例](#5-使用示例)
6. [常见问题](#6-常见问题)
7. [最佳实践](#7-最佳实践)

---

## 1. 智谱AI简介

### 1.1 什么是智谱AI

智谱AI（ZhipuAI）是由清华大学知识工程实验室（KEG）团队研发的大语言模型服务平台，提供以下核心能力：

- **GLM-4 系列**: 最新一代大语言模型
- **高性价比**: 相比国外模型，价格更具优势
- **中文优化**: 对中文理解和生成能力优秀
- **多模态支持**: 支持文本、图像等多种模态

### 1.2 为什么选择智谱AI

**优势**:
- ✅ **国产模型**: 数据安全，服务稳定
- ✅ **价格优惠**: 相比 GPT-4 更经济
- ✅ **中文能力强**: 特别适合中文项目
- ✅ **API 兼容**: 接口设计与 OpenAI 类似
- ✅ **响应速度快**: 国内网络访问快

**适用场景**:
- 中文软件项目开发
- 对成本敏感的项目
- 需要符合国内数据合规要求的项目

---

## 2. 获取API密钥

### 2.1 注册账号

1. 访问智谱AI开放平台：https://open.bigmodel.cn/
2. 点击"注册"或"登录"
3. 完成账号注册（支持手机号、邮箱）
4. 实名认证（可选，但建议完成以提高配额）

### 2.2 创建API密钥

1. 登录后进入控制台
2. 点击左侧菜单"API管理" → "API Keys"
3. 点击"创建新的API Key"
4. 设置密钥名称和描述
5. 复制生成的API Key（格式类似：`xxx.xxxxxxxxx`）

**重要提示**:
- ⚠️ API Key 只显示一次，请妥善保存
- ⚠️ 不要将 API Key 提交到版本控制
- ⚠️ 定期轮换 API Key 以提高安全性

### 2.3 查看配额

在控制台可以查看：
- 当前剩余额度
- 使用历史
- 每日调用次数限制

**新用户福利**: 通常会获得一定的免费额度用于测试

---

## 3. 配置智谱AI

### 3.1 环境变量配置

#### 方法1: 使用 .env 文件（推荐）

在项目根目录创建 `.env` 文件：

```bash
# 复制配置模板
cp config/env.template .env

# 编辑 .env 文件
nano .env
```

配置内容：

```bash
# LLM 提供商设置为智谱AI
LLM_PROVIDER=zhipuai

# 智谱AI配置
ZHIPUAI_API_KEY=b3796c2b64c34be692cc5ff35292b5f1.6dY0OHKL5BvRHQEn
ZHIPUAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPUAI_MODEL=glm-4-flash
```

#### 方法2: 系统环境变量

**Linux/macOS**:
```bash
export ZHIPUAI_API_KEY="your-api-key"
export ZHIPUAI_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
export ZHIPUAI_MODEL="glm-4-flash"
```

**Windows (PowerShell)**:
```powershell
$env:ZHIPUAI_API_KEY="your-api-key"
$env:ZHIPUAI_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
$env:ZHIPUAI_MODEL="glm-4-flash"
```

### 3.2 配置文件方式（可选）

如果需要通过配置文件方式，可以在项目根目录创建 `config/llm.config.json`:

```json
{
  "provider": "zhipuai",
  "zhipuai": {
    "apiKey": "your-api-key",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
    "model": "glm-4-flash",
    "timeout": 60,
    "maxRetry": 3,
    "temperature": 0.7
  }
}
```

**注意**: 推荐使用 `.env` 文件方式，更符合12-Factor App原则，也更安全。

### 3.3 配置参数说明

| 参数 | 说明 | 默认值 | 必填 |
|------|------|--------|------|
| `ZHIPUAI_API_KEY` | API 密钥 | - | ✅ |
| `ZHIPUAI_BASE_URL` | API 基础地址 | https://open.bigmodel.cn/api/paas/v4 | ❌ |
| `ZHIPUAI_MODEL` | 模型名称 | glm-4-flash | ❌ |
| `TEMPERATURE` | 温度参数（0-1） | 0.7 | ❌ |
| `MAX_TOKENS` | 最大输出 Token 数 | 4000 | ❌ |
| `REQUEST_TIMEOUT` | 请求超时（秒） | 60 | ❌ |
| `MAX_RETRY` | 最大重试次数 | 3 | ❌ |

---

## 4. 模型选择

### 4.1 可用模型

智谱AI 提供多个模型版本：

| 模型名称 | 说明 | 适用场景 | 价格 |
|---------|------|---------|------|
| **glm-4-flash** | 快速版本 | 日常对话、快速响应 | 💰 |
| **glm-4** | 标准版本 | 通用任务 | 💰💰 |
| **glm-4-plus** | 增强版本 | 复杂推理、长文本 | 💰💰💰 |
| **glm-4-air** | 轻量版本 | 简单任务、高并发 | 💰 |

### 4.2 模型对比

#### glm-4-flash（推荐用于开发）
- ✅ **速度快**: 响应时间短
- ✅ **成本低**: 适合开发测试
- ✅ **适用**: 代码生成、文档编写
- ⚠️ **限制**: 复杂推理能力略弱

#### glm-4（推荐用于生产）
- ✅ **平衡性好**: 性能和成本的平衡
- ✅ **通用性强**: 适合大多数场景
- ✅ **稳定可靠**: 生产环境首选

#### glm-4-plus（高级场景）
- ✅ **能力最强**: 复杂推理和长文本处理
- ✅ **上下文长**: 支持更长的上下文
- ⚠️ **成本高**: 适合关键任务

#### glm-4-air（轻量场景）
- ✅ **极速响应**: 延迟最低
- ✅ **高并发**: 适合大量请求
- ⚠️ **能力有限**: 适合简单任务

### 4.3 模型切换

在配置文件中修改 `ZHIPUAI_MODEL` 参数：

```bash
# 开发环境：使用 flash 版本
ZHIPUAI_MODEL=glm-4-flash

# 生产环境：使用标准版本
ZHIPUAI_MODEL=glm-4

# 高级场景：使用 plus 版本
ZHIPUAI_MODEL=glm-4-plus
```

---

## 5. 使用示例

### 5.1 基础使用

智谱AI通过`OpenAICompatibleLLM`统一架构集成，无需单独实现：

```typescript
// backend/src/providers/llm/OpenAICompatibleLLM.ts
import { OpenAICompatibleLLM } from './OpenAICompatibleLLM';
import { LLMConfig } from './LLMConfig';

// 创建智谱AI配置
const zhipuaiConfig = new LLMConfig({
  provider: 'zhipuai',
  model: process.env.ZHIPUAI_MODEL || 'glm-4-flash',
  apiKey: process.env.ZHIPUAI_API_KEY!,
  baseUrl: process.env.ZHIPUAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
});

// 使用OpenAICompatibleLLM
const zhipuaiLLM = new OpenAICompatibleLLM(zhipuaiConfig);

// 调用
const result = await zhipuaiLLM.aask('你好，请介绍一下你自己');
console.log(result);
```

### 5.2 在角色中使用

```typescript
// backend/src/roles/ProductManager.ts
import { BaseRole } from './BaseRole';
import { WritePRD } from '../actions';
import { LLMConfig } from '../providers/llm/LLMConfig';

export class ProductManager extends BaseRole {
  constructor(config?: any) {
    super({
      name: 'Alice',
      profile: 'Product Manager',
      goal: 'Create comprehensive PRD',
      llmConfig: config?.llmConfig || new LLMConfig({
        provider: 'zhipuai',
        model: process.env.ZHIPUAI_MODEL || 'glm-4-flash',
        apiKey: process.env.ZHIPUAI_API_KEY!,
        baseUrl: process.env.ZHIPUAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
      }),
      ...config
    });
    this.setActions([WritePRD]);
  }
}
```

### 5.3 动态切换模型

```typescript
// 根据任务类型选择模型
function selectModel(taskType: string): string {
  switch (taskType) {
    case 'code_generation':
      return 'glm-4';  // 代码生成用标准版
    case 'documentation':
      return 'glm-4-flash';  // 文档用快速版
    case 'architecture':
      return 'glm-4-plus';  // 架构设计用增强版
    default:
      return 'glm-4-flash';
  }
}
```

---

## 6. 常见问题

### Q1: API Key 无效怎么办？

**A**: 检查以下几点：
1. API Key 格式是否正确（应包含 `.` 分隔符）
2. 是否已激活（在控制台查看状态）
3. 是否已过期或被删除
4. 账户余额是否充足

**解决方法**:
```bash
# 测试 API Key 是否有效
curl -X POST "https://open.bigmodel.cn/api/paas/v4/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-4-flash",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Q2: 请求超时怎么办？

**A**: 可能的原因和解决方法：
1. **网络问题**: 检查网络连接
2. **模型负载高**: 稍后重试或切换模型
3. **超时设置过短**: 增加 `REQUEST_TIMEOUT`

```bash
# 增加超时时间
REQUEST_TIMEOUT=120
```

### Q3: 返回结果质量不理想？

**A**: 调整参数：
1. **提高温度**: 增加创造性（0.7-0.9）
2. **降低温度**: 提高确定性（0.3-0.5）
3. **增加 Token**: 允许更长的输出
4. **优化提示词**: 提供更详细的指令

```bash
# 调整参数
TEMPERATURE=0.8
MAX_TOKENS=8000
```

### Q4: 成本控制如何做？

**A**: 成本优化建议：
1. **使用 flash 版本**: 开发和测试阶段
2. **设置预算限制**: `MAX_BUDGET`
3. **优化提示词**: 减少不必要的 Token
4. **缓存结果**: 相同请求使用缓存

```typescript
// 实现简单缓存
const cache = new Map();

async function cachedLLMCall(prompt: string): Promise<string> {
  if (cache.has(prompt)) {
    return cache.get(prompt);
  }
  const result = await llm.aask(prompt);
  cache.set(prompt, result);
  return result;
}
```

### Q5: 如何处理速率限制？

**A**: 实现重试和退避策略：

```typescript
async function callWithRetry(fn: Function, maxRetry = 3) {
  for (let i = 0; i < maxRetry; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'RATE_LIMIT' && i < maxRetry - 1) {
        const delay = Math.pow(2, i) * 1000;  // 指数退避
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

---

## 7. 最佳实践

### 7.1 开发环境配置

```bash
# 开发环境使用 flash 版本
NODE_ENV=development
LLM_PROVIDER=zhipuai
ZHIPUAI_MODEL=glm-4-flash
MAX_BUDGET=1.0
LOG_LEVEL=debug
```

### 7.2 生产环境配置

```bash
# 生产环境使用标准版本
NODE_ENV=production
LLM_PROVIDER=zhipuai
ZHIPUAI_MODEL=glm-4
MAX_BUDGET=10.0
LOG_LEVEL=info
```

### 7.3 提示词优化

**好的提示词示例**:
```typescript
const prompt = `
你是一个专业的产品经理。请根据以下需求编写产品需求文档（PRD）：

需求：${requirement}

请按照以下结构输出：
1. 产品概述
2. 目标用户
3. 核心功能
4. 验收标准

输出格式：Markdown
`;
```

**不好的提示词**:
```typescript
const prompt = `写一个PRD`;  // 太简短，信息不足
```

### 7.4 错误处理

```typescript
async function safeAsk(llm: ZhipuLLM, prompt: string): Promise<string> {
  try {
    return await llm.aask(prompt);
  } catch (error) {
    if (error.code === 'INSUFFICIENT_QUOTA') {
      console.error('余额不足，请充值');
      throw new Error('LLM quota exceeded');
    } else if (error.code === 'INVALID_API_KEY') {
      console.error('API Key 无效');
      throw new Error('Invalid API key');
    } else {
      console.error('未知错误:', error);
      throw error;
    }
  }
}
```

### 7.5 监控和日志

```typescript
import { logger } from '../utils/logger';

async function loggedLLMCall(prompt: string): Promise<string> {
  const startTime = Date.now();
  
  try {
    const result = await llm.aask(prompt);
    const duration = Date.now() - startTime;
    
    logger.info('LLM call succeeded', {
      model: llm.model,
      promptLength: prompt.length,
      resultLength: result.length,
      duration,
      cost: calculateCost(prompt, result)
    });
    
    return result;
  } catch (error) {
    logger.error('LLM call failed', {
      model: llm.model,
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}
```

### 7.6 性能优化

**1. 批量请求**:
```typescript
// 并发处理多个请求
async function batchProcess(prompts: string[]): Promise<string[]> {
  return await Promise.all(
    prompts.map(prompt => llm.aask(prompt))
  );
}
```

**2. 流式响应**（如果支持）:
```typescript
async function* streamResponse(prompt: string) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ ...payload, stream: true })
  });
  
  for await (const chunk of response.body) {
    yield chunk;
  }
}
```

---

## 8. 安全建议

### 8.1 API Key 管理

```bash
# ❌ 不要这样做
const apiKey = "b3796c2b64c34be692cc5ff35292b5f1.6dY0OHKL5BvRHQEn";

# ✅ 正确做法
const apiKey = process.env.ZHIPUAI_API_KEY;
```

### 8.2 敏感信息过滤

```typescript
function sanitizeLog(message: string): string {
  // 移除 API Key
  return message.replace(/[a-f0-9]{32}\.[A-Za-z0-9]+/g, '***API_KEY***');
}

logger.info(sanitizeLog(`Using API Key: ${apiKey}`));
```

### 8.3 速率限制保护

```typescript
class RateLimiter {
  private requests: number[] = [];
  private maxRequests = 60;  // 每分钟最大请求数
  
  async checkLimit(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < 60000);
    
    if (this.requests.length >= this.maxRequests) {
      const waitTime = 60000 - (now - this.requests[0]);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}
```

---

## 9. 参考资源

### 官方文档
- **官网**: https://open.bigmodel.cn/
- **API 文档**: https://open.bigmodel.cn/dev/api
- **控制台**: https://open.bigmodel.cn/console

### 相关文档
- [08_LLM提供商集成_PROVIDERS.md](./08_LLM提供商集成_PROVIDERS.md)
- [13_配置管理_CONFIG.md](./13_配置管理_CONFIG.md)
- [04_系统架构文档_ARCHITECTURE.md](./04_系统架构文档_ARCHITECTURE.md)

---

**文档维护**: 随着智谱AI更新持续更新  
**反馈渠道**: GitHub Issues

---

## 10. 更新记录

### v1.1 (2026-01-21)
- 更新版本号和最后更新日期
- 更新代码示例，说明智谱AI通过`OpenAICompatibleLLM`统一架构集成
- 更新配置方式说明，强调使用`.env`文件方式
- 更新角色使用示例，使用`BaseRole`和`LLMConfig`
- 移除硬编码的API Key示例

---

**配置完成后，你就可以开始使用智谱AI作为默认的LLM提供商了！** 🎉

**注意**: 智谱AI通过`OpenAICompatibleLLM`统一架构集成，与其他OpenAI兼容的提供商（如DeepSeek、Ark等）使用相同的接口，简化了集成和使用。

