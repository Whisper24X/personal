# mind2build API 参考文档

**文档版本**: v1.0  
**创建日期**: 2025-12-24

---

## 1. CLI 命令

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
