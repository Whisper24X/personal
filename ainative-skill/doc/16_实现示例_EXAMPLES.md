# mind2build 实现示例文档

**文档版本**: v1.2  
**创建日期**: 2025-12-24  
**最后更新**: 2026-01-26（更新Actions数量为30个，拆分QA工作流）

---

## 目录

1. [基础使用示例](#1-基础使用示例)
2. [进阶使用示例](#2-进阶使用示例)
3. [扩展开发示例](#3-扩展开发示例)
4. [实际项目示例](#4-实际项目示例)

---

## 1. 基础使用示例

### 1.1 创建简单项目

**CLI 方式**:
```bash
# 基础命令
pnpm --filter backend cli generate "Create a 2048 game"

# 带参数
pnpm --filter backend cli generate "Create a TODO app" \
  --application-id app001 \
  --project-id proj001 \
  --interactive
```

**TypeScript API 方式**:
```typescript
import { InteractiveSession } from './orchestration/InteractiveSession';
import { WorkspaceManager } from './utils/WorkspaceManager';

// 创建交互式会话
const session = new InteractiveSession({
  applicationId: 'app001',
  projectId: 'proj001',
  requirement: 'Create a calculator CLI tool'
});

// 启动会话
await session.start();

// 等待完成
await session.waitForCompletion();
```

**预期输出**:
```
workspace/app001/proj001/v1/
├── docs/
│   ├── MRD.md
│   ├── PRD.md
│   └── DESIGN.md
├── src/
│   ├── calculator.ts
│   └── index.ts
├── tests/
│   └── calculator.test.ts
└── README.md
```

### 1.2 数据分析任务

```typescript
import { DataAnalyst } from './roles/DataAnalyst';
import { Environment } from './core/Environment';

// 创建环境
const env = new Environment();

// 创建数据分析师角色
const analyst = new DataAnalyst({
  name: 'DataAnalyst',
  profile: 'Data Analyst',
  goal: 'Perform data analysis tasks'
});

// 添加到环境
env.addRole(analyst);

// 运行分析任务
const result = await analyst.run(
  "Run data analysis on dataset, include a plot"
);

console.log(`Analysis completed: ${result}`);
```

**输出示例**:
- 数据加载和预处理代码（TypeScript）
- 统计分析结果
- 可视化图表（使用Chart.js或D3.js）

### 1.3 增量开发

```bash
# 在已有项目上添加新功能（使用相同applicationId和projectId）
pnpm --filter backend cli generate "Add user authentication feature" \
  --application-id app001 \
  --project-id proj001 \
  --version 2
```

```typescript
// TypeScript API 方式
import { InteractiveSession } from './orchestration/InteractiveSession';

// 使用新版本号进行增量开发
const session = new InteractiveSession({
  applicationId: 'app001',
  projectId: 'proj001',
  version: 2,  // 新版本
  requirement: 'Add login and registration pages'
});

await session.start();
```

---

## 2. 进阶使用示例

### 2.1 自定义团队配置

```typescript
import { Team } from './core/Team';
import { ProductManager, Architect, Engineer, QAEngineer } from './roles';
import { Environment } from './core/Environment';
import { LLMConfig } from './providers/llm/LLMConfig';

// 创建LLM配置
const llmConfig = new LLMConfig({
  provider: 'openai',
  model: 'gpt-4-turbo',
  apiKey: process.env.OPENAI_API_KEY
});

// 创建环境
const env = new Environment();

// 创建团队
const team = new Team(env);
team.addRole(new ProductManager({ name: 'Alice', llmConfig }));
team.addRole(new Architect({ name: 'Bob', llmConfig }));
team.addRole(new Engineer({ name: 'Charlie', llmConfig }));
team.addRole(new QAEngineer({ name: 'David', llmConfig }));

// 运行项目
await team.run({
  requirement: 'Create a blog system with user management',
  applicationId: 'app001',
  projectId: 'proj001'
});
```

### 2.2 使用特定LLM提供商

**OpenAI**:
```bash
# .env 文件
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4-turbo
```

**ZhipuAI（智谱AI）**:
```bash
LLM_PROVIDER=zhipuai
ZHIPUAI_API_KEY=your-api-key
ZHIPUAI_MODEL=glm-4-flash
```

**DeepSeek**:
```bash
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-api-key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

**本地Ollama**:
```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

**TypeScript配置**:
```typescript
import { LLMConfig } from './providers/llm/LLMConfig';

// OpenAI配置
const openaiConfig = new LLMConfig({
  provider: 'openai',
  model: 'gpt-4-turbo',
  apiKey: process.env.OPENAI_API_KEY
});

// ZhipuAI配置（通过OpenAICompatibleLLM）
const zhipuaiConfig = new LLMConfig({
  provider: 'zhipuai',
  model: 'glm-4-flash',
  apiKey: process.env.ZHIPUAI_API_KEY,
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
});
```

### 2.3 成本控制示例

```typescript
import { Team } from './core/Team';
import { CostManager } from './utils/CostManager';

const team = new Team(env);
team.addRole(new ProductManager());
team.addRole(new Architect());
team.addRole(new Engineer());

// 设置严格的预算
const costManager = new CostManager({ maxBudget: 2.0 });  // 只投资 $2

try {
  await team.run({
    requirement: 'Create a complex web app',
    applicationId: 'app001',
    projectId: 'proj001'
  });
} catch (error) {
  if (error instanceof Error && error.message.includes('Budget exhausted')) {
    console.log(`Budget exhausted: ${error.message}`);
    console.log(`Total cost: $${costManager.totalCost.toFixed(2)}`);
    console.log(`Tokens used: ${costManager.totalTokens}`);
  }
}
```

---

## 3. 扩展开发示例

### 3.1 自定义角色

```typescript
import { BaseRole } from './roles/BaseRole';
import { BaseAction } from './actions/BaseAction';
import { Message } from './core/Message';

// 自定义Action
class CustomAction extends BaseAction {
  name = 'CustomAction';
  
  async execute(input: any, context: any): Promise<any> {
    const prompt = `Perform custom task: ${input.task}`;
    const result = await this.llm.aask(prompt);
    return { result };
  }
}

// 自定义Role
class CustomRole extends BaseRole {
  name = 'Custom';
  profile = 'Custom Role';
  goal = 'Perform custom tasks';
  
  constructor(config?: any) {
    super(config);
    this.setActions([CustomAction]);
    this.watch(['ACTION_SOME_OTHER']);  // 订阅其他动作
  }
}

// 使用自定义角色
const team = new Team(env);
team.addRole(new CustomRole());
team.addRole(new ProductManager());
await team.run({
  requirement: 'Your task',
  applicationId: 'app001',
  projectId: 'proj001'
});
```

### 3.2 自定义工作流

**固定顺序工作流**:
```typescript
import { BaseRole } from './roles/BaseRole';
import { RoleReactMode } from './core/RoleReactMode';
import { WritePRD, WriteDesign, WriteCode } from './actions';

class SequentialRole extends BaseRole {
  constructor(config?: any) {
    super(config);
    this.setActions([WritePRD, WriteDesign, WriteCode]);
    this.reactMode = RoleReactMode.BY_ORDER;  // 按顺序执行
  }
}
```

**动态工作流**:
```typescript
import { RoleThinker } from './core/RoleThinker';

class DynamicRole extends BaseRole {
  async think(context: any): Promise<boolean> {
    // 根据上下文动态选择动作
    const lastMessage = context.memory.getLastMessage();
    
    if (lastMessage.content.includes('需要设计')) {
      context.todo = WriteDesign;
      return true;
    } else if (lastMessage.content.includes('需要代码')) {
      context.todo = WriteCode;
      return true;
    }
    
    return false;
  }
}
```

### 3.3 自定义LLM提供商

```python
from mind2build.provider.base_llm import BaseLLM
from mind2build.configs.llm_config import LLMConfig

class CustomLLM(BaseLLM):
    """自定义LLM提供商"""
    
    async def _achat_completion(
        self,
        messages: list[dict],
        **kwargs
    ) -> dict:
        # 实现你的LLM调用逻辑
        response = await your_custom_api_call(messages)
        return response
    
    async def acompletion_text(
        self,
        messages: list[dict],
        **kwargs
    ) -> str:
        result = await self._achat_completion(messages, **kwargs)
        return result["content"]

// 使用（通过OpenAICompatibleLLM架构）
// 如果API兼容OpenAI格式，可以直接使用OpenAICompatibleLLM
import { OpenAICompatibleLLM } from './providers/llm/OpenAICompatibleLLM';

const customLLM = new OpenAICompatibleLLM({
  provider: 'custom',
  model: 'your-model',
  apiKey: 'your-api-key',
  baseUrl: 'https://your-api-endpoint.com/v1'
});
```

---

## 4. 实际项目示例

### 4.1 创建 Web 应用

```typescript
async function createBlogSystem() {
  /**创建完整的博客系统*/
  
  const requirement = `
    创建一个博客系统，包含以下功能：
    1. 用户注册和登录
    2. 发布和编辑博客文章
    3. 评论功能
    4. 标签和分类
    5. 搜索功能
    使用 TypeScript + Express + PostgreSQL
  `;
  
  const team = new Team(env);
  team.addRole(new ProductManager());
  team.addRole(new Architect());
  team.addRole(new Engineer());
  team.addRole(new QAEngineer());
  
  const result = await team.run({
    requirement,
    applicationId: 'blog_app',
    projectId: 'blog_v1'
  });
  
  return result;
}
```

**生成的项目结构**:
```
workspace/blog_app/blog_v1/v1/
├── docs/
│   ├── MRD.md
│   ├── PRD.md
│   ├── DESIGN.md
│   └── API.md
├── src/
│   ├── models/
│   ├── controllers/
│   ├── routes/
│   └── middleware/
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
└── README.md
```

### 4.2 数据分析流程

```typescript
async function dataAnalysisPipeline() {
  /**完整的数据分析流程*/
  
  const analyst = new DataAnalyst();
  
  // 步骤1：加载和探索数据
  await analyst.run({
    requirement: `
      加载 data.csv 文件，执行以下分析：
      1. 显示前5行数据
      2. 显示数据统计信息
      3. 检查缺失值
    `
  });
  
  // 步骤2：数据清洗
  await analyst.run({
    requirement: `
      清洗数据：
      1. 删除重复行
      2. 填充缺失值（数值列用均值，分类列用众数）
      3. 移除异常值
    `
  });
  
  // 步骤3：数据可视化
  await analyst.run({
    requirement: `
      创建以下可视化：
      1. 各列的分布直方图
      2. 相关性热力图
      3. 关键特征的箱线图
      保存所有图表
    `
  });
  
  // 步骤4：建模
  await analyst.run({
    requirement: `
      使用机器学习进行分类：
      1. 划分训练集和测试集（80/20）
      2. 训练模型
      3. 评估模型性能（准确率、混淆矩阵）
      4. 显示特征重要性
    `
  });
}
```

### 4.3 CLI 工具开发

```typescript
async function createCLITool() {
  /**创建命令行工具*/
  
  const requirement = `
    创建一个任务管理CLI工具，功能包括：
    1. 添加任务（add）
    2. 列出任务（list）
    3. 完成任务（done）
    4. 删除任务（delete）
    5. 数据存储在本地JSON文件
    使用 TypeScript + Commander.js
  `;
  
  const session = new InteractiveSession({
    applicationId: 'cli_app',
    projectId: 'task_cli',
    requirement
  });
  
  await session.start();
  console.log(`CLI tool created at: ${session.workspacePath}`);
}
```

**使用生成的工具**:
```bash
cd workspace/cli_app/task_cli/v1/src
pnpm install

# 编译
pnpm build

# 使用
node dist/index.js add "Complete mind2build documentation"
node dist/index.js list
node dist/index.js done 1
```

### 4.4 增量迭代示例

```typescript
// 第一次：创建基础版本
const v1Session = new InteractiveSession({
  applicationId: 'todo_app',
  projectId: 'todo_v1',
  version: 1,
  requirement: 'Create a simple TODO app with add/list functions'
});
await v1Session.start();

// 第二次：添加功能
const v2Session = new InteractiveSession({
  applicationId: 'todo_app',
  projectId: 'todo_v1',
  version: 2,
  requirement: 'Add edit and delete functions to TODO app'
});
await v2Session.start();

// 第三次：添加数据库
const v3Session = new InteractiveSession({
  applicationId: 'todo_app',
  projectId: 'todo_v1',
  version: 3,
  requirement: 'Replace JSON storage with PostgreSQL database'
});
await v3Session.start();

// 第四次：添加Web界面
const v4Session = new InteractiveSession({
  applicationId: 'todo_app',
  projectId: 'todo_v1',
  version: 4,
  requirement: 'Add Express web interface for TODO app'
});
await v4Session.start();
```

---

## 5. 调试和故障排除

### 5.1 启用详细日志

```typescript
import { logger } from './utils/logger';

// 设置日志级别
logger.level = 'debug';

// 或通过环境变量
process.env.LOG_LEVEL = 'DEBUG';
```

### 5.2 处理 API 错误

```typescript
import { LLMAPIError } from './providers/llm/errors';

try {
  const result = await team.run({
    requirement: 'Your idea',
    applicationId: 'app001',
    projectId: 'proj001'
  });
} catch (error) {
  if (error instanceof LLMAPIError) {
    console.error(`LLM API error: ${error.message}`);
    console.log('Please check:');
    console.log('1. API key is valid');
    console.log('2. Network connection is stable');
    console.log('3. API quota is not exhausted');
  }
}
```

### 5.3 恢复中断的项目

```typescript
import { InteractiveSession } from './orchestration/InteractiveSession';

// 从会话ID恢复
const sessionId = 'existing-session-id';
const session = await InteractiveSession.load(sessionId);

// 继续运行
await session.resume();
```

---

## 6. 性能优化技巧

### 6.1 减少 Token 使用

```typescript
// 限制历史消息数量
role.context.memory.maxLength = 50;  // 只保留最近50条消息

// 使用更小的模型
const llmConfig = new LLMConfig({
  provider: 'openai',
  model: 'gpt-3.5-turbo'  // 而不是 gpt-4
});
```

### 6.2 并发优化

```typescript
// 增加并发角色数
const team = new Team(env);
team.addRole(new ProductManager());
team.addRole(new Architect());
team.addRole(new Engineer());  // 可以并发执行
team.addRole(new Engineer());  // 多个工程师并发
team.addRole(new Engineer());
```

### 6.3 缓存LLM响应

```typescript
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, string>({ max: 100 });

async function cachedLLMCall(prompt: string): Promise<string> {
  if (cache.has(prompt)) {
    return cache.get(prompt)!;
  }
  const result = await llm.aask(prompt);
  cache.set(prompt, result);
  return result;
}
```

---

## 7. 最佳实践

### 7.1 清晰的需求描述

```typescript
// ❌ 不好的需求
await session.start({ requirement: 'make an app' });

// ✅ 好的需求
await session.start({
  requirement: `
    创建一个图书管理系统，包括：
    1. 图书的增删改查
    2. 借阅记录管理
    3. 用户管理（管理员、普通用户）
    4. 图书搜索功能
    技术栈：TypeScript + Express + PostgreSQL + React
  `
});
```

### 7.2 合理的预算设置

```typescript
// 根据项目复杂度设置预算
const budgets = {
  simpleProject: 2.0,    // 简单CLI工具
  mediumProject: 5.0,    // 中等Web应用
  complexProject: 10.0   // 复杂企业应用
};
```

### 7.3 使用配置文件

```bash
# .env 文件
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4-turbo
OPENAI_API_KEY=${OPENAI_API_KEY}
TEMPERATURE=0.7

WORKSPACE_PATH=./workspace

MAX_BUDGET=10.0
```

---

## 8. 常见问题

**Q: 如何查看成本使用情况？**
```typescript
console.log(`Total cost: $${costManager.totalCost.toFixed(2)}`);
console.log(`Tokens used: ${costManager.totalTokens}`);
```

**Q: 如何更换LLM提供商？**
```bash
# 修改 .env 文件
vim .env
# 更改 LLM_PROVIDER 和相关配置
# 例如：LLM_PROVIDER=zhipuai
```

**Q: 生成的代码质量不理想怎么办？**
- 使用更强大的模型（如 GPT-4、GLM-4）
- 提供更详细的需求描述
- 启用QAEngineer（3步测试设计）和AutomationEngineer（4步自动化测试）的完整QA工作流
- 使用增量模式逐步优化
- 使用RunCode和FixBug Actions进行代码验证和修复

---

## 9. 更新记录

### v1.1 (2026-01-21)
- 更新版本号和最后更新日期
- 将所有Python代码示例更新为TypeScript/Node.js示例
- 更新CLI命令从Python CLI改为pnpm CLI
- 更新LLM提供商配置方式（从YAML改为.env）
- 更新项目结构示例（从Python项目结构改为TypeScript项目结构）
- 更新角色和Actions示例，反映当前实现（30个Actions，QAEngineer和AutomationEngineer分离的QA工作流等）
- 更新工作流示例，反映TypeScript实现

---

**更多示例**: 请参考 `examples/` 目录  
**问题反馈**: GitHub Issues
