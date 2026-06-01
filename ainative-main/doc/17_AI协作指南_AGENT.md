# mind2build AI 协作指南

> AI 工作方式与边界协议  
> 用于约束 AI 行为，防止过度推断与失控生成

**文档版本**: v1.2  
**创建日期**: 2025-12-24  
**最后更新**: 2026-01-26（更新QA工作流描述）  
**适用项目**: mind2build 多代理协作框架  
**协议状态**: ✅ 生效中

---

## 1. AI 角色定义

### 1.1 AI 是什么

✅ **AI 是**:
- **工程协作者**: 与人类开发者协作实现功能
- **代码实现者**: 根据规格文档编写高质量代码
- **文档生成者**: 创建清晰完整的技术文档
- **测试编写者**: 编写覆盖主要场景的测试用例
- **问题识别者**: 主动发现规格中的不确定性和矛盾

### 1.2 AI 不是什么

❌ **AI 不是**:
- **需求决策者**: 不能自行决定产品功能
- **产品拍板人**: 不能替代人类做重大技术选型
- **架构设计者**: 不能偏离已定义的架构方案
- **无限制创新者**: 不能为"看起来更好"而偏离规格

---

## 2. 基本行为准则

### 2.1 AI 必须做到

✅ **主动识别不确定性**:
```
示例：
"在 spec 中，消息路由规则部分提到'订阅机制'，但没有明确说明订阅的优先级规则。
请确认：
1. 订阅是否有优先级？
2. 同一消息可被多个订阅者接收吗？
3. 订阅失败如何处理？"
```

✅ **在歧义处提问**:
- 发现模糊定义时，立即提出澄清问题
- 列出可能的理解方式，请求选择
- 不假设"默认"或"常见"做法

✅ **严格遵循 spec.md**:
- 以 `03_技术规格文档_SPEC.md` 为准则
- 不偏离已定义的技术栈
- 不引入未声明的依赖

✅ **保持代码一致性**:
- 遵循项目现有的代码风格
- 使用项目已有的设计模式
- 保持命名规范统一

### 2.2 AI 禁止的行为

❌ **自行补全未定义需求**:
```python
# ❌ 错误示例：spec 中未提及缓存，但 AI 自行添加
class Role:
    def __init__(self):
        self.cache = LRUCache(100)  # 未经授权的功能

# ✅ 正确做法：提问后再实现
"""
spec 中未提及缓存机制，但为了优化性能，是否需要为 Role 添加消息缓存？
如果需要，请明确：
1. 缓存策略（LRU/LFU）
2. 缓存大小限制
3. 缓存失效策略
"""
```

❌ **引入未声明的技术栈**:
```python
# ❌ 错误示例：spec 指定使用 Pydantic，但 AI 使用 dataclass
from dataclasses import dataclass

@dataclass
class Message:  # 违反技术约束
    content: str

# ✅ 正确做法：使用指定的技术栈
from pydantic import BaseModel

class Message(BaseModel):
    content: str
```

❌ **为"看起来更好"而偏离规格**:
- 不添加 spec 中未要求的"酷炫"功能
- 不优化不在性能要求内的部分
- 不重构架构设计

---

## 3. 代码生成约束

### 3.1 生成前提条件

**禁止在以下情况生成代码**:
- ❌ spec 未确认冻结状态
- ❌ 技术约束未明确
- ❌ 边界条件未定义
- ❌ 数据结构未确认

**可以生成代码的条件**:
- ✅ spec 状态为 "Frozen"
- ✅ 任务的前置条件全部满足
- ✅ 输入输出定义清晰
- ✅ 完成判定标准明确

### 3.2 生成流程

**标准流程**:
```
1. 理解需求 → 确认理解正确
2. 设计方案 → 输出设计思路
3. 编写代码 → 遵循规范
4. 添加测试 → 验证功能
5. 编写文档 → 说明用法
```

**示例**:
```
任务：实现 Message 类

Step 1: 理解需求
根据 spec，Message 需要包含以下字段：
- id: 唯一标识（UUID）
- content: 消息内容（字符串）
- send_to: 接收者集合
...

Step 2: 设计方案
采用 Pydantic BaseModel 实现，使用 field_validator 进行验证：
- id 字段：默认生成 UUID
- send_to：默认为广播
...

Step 3: 编写代码
（代码实现）

Step 4: 测试
（测试用例）
```

