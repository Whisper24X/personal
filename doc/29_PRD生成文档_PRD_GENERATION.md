# PRD 生成文档

**文档版本**: v1.1  
**创建日期**: 2026-01-19  
**最后更新**: 2026-01-21  
**适用范围**: Mind2Build 当前主干

---

## 1. 目标与范围

本文件用于说明 Mind2Build 在当前代码实现下的 PRD 生成机制，包括输入来源、生成流程、分步生成、审查改进、存储与接口等。内容面向产品经理、研发和运维，用于理解或扩展 PRD 生成链路。

## 2. 相关角色与模块

- **角色**: ProductManager（执行 WritePRD、PRDReview、ImprovePRD）
- **核心 Action**: `WritePRD`、`PRDReview`、`ImprovePRD`
- **支撑模块**: `StepwiseDocumentGenerator`、`WorkspaceManager`、`RAGService`、`SectionAdjustService`
- **入口控制器**: `PRDController`（HTTP API）

## 3. 输入来源与生成模式

### 3.1 输入优先级

- 优先读取 workspace 中的 `MRD.md` 作为 PRD 输入
- 若 workspace 中无 `MRD.md` 或读取失败，则回退到外部传入的 `input/requirements`

### 3.2 生成模式

- **new**: 创建新的 PRD
- **update**: 基于历史 PRD + 新增需求生成更新版
- **useRAG**: 使用 RAG 检索历史 PRD 片段作为上下文增强
- **useStepwiseGeneration**: 默认启用分步骤生成（目录 -> 章节）

### 3.3 RAG 输入构建

- 在 API 层通过 `RAGService` 检索相似 PRD
- 优先在应用维度检索（application），不足时回退到项目维度（project）
- 检索到的内容通过 `combinePRDResults` 汇总，再传给 `WritePRD` 作为 `relevantChunks`

## 4. 生成流程（主干）

### 4.1 WritePRD 主流程

1. 读取 `MRD.md`（如不存在则使用输入）
2. 根据模式（new/update）与 RAG 结果构建 prompt
3. 默认走分步骤生成：`StepwiseDocumentGenerator`
4. 生成并保存 PRD 文件到 workspace
5. 返回生成结果与文件信息

### 4.2 分步骤生成（Stepwise）

- **Step 1**: 生成目录 `00-outline.md`
- **Step 2**: 解析章节列表（不足时使用默认章节）
- **Step 3**: 按章节生成内容并落盘（`XX-section-N.md`）
- **Step 4/5**: 在 WritePRD 中默认跳过（审查与合并由 PRDReview 完成）

### 4.3 审查与改进

- **PRDReview** 合并章节生成 `PRD.md`，并输出 `PRD_REVIEW.md`
- **ImprovePRD** 根据审查报告改进 PRD，并保存回 `PRD.md`
- 状态机在 `StateManager` 中管理复审循环：Review 未通过时触发 ImprovePRD 再次审查

## 5. 模板与提示词

- 系统提示词与模板定义于 `backend/src/prompts/prd.ts`
- 模板基线文件为 `doc/prd-template/prd-template.md`
- `loadPrompt` 支持从数据库覆盖提示词配置（默认回退到代码内模板）

## 6. 输出与存储

### 6.1 Workspace 结构

PRD 文件写入路径：

```
workspace/{applicationId}/{projectId}/ainative-workspace/docs/prd/
  00-outline.md
  01-section-1.md
  02-section-2.md
  ...
  PRD.md
  PRD_REVIEW.md
```

### 6.2 数据库版本管理

- `DocumentRepository.createPRDVersion` 记录 PRD 版本与 parent 关系
- 支持软删除与恢复
- 生成完成后 PRD 会被索引进向量库（Qdrant）以支持后续检索

## 7. API 与交互入口

### 7.1 PRD 生成

- `POST /api/projects/:id/prd`
  - `requirements`: string
  - `mode`: `new` | `update`
  - `useRAG`: boolean

### 7.2 PRD 查询与版本

- `GET /api/projects/:id/prds`
- `GET /api/projects/:id/prds/versions`
- `GET /api/projects/:id/prds/:prdId`
- `DELETE /api/projects/:id/prds/:prdId`
- `POST /api/projects/:id/prds/:prdId/restore`

### 7.3 章节级调整

- `GET /api/projects/:id/prds/:prdId/sections`
- `POST /api/projects/:id/prds/:prdId/sections/:sectionNumber/adjust`
- `POST /api/projects/:id/sections/:sectionNumber/adjust`（交互式会话）

## 8. 配置与性能

- `REQUEST_TIMEOUT`: LLM 请求超时（秒），PRD 生成推荐 >= 600
- `MAX_TOKENS_PER_SECTION`: 分步骤生成时单章节最大 token 数
- `WORKSPACE_PATH`: workspace 根目录（默认 `./workspace`）

## 9. 异常与回退策略

- MRD 缺失时回退到输入 requirements
- RAG 检索无结果时回退到标准生成
- 生成超时会给出友好提示，建议提升 `REQUEST_TIMEOUT`
- 缺少 `applicationId` 或 `projectId` 会直接报错以避免 workspace 冲突

## 10. 扩展点

- **模板定制**: 替换 `doc/prd-template/prd-template.md` 或数据库提示词配置
- **可选章节**: `includeOptionalSections` 控制是否包含第 11 章
- **RAG 策略**: 调整检索范围、分块策略或相似度阈值

## 11. 关键代码参考

- `backend/src/actions/WritePRD.ts`
- `backend/src/actions/PRDReview.ts`
- `backend/src/actions/ImprovePRD.ts`
- `backend/src/prompts/prd.ts`
- `backend/src/utils/StepwiseDocumentGenerator.ts`
- `backend/src/utils/WorkspaceManager.ts`
- `backend/src/api/controllers/PRDController.ts`
- `backend/src/services/RAGService.ts`
- `doc/prd-template/prd-template.md`

---

## 12. 更新记录

### v1.1 (2026-01-21)
- 更新版本号和最后更新日期
