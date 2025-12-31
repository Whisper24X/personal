# mind2build API 参考文档

**文档版本**: v1.1  
**创建日期**: 2025-12-24
**最后更新**: 2025-12-25

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
  "applicationId": "应用ID（可选）"
}
```

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

### 1.7 配置管理 API

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

### 1.8 测试 API

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

---

## 2. CLI 命令

### 1.1 mind2build 主命令

```bash
mind2build [OPTIONS] IDEA
```

**参数**:
- `IDEA`: 项目需求描述（必需）

**选项**:
```bash
--investment FLOAT          投资预算（默认：3.0）
--n-round INTEGER          运行轮数（默认：5）
--code-review             启用代码审查（默认：True）
--run-tests               启用测试（默认：False）
--project-name TEXT       项目名称
--inc                     增量模式
--project-path TEXT       项目路径（增量模式）
--init-config            初始化配置文件
--help                    显示帮助
```

**示例**:
```bash
# 基础使用
mind2build "Create a 2048 game"

# 完整参数
mind2build "Create a blog system" \
  --investment 10.0 \
  --n-round 10 \
  --code-review \
  --project-name blog

# 增量开发
mind2build "Add user authentication" \
  --inc \
  --project-path ./blog
```

---

## 2. Python API

### 2.1 generate_repo()

**函数签名**:
```python
def generate_repo(
    idea: str,
    investment: float = 3.0,
    n_round: int = 5,
    code_review: bool = True,
    run_tests: bool = False,
    implement: bool = True,
    project_name: str = "",
    inc: bool = False,
    project_path: str = "",
    reqa_file: str = "",
    max_auto_summarize_code: int = 0,
    recover_path: str = None,
) -> str
```

**参数说明**:
- `idea`: 项目需求描述
- `investment`: 预算金额（美元）
- `n_round`: 最大运行轮数
- `code_review`: 是否启用代码审查
- `project_name`: 项目名称
- `inc`: 是否增量模式
- `project_path`: 项目路径（增量模式）

**返回值**: 项目路径字符串

**示例**:
```python
from mind2build.software_company import generate_repo

# 基础使用
path = generate_repo("Create a TODO app")
print(f"Project at: {path}")

# 完整参数
path = generate_repo(
    idea="Create a calculator",
    investment=5.0,
    n_round=8,
    code_review=True,
    project_name="calculator"
)
```

### 2.2 Team 类

**类定义**:
```python
class Team(BaseModel):
    env: Optional[Environment] = None
    investment: float = 10.0
    idea: str = ""
```

**方法**:

#### hire()
```python
def hire(self, roles: list[Role]) -> None
```
雇佣角色到团队。

**示例**:
```python
from mind2build.team import Team
from mind2build.roles import ProductManager, Architect

team = Team()
team.hire([ProductManager(), Architect()])
```

#### invest()
```python
def invest(self, investment: float) -> None
```
设置预算。

#### run()
```python
async def run(
    self,
    n_round: int = 3,
    idea: str = "",
    send_to: str = "",
    auto_archive: bool = True
) -> list[Message]
```
运行团队。

**示例**:
```python
import asyncio

result = asyncio.run(team.run(
    n_round=10,
    idea="Create a web app"
))
```

### 2.3 Role 类

**基础角色**:
```python
from mind2build.roles import (
    ProductManager,
    Architect,
    Engineer,
    QAEngineer,
    TeamLeader,
)
```

**初始化**:
```python
pm = ProductManager(name="Alice")
arch = Architect(name="Bob")
```

**方法**:
```python
async def run(self, with_message: Optional[Message] = None) -> Optional[Message]
```

### 2.4 DataInterpreter

**类定义**:
```python
from mind2build.roles.di.data_interpreter import DataInterpreter
```

**使用**:
```python
import asyncio

async def analyze():
    di = DataInterpreter()
    result = await di.run("Analyze Iris dataset")
    return result

asyncio.run(analyze())
```

---

## 3. 配置 API

### 3.1 Config 类

**加载配置**:
```python
from mind2build.config2 import Config

# 默认配置
config = Config.default()

# 从文件加载
config = Config.from_yaml("~/.mind2build/config2.yaml")
```

**配置项**:
```python
config.llm.api_type = "openai"
config.llm.model = "gpt-4-turbo"
config.llm.api_key = "your-key"
config.workspace.path = "./workspace"
```

### 3.2 Context 类

```python
from mind2build.context import Context

ctx = Context(config=config)
llm = ctx.llm()  # 获取 LLM 实例
```

---

## 4. LLM API

### 4.1 BaseLLM

**方法**:

#### aask()
```python
async def aask(
    self,
    prompt: str,
    system_msgs: Optional[list[str]] = None,
    **kwargs
) -> str
```

**示例**:
```python
from mind2build.provider.openai_api import OpenAILLM