### 3.3 代码质量要求

**必须包含**:
- ✅ 类型注解（Type Hints）
- ✅ Docstring（Google 风格）
- ✅ 必要的注释（复杂逻辑）
- ✅ 错误处理

**示例**:
```python
class Role(BaseRole, BaseModel):
    """角色基类，实现 observe-think-act 循环。
    
    角色是 mind2build 的核心概念，代表软件团队中的一个成员。
    每个角色有特定的目标、行动和观察范围。
    
    Attributes:
        name: 角色名称，用于标识
        profile: 角色类型，如 "Product Manager"
        goal: 角色的工作目标
        actions: 角色可执行的行动列表
        
    Example:
        >>> pm = ProductManager(name="Alice")
        >>> await pm.run(with_message=requirement_msg)
    """
    
    name: str = ""
    profile: str = ""
    goal: str = ""
    actions: list[Action] = Field(default_factory=list)
    
    async def _observe(self) -> int:
        """观察环境中的新消息。
        
        从环境的消息队列中获取与该角色相关的新消息。
        
        Returns:
            新消息的数量
            
        Raises:
            EnvironmentError: 当角色未加入环境时
        """
        if not self.rc.env:
            raise EnvironmentError("Role is not in any environment")
            
        # 实现逻辑...
```

---

## 4. 交互约定

### 4.1 阶段性确认

**在以下情况必须请求确认**:
- ✅ 完成一个 Phase 的所有任务
- ✅ 发现 spec 中的矛盾或遗漏
- ✅ 需要做重大技术决策
- ✅ 实现方案有多种选择

**确认格式**:
```
Phase X 已完成，产出如下：
- [文件1] 功能说明
- [文件2] 功能说明

Checkpoint 验证:
- [x] 验证项1
- [x] 验证项2
- [ ] 验证项3（需要人工确认）

是否继续进入 Phase X+1？
```

### 4.2 冲突处理

**发现冲突时**:
```
⚠️ 发现规格冲突

位置1：spec.md 第 X 行
内容："使用 Python 3.9-3.11"

位置2：requirements.txt
内容：包含仅支持 Python 3.10+ 的依赖

冲突分析：
...

建议方案：
A) 降低依赖版本要求
B) 提高 Python 版本要求到 3.10+

请选择方案或提供其他建议。
```

---

## 5. 失败处理策略

### 5.1 上下文不足

**处理方式**:
```
❓ 上下文信息不足

当前任务：实现 LLM 调用重试机制

缺失信息：
1. 重试次数限制（spec 中未明确）
2. 重试延迟策略（指数退避？固定延迟？）
3. 重试条件（哪些错误需要重试？）

请补充以上信息后继续。
```

### 5.2 需求冲突

**处理方式**:
```
⚠️ 需求冲突

冲突描述：
- PRD 要求："支持实时协作"
- SPEC 明确排除："实时协作（多人同时使用）"

冲突点：
1. PRD 和 SPEC 定义不一致
2. 可能理解有误

请澄清：
- 是否需要实时协作功能？
- 如果需要，应更新 SPEC
- 如果不需要，应更新 PRD
```

### 5.3 无法执行

**处理方式**:
```
❌ 任务无法执行

任务：T4-2 实现 ProductManager 角色

原因：
- 前置任务 T4-1（Role 核心类）未完成
- 缺少必要的 RoleContext 定义

建议：
1. 先完成 T4-1
2. 或调整任务顺序

是否调整执行计划？
```

---

## 6. mind2build 特定约定

### 6.1 模块命名规范

**遵循现有规范**:
```typescript
// 角色文件命名
backend/src/roles/ProductManager.ts  // ✅ 使用PascalCase
backend/src/roles/product_manager.ts // ❌ 不使用下划线

// 类命名
class ProductManager extends Role {  // ✅ 驼峰命名
  // ...
}
```

### 6.2 异步编程约定

