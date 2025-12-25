# mind2build 实现示例文档

**文档版本**: v1.0  
**创建日期**: 2025-12-24  
**更新日期**: 2025-12-24

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
mind2build "Create a 2048 game"

# 带参数
mind2build "Create a TODO app" \
  --investment 5.0 \
  --n-round 10 \
  --code-review \
  --project-name todo_app
```

**Python API 方式**:
```python
from mind2build.software_company import generate_repo

# 基础调用
project_path = generate_repo("Create a snake game")
print(f"Project generated at: {project_path}")

# 完整参数
project_path = generate_repo(
    idea="Create a calculator CLI tool",
    investment=5.0,
    n_round=8,
    code_review=True,
    project_name="calculator",
    inc=False
)
```

**预期输出**:
```
workspace/
└── calculator/
    ├── PRD.md
    ├── design.md
    ├── main.py
    ├── calculator.py
    ├── tests/
    │   └── test_calculator.py
    └── README.md
```

### 1.2 数据分析任务

```python
import asyncio
from mind2build.roles.di.data_interpreter import DataInterpreter

async def analyze_data():
    # 创建数据解释器
    di = DataInterpreter()
    
    # 运行分析任务
    result = await di.run(
        "Run data analysis on sklearn Iris dataset, include a plot"
    )
    
    print(f"Analysis completed: {result}")

# 运行
asyncio.run(analyze_data())
```

**输出示例**:
- 数据加载和预处理代码
- 统计分析结果
- 可视化图表（iris_analysis.png）

### 1.3 增量开发

```bash
# 在已有项目上添加新功能
mind2build "Add user authentication feature" \
  --inc \
  --project-path ./existing_project
```

```python
# Python API 方式
from mind2build.software_company import generate_repo

project_path = generate_repo(
    idea="Add login and registration pages",
    inc=True,
    project_path="./my_web_app"
)
```

---

## 2. 进阶使用示例

### 2.1 自定义团队配置

```python
from mind2build.team import Team
from mind2build.roles import ProductManager, Architect, Engineer
from mind2build.context import Context
from mind2build.config2 import Config

# 创建配置
config = Config.default()
config.llm.model = "gpt-4-turbo"
config.llm.api_key = "your-api-key"

# 创建上下文
ctx = Context(config=config)

# 创建团队
team = Team(context=ctx)
team.hire([
    ProductManager(name="Alice"),
    Architect(name="Bob"),
    Engineer(name="Charlie")
])

# 设置预算
team.invest(10.0)

# 运行项目
import asyncio
asyncio.run(team.run(
    n_round=10,
    idea="Create a blog system with user management"
))
```

### 2.2 使用特定LLM提供商

**OpenAI**:
```yaml
# config2.yaml
llm:
  api_type: "openai"
  model: "gpt-4-turbo"
  base_url: "https://api.openai.com/v1"
  api_key: "${OPENAI_API_KEY}"
```

**Claude**:
```yaml
llm:
  api_type: "anthropic"
  model: "claude-3-opus"
  api_key: "${ANTHROPIC_API_KEY}"
```

**本地Ollama**:
```yaml
llm:
  api_type: "ollama"
  model: "llama2"
  base_url: "http://localhost:11434"
```

### 2.3 成本控制示例

```python
from mind2build.team import Team
from mind2build.utils.cost_manager import CostManager

team = Team()
team.hire([ProductManager(), Architect(), Engineer()])

# 设置严格的预算
team.invest(2.0)  # 只投资 $2

try:
    await team.run(idea="Create a complex web app")
except NoMoneyException as e:
    print(f"Budget exhausted: {e}")
    print(f"Total cost: ${team.cost_manager.total_cost:.2f}")
    print(f"Tokens used: {team.cost_manager.total_tokens}")
```

---

## 3. 扩展开发示例

### 3.1 自定义角色

```python
from mind2build.roles.role import Role
from mind2build.actions import Action

class CustomAction(Action):
    """自定义动作"""
    name: str = "CustomAction"
    
    async def run(self, *args, **kwargs):
        prompt = f"Perform custom task: {args[0]}"
        result = await self._aask(prompt)
        return result

