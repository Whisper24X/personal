# mind2build 行动系统设计文档

**文档版本**: v1.1  
**创建日期**: 2025-12-24  
**最后更新**: 2025-12-25

## 核心 Actions

### 1. UserRequirement

**功能**: 收集和整理用户需求

**输入**: 用户原始需求描述

**输出**: 结构化的用户需求消息

**使用角色**: Salesperson

### 2. WriteRequirementSpec

**功能**: 编写需求说明文档

**输入**: 用户需求

**输出**: 需求说明文档（RequirementSpecification.md）

**关键特性**:
- 需求分析和整理
- 市场调研和竞品分析
- 可行性分析
- 支持分步骤生成和审查

**使用角色**: Salesperson

### 3. RequirementSpecReview

**功能**: 审查需求说明文档

**输入**: 需求说明文档内容

**输出**: 审查报告和改进建议

**使用角色**: Salesperson

### 4. WritePRD

**功能**: 编写产品需求文档

**输入**: 需求说明文档或用户需求

**输出**: PRD Markdown 文档

**关键特性**:
- 支持分步骤生成（大纲 → 章节）
- 支持RAG增强搜索
- 自动审查机制
- 支持章节调整和更新

**实现要点**:
```typescript
class WritePRD extends BaseAction {
  async run(input: string): Promise<IActionOutput> {
    // 1. 构建 Prompt
    const prompt = buildPRDPrompt(input);
    
    // 2. 调用 LLM
    const content = await this.llm.completion(prompt);
    
    // 3. 格式化并写入文件
    await this.writeFile("PRD.md", content);
    
    return { content, files: ["PRD.md"] };
  }
}
```

**使用角色**: ProductManager

### 5. PRDReview

**功能**: 审查PRD文档

**输入**: PRD文档内容

**输出**: 审查报告和改进建议

**使用角色**: ProductManager

### 6. WriteDesign

**功能**: 编写系统设计文档

**输入**: PRD 文档

**输出**: 设计文档（包含架构图）

**关键特性**:
- 数据结构设计
- API 设计
- Mermaid 图表生成
- 技术选型说明

**使用角色**: Architect

### 7. WriteCode

**功能**: 编写代码实现

**输入**: 设计文档

**输出**: 多个代码文件

**实现要点**:
- 文件列表生成
- 依赖管理
- 代码生成
- 遵循最佳实践

**使用角色**: Engineer

### 8. WriteTest

**功能**: 编写测试用例

**输入**: 代码文件

**输出**: 测试代码

**使用角色**: QAEngineer

### 9. SearchEnhancedQA

**功能**: 增强搜索和问答

**输入**: 搜索问题

**输出**: 答案和引用来源

**关键特性**:
- 智能搜索
- 答案增强
- 引用来源追踪

**使用角色**: ProductManager

### 10. DataAnalysis

**功能**: 数据分析和可视化

**输入**: 数据或分析需求

**输出**: 分析代码和可视化结果

**使用角色**: DataAnalyst

### 11. Coordinate

**功能**: 协调和任务分配

**输入**: 任务和上下文

**输出**: 协调结果和任务分配

**使用角色**: TeamLeader

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