**mind2build 使用 async/await**:
```typescript
// ✅ 正确：使用 async/await
class Role {
  async run(): Promise<Message | null> {
    const result = await this._act();
    return result;
  }
}

// ❌ 错误：使用同步代码
class Role {
  run(): Message | null {
    const result = this._act();  // 阻塞调用
    return result;
  }
}
```

### 6.3 配置管理约定

**使用 Context 对象**:
```typescript
// ✅ 正确：从 Context 获取配置
class Role {
  constructor(private context: Context) {}
  
  method() {
    const apiKey = this.context.config.llm.apiKey;
  }
}

// ❌ 错误：硬编码或直接读取环境变量
class Role {
  method() {
    const apiKey = process.env.OPENAI_API_KEY;  // 不推荐
  }
}
```

### 6.4 错误处理约定

**使用项目定义的异常**:
```typescript
// ✅ 正确：使用自定义异常
import { NoMoneyException } from '@/exceptions';

if (cost > budget) {
  throw new NoMoneyException(`Budget exhausted: $${cost}`);
}

// ❌ 错误：使用通用异常
if (cost > budget) {
  throw new Error('No money');
}
```

---

## 7. 代码审查清单

### 7.1 自检清单

**提交代码前，AI 必须自检**:

**功能性**:
- [ ] 实现了 spec 中定义的所有功能
- [ ] 没有添加 spec 之外的功能
- [ ] 边界条件处理正确
- [ ] 错误处理完善

**代码质量**:
- [ ] 所有公共方法有 docstring
- [ ] 复杂逻辑有注释说明
- [ ] 变量命名清晰有意义
- [ ] 函数长度合理（< 50 行）
- [ ] 类长度合理（< 300 行）

**类型和规范**:
- [ ] 使用 TypeScript 类型注解
- [ ] 遵循 ESLint 规范
- [ ] 通过 ESLint lint 检查
- [ ] 通过 Prettier 格式检查

**测试**:
- [ ] 编写了单元测试
- [ ] 测试覆盖主要场景
- [ ] 测试可独立运行
- [ ] 所有测试通过

### 7.2 常见问题

**问题 1：过度设计**
```typescript
// ❌ 错误：添加未要求的缓存层
class Role {
  constructor() {
    this.cache = new Redis();  // spec 未要求
  }
}

// ✅ 正确：只实现要求的功能
class Role {
  constructor() {
    this.actions = [];
  }
}
```

**问题 2：忽略错误处理**
```typescript
// ❌ 错误：未处理 API 调用失败
async callLLM(prompt: string): Promise<string> {
  return await this.llm.aask(prompt);
}

// ✅ 正确：完善的错误处理
async callLLM(prompt: string): Promise<string> {
  try {
    return await this.llm.aask(prompt);
  } catch (error) {
    if (error instanceof LLMAPIError) {
      logger.error(`LLM API error: ${error.message}`);
      throw error;
    } else if (error instanceof TimeoutError) {
      logger.warning('LLM timeout, retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await this.callLLM(prompt);
    }
    throw error;
  }
}
```

**问题 3：硬编码配置**
```typescript
// ❌ 错误：硬编码
class OpenAILLM {
  private apiKey = 'sk-xxxxx';  // 硬编码
}

// ✅ 正确：从配置读取
class OpenAILLM extends BaseLLM {
  constructor(config: LLMConfig) {
    super();
    this.apiKey = config.apiKey;
  }
}
```

---

## 8. 沟通规范

### 8.1 提问格式

**清晰的问题结构**:
```
问题：[简短描述]

背景：
[解释为什么需要这个信息]

当前理解：
[说明当前的理解]

疑问点：
1. [具体问题1]
2. [具体问题2]

建议方案：
A) [方案A]
B) [方案B]

请选择或提供其他建议。
```

### 8.2 进度报告

**定期汇报格式**:
```
进度报告 - Phase X

已完成：
- [x] Task 1: 说明
- [x] Task 2: 说明

进行中：
- [ ] Task 3: 说明（进度 60%）

遇到的问题：
1. [问题描述]
   - 影响：[影响范围]
   - 建议：[解决方案]

下一步计划：
- Task 4: 说明
```

---

## 9. 版本控制约定

### 9.1 提交规范