class CustomRole(Role):
    """自定义角色"""
    name: str = "Custom"
    profile: str = "Custom Role"
    goal: str = "Perform custom tasks"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_actions([CustomAction])
        self._watch([SomeOtherAction])  # 订阅其他动作

# 使用自定义角色
team = Team()
team.hire([CustomRole(), ProductManager()])
await team.run(idea="Your task")
```

### 3.2 自定义工作流

**固定顺序工作流**:
```python
from mind2build.roles import Role, RoleReactMode

class SequentialRole(Role):
    def __init__(self):
        super().__init__()
        self.set_actions([Action1, Action2, Action3])
        self.rc.react_mode = RoleReactMode.BY_ORDER
```

**动态工作流**:
```python
class DynamicRole(Role):
    async def _think(self) -> bool:
        # 根据上下文动态选择动作
        last_message = self.rc.memory.get(1)[0]
        
        if "需要设计" in last_message.content:
            self.rc.todo = WriteDesign()
        elif "需要代码" in last_message.content:
            self.rc.todo = WriteCode()
        else:
            return False
        
        return True
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

# 注册自定义提供商
from mind2build.provider.llm_provider_registry import LLM_REGISTRY
LLM_REGISTRY["custom"] = CustomLLM

# 使用
config = LLMConfig(api_type="custom", model="your-model")
llm = CustomLLM(config)
```

---

## 4. 实际项目示例

### 4.1 创建 Web 应用

```python
async def create_blog_system():
    """创建完整的博客系统"""
    
    idea = """
    创建一个博客系统，包含以下功能：
    1. 用户注册和登录
    2. 发布和编辑博客文章
    3. 评论功能
    4. 标签和分类
    5. 搜索功能
    使用 Python Flask + SQLite
    """
    
    team = Team()
    team.hire([
        ProductManager(),
        Architect(),
        Engineer(),
        QA Engineer()
    ])
    
    team.invest(15.0)
    
    result = await team.run(
        n_round=15,
        idea=idea
    )
    
    return result
```

**生成的项目结构**:
```
blog_system/
├── docs/
│   ├── PRD.md
│   ├── design.md
│   └── api.md
├── app/
│   ├── __init__.py
│   ├── models.py
│   ├── views.py
│   ├── forms.py
│   └── templates/
├── tests/
│   ├── test_models.py
│   ├── test_views.py
│   └── test_api.py
├── requirements.txt
├── config.py
└── run.py
```

### 4.2 数据分析流程

```python
async def data_analysis_pipeline():
    """完整的数据分析流程"""
    
    di = DataInterpreter()
    
    # 步骤1：加载和探索数据
    await di.run("""
    加载 data.csv 文件，执行以下分析：
    1. 显示前5行数据
    2. 显示数据统计信息
    3. 检查缺失值
    """)
    
    # 步骤2：数据清洗
    await di.run("""
    清洗数据：
    1. 删除重复行
    2. 填充缺失值（数值列用均值，分类列用众数）
    3. 移除异常值
    """)
    
    # 步骤3：数据可视化
    await di.run("""
    创建以下可视化：
    1. 各列的分布直方图
    2. 相关性热力图
    3. 关键特征的箱线图
    保存所有图表
    """)
    
    # 步骤4：建模
    await di.run("""
    使用随机森林进行分类：
    1. 划分训练集和测试集（80/20）
    2. 训练模型
    3. 评估模型性能（准确率、混淆矩阵）
    4. 显示特征重要性
    """)
```

### 4.3 CLI 工具开发

```python
async def create_cli_tool():
    """创建命令行工具"""
    
    idea = """
    创建一个任务管理CLI工具，功能包括：
    1. 添加任务（add）
    2. 列出任务（list）
    3. 完成任务（done）
    4. 删除任务（delete）
    5. 数据存储在本地JSON文件
    使用 Python Click 库
    """
    
    project_path = generate_repo(
        idea=idea,
        investment=5.0,
        n_round=8,
        project_name="task_cli"
    )
    
    print(f"CLI tool created at: {project_path}")
```

**使用生成的工具**:
```bash
cd task_cli
pip install -e .