llm = OpenAILLM(config)
response = await llm.aask("What is mind2build?")
```

#### acompletion()
```python
async def acompletion(
    self,
    messages: list[dict],
    timeout: int = 60,
    **kwargs
) -> dict
```

### 4.2 创建 LLM 实例

```python
from mind2build.provider.llm_provider_registry import create_llm_instance
from mind2build.configs.llm_config import LLMConfig

config = LLMConfig(
    api_type="openai",
    model="gpt-4-turbo",
    api_key="your-key"
)

llm = create_llm_instance(config)
```

---

## 5. Action API

### 5.1 自定义 Action

```python
from mind2build.actions import Action

class CustomAction(Action):
    name: str = "CustomAction"
    
    async def run(self, *args, **kwargs):
        prompt = f"Task: {args[0]}"
        result = await self._aask(prompt)
        return result
```

### 5.2 ActionNode

```python
from mind2build.actions.action_node import ActionNode

node = ActionNode(
    key="output",
    expected_type=str,
    instruction="Generate output",
    example="Example output"
)

result = await node.fill(context, llm)
```

---

## 6. Memory API

### 6.1 Memory 操作

```python
from mind2build.memory import Memory

memory = Memory()

# 添加消息
memory.add(message)

# 获取最近消息
recent = memory.get(k=10)

# 按条件过滤
by_role = memory.get_by_role("assistant")
by_action = memory.get_by_action(WritePRD)

# 清空
memory.clear()
```

---

## 7. 工具 API

### 7.1 Browser

```python
from mind2build.tools.libs.browser import Browser

browser = Browser()
content = await browser.browse("https://example.com")
results = await browser.search("query")
```

### 7.2 Editor

```python
from mind2build.tools.libs.editor import Editor

editor = Editor()
await editor.write("file.txt", "content")
content = await editor.read("file.txt")
```

### 7.3 Terminal

```python
from mind2build.tools.libs.terminal import Terminal

terminal = Terminal()
output = await terminal.run_command("ls -la")
```

---

## 8. 成本管理 API

### 8.1 CostManager

```python
from mind2build.utils.cost_manager import CostManager

cm = CostManager()
cm.max_budget = 10.0

# 更新成本
cm.update_cost("gpt-4", usage_dict)

# 检查成本
print(f"Total: ${cm.total_cost:.2f}")
print(f"Tokens: {cm.total_tokens}")
```

---

## 9. 序列化 API

### 9.1 保存和恢复

```python
from pathlib import Path

# 保存
team.serialize(stg_path=Path("./storage/team"))

# 恢复
team = Team.deserialize(
    stg_path=Path("./storage/team"),
    context=ctx
)
```

---

## 10. 常用工具函数

### 10.1 any_to_str()

```python
from mind2build.utils.common import any_to_str

# 类转字符串
str_name = any_to_str(WritePRD)  # "WritePRD"

# 实例转字符串
str_name = any_to_str(role)  # "ProductManager"
```

### 10.2 import_class()

```python
from mind2build.utils.common import import_class

cls = import_class("WritePRD", "mind2build.actions.write_prd")
instance = cls()
```

---

## 完整示例

### 示例 1: 完整的团队配置

```python
from mind2build.team import Team
from mind2build.roles import ProductManager, Architect, Engineer
from mind2build.context import Context
from mind2build.config2 import Config
import asyncio

async def main():
    # 1. 配置
    config = Config.default()
    config.llm.model = "gpt-4-turbo"
    
    # 2. 创建上下文
    ctx = Context(config=config)
    
    # 3. 创建团队
    team = Team(context=ctx)
    team.hire([
        ProductManager(name="Alice"),
        Architect(name="Bob"),
        Engineer(name="Charlie")
    ])
    
    # 4. 设置预算
    team.invest(10.0)
    
    # 5. 运行
    result = await team.run(
        n_round=10,
        idea="Create a blog system"
    )
    
    # 6. 结果
    print(f"Cost: ${team.cost_manager.total_cost:.2f}")
    return result

asyncio.run(main())
```

### 示例 2: 数据分析

```python
from mind2build.roles.di.data_interpreter import DataInterpreter
import asyncio

async def analyze():
    di = DataInterpreter()
    
    result = await di.run("""
    Load Iris dataset and:
    1. Show statistics
    2. Create correlation heatmap
    3. Train a classifier
    """)
    
    return result

asyncio.run(analyze())
```

---

**更多信息**: 请参考源码和在线文档