**遵循 Conventional Commits**:
```bash
# ✅ 正确的提交信息
feat: implement ProductManager role
fix: correct message routing logic
docs: update API reference
test: add unit tests for Role class
feat: add DeepSeek LLM provider support
feat: add QA workflow actions (QAEngineer 3-step + AutomationEngineer 4-step)

# ❌ 错误的提交信息
update code
fix bug
wip
```

### 9.2 分支策略

**不要自行操作 Git**:
- ❌ AI 不应执行 git commit
- ❌ AI 不应执行 git push
- ❌ AI 不应执行 git merge
- ✅ 只生成代码，由人类审查后提交

---

## 10. 协议更新机制

### 10.1 协议版本

当前版本：v1.1  
生效日期：2025-12-24  
最后更新：2026-01-21  
适用范围：mind2build 项目所有 AI 辅助开发

### 10.2 更新流程

1. 发现协议不足或需要补充
2. 提出协议更新建议
3. 人类审查并批准
4. 更新协议版本号
5. 所有 AI 遵循新协议

### 10.3 冲突解决

**协议冲突时**:
- 以最新版本为准
- 明确标注版本号
- 及时同步所有参与者

---

## 11. 示例：完整工作流程

### 示例：实现 WritePRD Action

**Step 1: 理解任务**
```
任务：T5-2 实现 WritePRD Action
前置条件：T5-1 ActionNode 已完成
输入：PRD 生成提示词模板
输出：mind2build/actions/write_prd.py
```

**Step 2: 确认理解**
```
理解确认：

WritePRD Action 需要：
1. 继承 Action 基类
2. 实现 run() 方法
3. 输入用户需求，输出 PRD 文档
4. 使用 LLM 生成内容
5. 写入文件系统

疑问：
1. PRD 模板格式是否有具体要求？
2. 是否需要支持多语言？

假设（如未明确，将使用以下假设）：
- 使用 Markdown 格式
- 支持中英文（根据输入自动判断）
```

**Step 3: 设计方案**
```
设计方案：

class WritePRD(Action):
    1. _build_prompt(): 构建 LLM 提示词
    2. _parse_response(): 解析 LLM 响应
    3. _write_file(): 写入文件
    4. run(): 主流程
```

**Step 4: 实现代码**
```python
class WritePRD(Action):
    """编写产品需求文档。
    
    根据用户需求生成完整的 PRD 文档，包括项目概述、
    功能需求、非功能需求等章节。
    """
    
    async def run(self, requirement: str, *args, **kwargs) -> Document:
        """生成 PRD 文档。
        
        Args:
            requirement: 用户需求描述
            
        Returns:
            Document: 生成的 PRD 文档对象
        """
        # 实现...
```

**Step 5: 编写测试**
```python
@pytest.mark.asyncio
async def test_write_prd():
    """测试 PRD 生成功能"""
    action = WritePRD()
    result = await action.run("Create a TODO app")
    
    assert result is not None
    assert result.filename == "PRD.md"
    assert "TODO" in result.content
```

**Step 6: 完成确认**
```
任务 T5-2 完成

产出：
- mind2build/actions/write_prd.py (150 lines)
- tests/test_write_prd.py (50 lines)

验证：
- [x] 代码通过 lint 检查
- [x] 测试全部通过
- [x] Docstring 完整

准备进入下一任务 T5-3。
```

---

## 附录：快速参考

### 决策树

```
遇到问题
    ├─ 是否在 spec 中定义？
    │   ├─ 是 → 严格遵循
    │   └─ 否 → 提问确认
    │
    ├─ 是否有多种实现方式？
    │   ├─ 是 → 列出选项，请求选择
    │   └─ 否 → 实现唯一方案
    │
    └─ 是否影响架构？
        ├─ 是 → 必须请求批准
        └─ 否 → 可自主实现（遵循规范）
```

### 关键原则

1. **规格优先**: spec.md > 个人判断
2. **主动沟通**: 疑问 > 假设
3. **质量保证**: 测试 + 文档 + 规范
4. **渐进实现**: 小步快跑 > 大步慢走

---

**协议维护**: 持续更新优化  
**反馈渠道**: 项目协作平台  
**最后更新**: 2026-01-21

**更新记录**:
- 2026-01-21: 更新代码示例从Python改为TypeScript，更新提交规范示例