# 使用
task add "Complete mind2build documentation"
task list
task done 1
```

### 4.4 增量迭代示例

```python
# 第一次：创建基础版本
v1_path = generate_repo(
    idea="Create a simple TODO app with add/list functions",
    project_name="todo_app"
)

# 第二次：添加功能
v2_path = generate_repo(
    idea="Add edit and delete functions to TODO app",
    inc=True,
    project_path=v1_path
)

# 第三次：添加数据库
v3_path = generate_repo(
    idea="Replace JSON storage with SQLite database",
    inc=True,
    project_path=v2_path
)

# 第四次：添加Web界面
v4_path = generate_repo(
    idea="Add Flask web interface for TODO app",
    inc=True,
    project_path=v3_path
)
```

---

## 5. 调试和故障排除

### 5.1 启用详细日志

```python
import logging
from mind2build.logs import logger

# 设置日志级别
logger.setLevel(logging.DEBUG)

# 或通过环境变量
import os
os.environ["LOG_LEVEL"] = "DEBUG"
```

### 5.2 处理 API 错误

```python
from mind2build.provider.base_llm import LLMAPIError

try:
    result = await team.run(idea="Your idea")
except LLMAPIError as e:
    print(f"LLM API error: {e}")
    print("Please check:")
    print("1. API key is valid")
    print("2. Network connection is stable")
    print("3. API quota is not exhausted")
```

### 5.3 恢复中断的项目

```python
from mind2build.team import Team
from pathlib import Path

# 从序列化状态恢复
recovery_path = Path("./storage/team")
team = Team.deserialize(stg_path=recovery_path, context=ctx)

# 继续运行
await team.run(n_round=5)
```

---

## 6. 性能优化技巧

### 6.1 减少 Token 使用

```python
# 限制历史消息数量
role.rc.memory.max_length = 50  # 只保留最近50条消息

# 使用更小的模型
config.llm.model = "gpt-3.5-turbo"  # 而不是 gpt-4
```

### 6.2 并发优化

```python
# 增加并发角色数
team = Team()
team.hire([
    ProductManager(),
    Architect(),
    Engineer(),  # 可以并发执行
    Engineer(),  # 多个工程师并发
    Engineer()
])
```

### 6.3 缓存LLM响应

```python
from functools import lru_cache

@lru_cache(maxsize=100)
async def cached_llm_call(prompt: str):
    return await llm.aask(prompt)
```

---

## 7. 最佳实践

### 7.1 清晰的需求描述

```python
# ❌ 不好的需求
generate_repo("make an app")

# ✅ 好的需求
generate_repo("""
创建一个图书管理系统，包括：
1. 图书的增删改查
2. 借阅记录管理
3. 用户管理（管理员、普通用户）
4. 图书搜索功能
技术栈：Python Flask + SQLite + Bootstrap
""")
```

### 7.2 合理的预算设置

```python
# 根据项目复杂度设置预算
simple_project = 2.0    # 简单CLI工具
medium_project = 5.0    # 中等Web应用
complex_project = 10.0  # 复杂企业应用
```

### 7.3 使用配置文件

```yaml
# ~/.mind2build/config2.yaml
llm:
  api_type: "openai"
  model: "gpt-4-turbo"
  api_key: "${OPENAI_API_KEY}"
  temperature: 0.7

workspace:
  path: "./workspace"

cost:
  max_budget: 10.0
```

---

## 8. 常见问题

**Q: 如何查看成本使用情况？**
```python
print(f"Total cost: ${team.cost_manager.total_cost:.2f}")
print(f"Tokens used: {team.cost_manager.total_tokens}")
```

**Q: 如何更换LLM提供商？**
```bash
# 修改配置文件
vim ~/.mind2build/config2.yaml
# 更改 api_type 和相关配置
```

**Q: 生成的代码质量不理想怎么办？**
- 使用更强大的模型（如 GPT-4）
- 提供更详细的需求描述
- 启用代码审查功能
- 使用增量模式逐步优化

---

**更多示例**: 请参考 `examples/` 目录  
**问题反馈**: GitHub Issues
