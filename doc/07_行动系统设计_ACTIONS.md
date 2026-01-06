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

### 5.1. ImproveDocument

**功能**: 根据审查报告改进和完善PRD或MRD文档

**输入**: 审查报告内容（或从workspace自动读取）

**输出**: 改进后的PRD或MRD文档

**关键特性**:
- 支持PRD和MRD两种文档类型
- 自动从workspace读取当前文档和审查报告
- 根据审查报告中的改进建议，针对性地补充和完善文档内容
- 保持文档的原有结构和格式
- 移除文档中的审查报告部分，只保留改进后的文档内容

**实现要点**:
```typescript
class ImproveDocument extends BaseAction {
  async run(input: string, options?: ImproveDocumentOptions): Promise<IActionOutput> {
    // 1. 读取当前文档（PRD.md 或 MRD.md）
    const currentDocument = await this.readCurrentDocument(documentType, options);
    
    // 2. 读取审查报告（从workspace或输入）
    const reviewReport = await this.readReviewReport(documentType, options);
    
    // 3. 移除文档中的审查报告部分
    const cleanDocument = this.removeReviewReport(currentDocument, documentType);
    
    // 4. 根据审查报告改进文档
    const improvedDocument = await this.improveDocument(cleanDocument, reviewReport, documentType);
    
    // 5. 保存改进后的文档
    await this.saveToWorkspace(mainFileName, improvedDocument, options);
    
    return { content: improvedDocument, ... };
  }
}
```

**使用角色**: ProductManager, Salesperson

**使用场景**:
- PRD或MRD文档经过审查后，需要根据审查报告中的改进建议完善文档
- 文档内容过于简略，需要补充详细描述
- 功能需求描述不完整，需要补充触发条件、异常流程等

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

### 8. ExecuteSubtask

**功能**: 执行子任务（工程师执行具体开发任务）

**输入**: 任务描述、设计文档、上下文信息

**输出**: 代码实现结果

**关键特性**:
- 解析任务描述
- 根据设计文档实现代码
- 支持增量开发
- 自动生成和更新代码文件

**使用角色**: Engineer

### 9. BreakdownTasks

**功能**: 基于 PRD 和系统设计文档进行任务拆分

**输入**: PRD 文档和系统设计文档

**输出**: 任务拆分文档（TASK_BREAKDOWN.md）

**关键特性**:
- 任务拆分符合最小颗粒度原则（1-3天可完成）
- 每个任务独立、可测试、可交付
- 识别任务依赖关系
- 定义任务优先级和验收标准
- 明确任务类型（前端/后端/全栈/基础设施）

**实现要点**:
```typescript
class BreakdownTasks extends BaseAction {
  async run(prd: string, design: string): Promise<IActionOutput> {
    const prompt = buildTaskBreakdownPrompt(prd, design);
    const content = await this.aask(prompt, [TASK_BREAKDOWN_SYSTEM_PROMPT]);
    return { content, data: { type: 'task_breakdown', filename: 'TASK_BREAKDOWN.md' } };
  }
}
```

**使用角色**: ProjectManager

### 10. WriteSubProjectDesign

**功能**: 基于任务拆分生成子项目设计文档

**输入**: 任务拆分文档和系统设计文档

**输出**: 子项目设计文档（SUB_PROJECT_DESIGN.md）

**关键特性**:
- 将相关任务组织成子项目
- 为每个子项目提供详细技术设计
- 定义子项目间的接口和依赖关系
- 确保子项目可独立开发和测试

**使用角色**: ProjectManager

### 11. GenerateTask

**功能**: 为工程师生成详细的任务说明

**输入**: 任务拆分文档，可选子项目设计文档

**输出**: 任务说明文档（TASK_DESCRIPTION.md）

**关键特性**:
- 详细开发指南
- 技术实现方案
- 代码示例和最佳实践
- 测试要点和注意事项

**使用角色**: ProjectManager

### 12. CodeReview

**功能**: 代码审查和反馈

**输入**: 代码内容、任务描述，可选设计文档

**输出**: 代码审查报告（CODE_REVIEW.md）

**关键特性**:
- 代码质量审查（结构、命名、可读性）
- 技术审查（设计规范、性能、安全性）
- 功能审查（任务完成度、边界处理）
- 提供改进建议和代码示例
- 评分（1-10分）

**使用角色**: ProjectManager

### 13. WriteTest

**功能**: 编写测试用例

**输入**: 代码文件

**输出**: 测试代码

**使用角色**: QAEngineer

### 14. SearchEnhancedQA

**功能**: 增强搜索和问答

**输入**: 搜索问题

**输出**: 答案和引用来源

**关键特性**:
- 智能搜索
- 答案增强
- 引用来源追踪

**使用角色**: ProductManager

### 15. DataAnalysis

**功能**: 数据分析和可视化

**输入**: 数据或分析需求

**输出**: 分析代码和可视化结果

**使用角色**: DataAnalyst

### 16. Coordinate

**功能**: 协调和任务分配

**输入**: 任务和上下文

**输出**: 协调结果和任务分配

**使用角色**: TeamLeader

---

## 已实现 Actions 列表

✅ **WriteMRD** - 市场研究文档编写  
✅ **MRDReview** - MRD文档审查  
✅ **WritePRD** - PRD文档编写  
✅ **PRDReview** - PRD文档审查  
✅ **ImproveDocument** - 根据审查报告改进PRD/MRD文档  
✅ **WriteDesign** - 系统设计文档编写  
✅ **DesignReview** - 设计文档审查  
✅ **BreakdownTasks** - 任务拆分  
✅ **WriteSubProjectDesign** - 子项目设计  
✅ **SubProjectDesignReview** - 子项目设计审查  
✅ **GenerateTask** - 任务说明生成  
✅ **WriteCode** - 代码编写  
✅ **ExecuteSubtask** - 子任务执行  
✅ **CodeReview** - 代码审查  
✅ **WriteTest** - 测试用例编写  
✅ **SearchEnhancedQA** - 增强搜索和问答  
✅ **DataAnalysis** - 数据分析和可视化  
✅ **Coordinate** - 团队协调和任务分配

## 自定义 Action

**示例**:
```typescript
import { BaseAction } from './BaseAction';
import { IActionOutput } from '@mind2build/shared';

export class CustomAction extends BaseAction {
    name = "CustomAction";
    
    async run(input: string): Promise<IActionOutput> {
        const prompt = `Task: ${input}`;
        const content = await this.aask(prompt);
        return { content };
    }
}
```

---

**参考**: 完整实现见源码 `backend/src/actions/`
