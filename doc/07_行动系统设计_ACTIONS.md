# mind2build 行动系统设计文档

**文档版本**: v1.0  
**创建日期**: 2025-12-24

## 核心 Actions

### 1. WritePRD

**功能**: 编写产品需求文档

**输入**: 用户需求字符串

**输出**: PRD Markdown 文档

**实现要点**:
```python
class WritePRD(Action):
    async def run(self, requirement: str) -> Document:
        # 1. 构建 Prompt
        prompt = self._build_prd_prompt(requirement)
        
        # 2. 调用 LLM
        content = await self._aask(prompt)
        
        # 3. 格式化
        prd = self._format_prd(content)
        
        # 4. 写入文件
        await self._write_file("PRD.md", prd)
        
        return Document(filename="PRD.md", content=prd)
```

### 2. WriteDesign

**功能**: 编写系统设计文档

**输入**: PRD 文档

**输出**: 设计文档（包含架构图）

**关键特性**:
- 数据结构设计
- API 设计
- Mermaid 图表生成

### 3. WriteCode

**功能**: 编写代码实现

**输入**: 设计文档

**输出**: 多个代码文件

**实现要点**:
- 文件列表生成
- 依赖管理
- 代码生成

### 4. WriteTest

**功能**: 编写测试用例

**输入**: 代码文件

**输出**: 测试代码

### 5. WriteCodeReview

**功能**: 代码审查

**输入**: 源代码

**输出**: 审查报告和改进建议

---

## 自定义 Action

**示例**:
```python
from mind2build.actions import Action

class CustomAction(Action):
    name: str = "CustomAction"
    
    async def run(self, *args, **kwargs):
        prompt = f"Task: {args[0]}"
        result = await self._aask(prompt)
        return result
```

---

**参考**: 完整实现见源码 `mind2build/actions/`
