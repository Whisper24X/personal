# CLI知识库设计方案

**文档版本**: 2.0  
**创建日期**: 2026-01-25  
**更新日期**: 2026-01-25  
**文档状态**: 已实现  
**相关文档**: 
  - `30_Cursor_CLI迁移方案_CURSOR_CLI_MIGRATION.md`
  - `29_PRD生成文档_PRD_GENERATION.md`
  - `07_行动系统设计_ACTIONS.md`

---

## ⚠️ 重要更新：简化后的推荐方式

### 推荐方式：直接使用 Cursor CLI 原生上下文能力

**简化后的架构直接利用 Cursor CLI 的原生上下文能力**，无需复杂的知识库封装层。

#### 核心思路

1. **在 prompt 中明确指定参考目录**：CLI 会自动读取这些目录中的文件
2. **使用 `docs-archive/` 存放历史文档**：区分当前文档和历史文档
3. **添加功能冲突检测指令**：让 CLI 自动识别并报告冲突

#### 使用方式

**方式一：使用预定义的 prompt 函数**

```typescript
import { buildMRDPromptWithKnowledge } from '../prompts/mrd';
import { buildPRDPromptWithKnowledge } from '../prompts/prd';

// MRD 生成（包含知识输入引用和冲突检测）
const mrdPrompt = buildMRDPromptWithKnowledge(userIdea);

// PRD 生成（包含知识输入引用和冲突检测）
const prdPrompt = buildPRDPromptWithKnowledge(mrdContent);

await this.executeCLI(mrdPrompt, { workDir: ainativeWorkspace });
```

**方式二：使用 BaseAction 辅助方法**

```typescript
// 在 Action 中使用
const prompt = `
${this.buildKnowledgeInputReference()}

请基于 MRD 生成 PRD 文档。
${mrdContent}
`;

await this.executeCLI(prompt, { workDir: ainativeWorkspace });
```

**方式三：直接在 prompt 中引用目录**

```typescript
const prompt = `
【重要：知识输入】
请参考以下目录中的历史文档和代码作为知识输入：
1. 归档历史文档：docs-archive/mrd/, docs-archive/prd/
2. 当前文档：docs/mrd/, docs/prd/
3. 代码实现：ainative-app/src/, ainative-backend/, ainative-shadow/src/

【功能冲突检测】
如果发现与现有功能冲突，请明确指出冲突点和建议解决方案。

请基于 MRD 生成 PRD 文档。
${mrdContent}
`;
```

#### 工作目录结构

```
ainative-workspace/
├── docs/                    # 当前正在生成的文档
│   ├── mrd/                 # 当前 MRD
│   └── prd/                 # 当前 PRD
├── docs-archive/            # 归档的历史文档
│   ├── mrd/
│   │   ├── v1-2026-01-20/   # MRD 版本1
│   │   └── v2-2026-01-25/   # MRD 版本2
│   └── prd/
│       └── v1-2026-01-21/   # PRD 版本1
├── ainative-app/            # 移动端代码
├── ainative-backend/        # 后端代码
├── ainative-pc/             # PC端代码
└── ainative-shadow/         # 管理后台代码
```

#### 文档归档机制

文档归档只在**整个工作流完全执行完成后**触发：

```
MRD → PRD → Design → Code → Test → 工作流完成 → 【归档所有文档】
```

归档服务：`DocumentArchiveService`

```typescript
import { documentArchiveService } from '../services/DocumentArchiveService';

// 归档单个文档
await documentArchiveService.archiveDocument(workspacePath, 'mrd');

// 归档所有文档（工作流完成后调用）
await documentArchiveService.archiveAllDocuments(workspacePath);
```

#### 核心收益

- **简化架构**：减少 CLI 调用次数（4次 → 1次）
- **知识输入完整**：历史文档 + 代码 + 开发规范
- **冲突检测**：自动识别新功能与现有功能的冲突
- **易于维护**：无需维护复杂的知识库索引和检索逻辑

---

## 高级功能：CLI 知识库封装层

> ⚠️ 以下内容描述的是**可选的高级功能**。
> 
> 仅在以下特殊场景中使用：
> - 跨项目知识检索
> - 超大项目（> 500 文件）需要预筛选
> - 需要精细控制上下文内容和优先级

---

## 原有设计原则（高级功能）

**CLI模式和LLM模式的知识库使用策略**

- ✅ **CLI模式**：推荐使用简化方式（直接在 prompt 中引用目录），高级场景使用 CLI 知识库封装
- ✅ **LLM模式**：继续使用RAG，不使用CLI知识库
- ✅ **模式分离**：CLI模式和LLM模式的知识库使用策略完全分离

---

## 1. 概述（高级功能）

### 1.1 背景

当前系统在生成MRD、PRD等文档时，主要通过RAG（Retrieval-Augmented Generation）方式从向量数据库中检索历史文档作为上下文。然而，RAG方式存在以下局限性：

1. **依赖向量数据库**：需要维护Qdrant等向量数据库，增加系统复杂度
2. **检索精度有限**：语义相似度检索可能返回不相关的内容
3. **上下文长度限制**：检索到的chunk可能无法完整表达业务逻辑
4. **代码理解能力弱**：难以理解代码结构和业务逻辑关系

CLI工具（如Cursor CLI）具备强大的代码和文档理解能力，可以直接读取和分析文件系统中的历史代码和文档，提供更准确、更完整的上下文信息。

### 1.2 目标

设计一套基于CLI模式的知识库系统，实现以下能力：

1. **知识库能力**：通过CLI工具读取和分析历史代码和文档，为MRD、PRD生成提供输入
2. **文档管理**：支持新增和补充更多业务文档（需求文档、设计文档、代码文档等）
3. **通用封装**：封装成一套通用能力，可以被各种Action复用
4. **CLI驱动**：**CLI模式下完全使用CLI知识库（完全集成），不再使用RAG流程**，完全依赖CLI工具的文件读取和分析能力
5. **模式分离**：CLI模式使用CLI知识库，LLM模式继续使用RAG

### 1.3 核心优势

- ✅ **无需向量数据库**：直接利用CLI工具的文件系统访问能力
- ✅ **完整上下文**：CLI可以读取完整文件，不受chunk大小限制
- ✅ **代码理解**：CLI工具具备代码结构分析能力，能理解业务逻辑
- ✅ **灵活检索**：支持按路径、文件名、内容等多种方式检索
- ✅ **统一接口**：与现有CLI模式保持一致，易于集成

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Action Layer (WritePRD, WriteMRD等)      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              CLI Knowledge Base Service                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  KnowledgeBaseManager (知识库管理器)                 │   │
│  │  - 文档索引管理                                       │   │
│  │  - 检索策略管理                                       │   │
│  │  - 上下文构建                                         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  DocumentRetriever (文档检索器)                       │   │
│  │  - 按路径检索                                         │   │
│  │  - 按类型检索                                         │   │
│  │  - 按内容检索                                         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ContextBuilder (上下文构建器)                       │   │
│  │  - 文档聚合                                           │   │
│  │  - 内容筛选                                           │   │
│  │  - 格式转换                                           │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              CLI Executor (CLIExecutor)                      │
│  - 执行CLI命令读取文件                                       │
│  - 执行CLI命令分析内容                                       │
│  - 执行CLI命令检索文档                                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Workspace File System                           │
│  - 历史项目文档 (MRD, PRD, DESIGN等)                        │
│  - 历史代码文件                                             │
│  - 业务文档库                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

#### 2.2.1 KnowledgeBaseManager（知识库管理器）

**职责**：
- 管理知识库文档索引
- 定义检索策略
- 协调文档检索和上下文构建

**接口**：
```typescript
export interface KnowledgeBaseManager {
  /**
   * 添加文档到知识库
   */
  addDocument(document: KnowledgeDocument): Promise<void>;
  
  /**
   * 检索相关文档
   */
  retrieveDocuments(query: RetrievalQuery): Promise<KnowledgeDocument[]>;
  
  /**
   * 构建上下文内容
   */
  buildContext(query: RetrievalQuery, maxTokens?: number): Promise<string>;
  
  /**
   * 获取文档索引
   */
  getDocumentIndex(): Promise<DocumentIndex>;
}
```

#### 2.2.2 DocumentRetriever（文档检索器）

**职责**：
- 根据查询条件检索文档
- 支持多种检索策略（路径、类型、内容）
- 使用CLI工具执行检索

**接口**：
```typescript
export interface DocumentRetriever {
  /**
   * 按路径检索
   */
  retrieveByPath(paths: string[]): Promise<KnowledgeDocument[]>;
  
  /**
   * 按类型检索
   */
  retrieveByType(types: DocumentType[]): Promise<KnowledgeDocument[]>;
  
  /**
   * 按内容检索（使用CLI工具分析）
   */
  retrieveByContent(query: string, options?: ContentRetrievalOptions): Promise<KnowledgeDocument[]>;
  
  /**
   * 组合检索
   */
  retrieveCombined(query: CombinedRetrievalQuery): Promise<KnowledgeDocument[]>;
}
```

#### 2.2.3 ContextBuilder（上下文构建器）

**职责**：
- 聚合多个文档内容
- 筛选和排序相关内容
- 格式化输出供CLI使用

**接口**：
```typescript
export interface ContextBuilder {
  /**
   * 构建上下文字符串
   */
  build(documents: KnowledgeDocument[], options?: BuildOptions): Promise<string>;
  
  /**
   * 筛选相关文档
   */
  filterRelevant(documents: KnowledgeDocument[], query: string): Promise<KnowledgeDocument[]>;
  
  /**
   * 格式化文档内容
   */
  formatDocument(document: KnowledgeDocument): string;
}
```

---

## 3. 数据模型

### 3.1 KnowledgeDocument（知识文档）

```typescript
export interface KnowledgeDocument {
  /** 文档ID */
  id: string;
  
  /** 文档路径（相对于workspace根目录） */
  path: string;
  
  /** 文档类型 */
  type: DocumentType;
  
  /** 文档标题 */
  title: string;
  
  /** 文档内容 */
  content: string;
  
  /** 文档元数据 */
  metadata: {
    /** 项目ID */
    projectId?: string;
    /** 应用ID */
    applicationId?: string;
    /** 创建时间 */
    createdAt?: Date;
    /** 更新时间 */
    updatedAt?: Date;
    /** 标签 */
    tags?: string[];
    /** 描述 */
    description?: string;
    /** 关联文档 */
    relatedDocuments?: string[];
  };
  
  /** 文档摘要（可选，用于快速匹配） */
  summary?: string;
  
  /** 文档大小（字符数） */
  size: number;
}
```

### 3.2 DocumentType（文档类型）

```typescript
export enum DocumentType {
  /** 市场需求文档 */
  MRD = 'MRD',
  /** 产品需求文档 */
  PRD = 'PRD',
  /** 系统设计文档 */
  DESIGN = 'DESIGN',
  /** 测试文档 */
  TEST = 'TEST',
  /** 代码文件 */
  CODE = 'CODE',
  /** API文档 */
  API = 'API',
  /** 业务文档 */
  BUSINESS = 'BUSINESS',
  /** 其他文档 */
  OTHER = 'OTHER',
}
```

### 3.3 RetrievalQuery（检索查询）

```typescript
export interface RetrievalQuery {
  /** 查询关键词 */
  keywords?: string[];
  
  /** 文档类型过滤 */
  types?: DocumentType[];
  
  /** 路径过滤 */
  paths?: string[];
  
  /** 项目ID过滤 */
  projectId?: string;
  
  /** 应用ID过滤 */
  applicationId?: string;
  
  /** 标签过滤 */
  tags?: string[];
  
  /** 最大返回数量 */
  maxResults?: number;
  
  /** 最小相关性分数（0-1） */
  minRelevance?: number;
}
```

### 3.4 DocumentIndex（文档索引）

```typescript
export interface DocumentIndex {
  /** 索引版本 */
  version: string;
  
  /** 索引创建时间 */
  createdAt: Date;
  
  /** 文档列表 */
  documents: DocumentIndexEntry[];
  
  /** 统计信息 */
  statistics: {
    totalDocuments: number;
    documentsByType: Record<DocumentType, number>;
    totalSize: number;
  };
}

export interface DocumentIndexEntry {
  id: string;
  path: string;
  type: DocumentType;
  title: string;
  summary?: string;
  metadata: Record<string, any>;
}
```

---

## 4. 实现方案

### 4.1 文档索引管理

#### 4.1.1 索引构建

使用CLI工具扫描workspace目录，构建文档索引：

```typescript
export class KnowledgeBaseManager {
  /**
   * 构建文档索引
   */
  async buildIndex(workspacePath: string): Promise<DocumentIndex> {
    const indexCommand = `
请扫描以下目录，列出所有文档文件：
${workspacePath}

要求：
1. 识别文档类型（MRD, PRD, DESIGN, TEST, CODE等）
2. 提取文档标题（从文件名或文件内容）
3. 生成文档摘要（前200字符）
4. 记录文件路径和大小

输出格式：JSON数组
[
  {
    "path": "相对路径",
    "type": "文档类型",
    "title": "文档标题",
    "summary": "文档摘要",
    "size": 文件大小
  }
]
`;

    const output = await this.cliExecutor.execute(indexCommand, {
      workDir: workspacePath,
    });

    // 解析CLI输出，构建索引
    const documents = this.parseIndexOutput(output);
    
    return {
      version: '1.0',
      createdAt: new Date(),
      documents: documents.map(doc => ({
        id: this.generateDocumentId(doc.path),
        ...doc,
      })),
      statistics: this.calculateStatistics(documents),
    };
  }
}
```

#### 4.1.2 索引更新

当文档发生变化时，更新索引：

```typescript
/**
 * 更新文档索引
 */
async updateIndex(document: KnowledgeDocument): Promise<void> {
  // 使用CLI工具分析文档
  const analyzeCommand = `
请分析以下文档：
路径：${document.path}

要求：
1. 识别文档类型
2. 提取文档标题
3. 生成文档摘要（200字符）
4. 提取关键标签

输出格式：JSON
`;

  const output = await this.cliExecutor.execute(analyzeCommand, {
    workDir: this.getWorkspacePath(document.metadata),
  });

  const analysis = this.parseAnalysisOutput(output);
  
  // 更新索引
  await this.indexRepository.update(document.id, {
    type: analysis.type,
    title: analysis.title,
    summary: analysis.summary,
    metadata: {
      ...document.metadata,
      tags: analysis.tags,
    },
  });
}
```

### 4.2 文档检索

#### 4.2.1 按路径检索

```typescript
export class DocumentRetriever {
  /**
   * 按路径检索文档
   */
  async retrieveByPath(paths: string[]): Promise<KnowledgeDocument[]> {
    const readCommand = `
请读取以下文件的内容：
${paths.map(p => `- ${p}`).join('\n')}

要求：
1. 读取每个文件的完整内容
2. 识别文件类型
3. 提取文档标题

输出格式：JSON数组
[
  {
    "path": "文件路径",
    "type": "文档类型",
    "title": "文档标题",
    "content": "文件完整内容"
  }
]
`;

    const output = await this.cliExecutor.execute(readCommand, {
      workDir: this.workspacePath,
    });

    return this.parseDocumentsOutput(output);
  }
}
```

#### 4.2.2 按类型检索

```typescript
/**
 * 按类型检索文档
 */
async retrieveByType(types: DocumentType[]): Promise<KnowledgeDocument[]> {
  const findCommand = `
请查找以下类型的文档：
${types.map(t => `- ${t}`).join('\n')}

搜索范围：${this.workspacePath}

要求：
1. 查找所有匹配类型的文档
2. 读取文档内容
3. 识别文档标题

输出格式：JSON数组
`;

  const output = await this.cliExecutor.execute(findCommand, {
    workDir: this.workspacePath,
  });

  return this.parseDocumentsOutput(output);
}
```

#### 4.2.3 按内容检索（智能检索）

使用CLI工具分析文档内容，找到相关文档：

```typescript
/**
 * 按内容检索文档（使用CLI工具分析）
 */
async retrieveByContent(
  query: string,
  options?: ContentRetrievalOptions
): Promise<KnowledgeDocument[]> {
  const searchCommand = `
请根据以下查询条件，查找相关文档：

查询内容：${query}

搜索范围：${this.workspacePath}
${options?.types ? `文档类型限制：${options.types.join(', ')}` : ''}
${options?.maxResults ? `最大返回数量：${options.maxResults}` : ''}

要求：
1. 分析查询内容的意图和关键词
2. 扫描所有文档，评估相关性
3. 按相关性排序
4. 返回最相关的文档（包含完整内容）

输出格式：JSON数组
[
  {
    "path": "文档路径",
    "type": "文档类型",
    "title": "文档标题",
    "content": "文档完整内容",
    "relevance": 0.95,
    "relevanceReason": "相关性说明"
  }
]
`;

  const output = await this.cliExecutor.execute(searchCommand, {
    workDir: this.workspacePath,
    timeout: options?.timeout || 300000, // 5分钟超时
  });

  const documents = this.parseDocumentsOutput(output);
  
  // 过滤最小相关性
  if (options?.minRelevance) {
    return documents.filter(doc => 
      (doc as any).relevance >= options.minRelevance
    );
  }
  
  return documents;
}
```

### 4.3 上下文构建

#### 4.3.1 文档聚合

```typescript
export class ContextBuilder {
  /**
   * 构建上下文字符串
   */
  async build(
    documents: KnowledgeDocument[],
    options?: BuildOptions
  ): Promise<string> {
    const maxTokens = options?.maxTokens || 10000;
    let currentTokens = 0;
    const selectedDocuments: KnowledgeDocument[] = [];

    // 按相关性排序（如果有）
    const sortedDocs = documents.sort((a, b) => {
      const relevanceA = (a as any).relevance || 0;
      const relevanceB = (b as any).relevance || 0;
      return relevanceB - relevanceA;
    });

    // 选择文档直到达到token限制
    for (const doc of sortedDocs) {
      const docTokens = this.estimateTokens(doc.content);
      if (currentTokens + docTokens <= maxTokens) {
        selectedDocuments.push(doc);
        currentTokens += docTokens;
      } else {
        // 如果还有空间，尝试截取文档
        const remainingTokens = maxTokens - currentTokens;
        if (remainingTokens > 100) { // 至少保留100 tokens
          const truncatedDoc = {
            ...doc,
            content: this.truncateContent(doc.content, remainingTokens),
          };
          selectedDocuments.push(truncatedDoc);
        }
        break;
      }
    }

    // 格式化输出
    return this.formatDocuments(selectedDocuments, options);
  }

  /**
   * 格式化文档为上下文字符串
   */
  private formatDocuments(
    documents: KnowledgeDocument[],
    options?: BuildOptions
  ): string {
    const sections = documents.map((doc, index) => {
      const header = `## 参考文档 ${index + 1}: ${doc.title}\n`;
      const metadata = options?.includeMetadata
        ? `**路径**: ${doc.path}\n**类型**: ${doc.type}\n**大小**: ${doc.size} 字符\n\n`
        : '';
      const content = doc.content;
      
      return `${header}${metadata}${content}`;
    });

    return sections.join('\n\n---\n\n');
  }
}
```

#### 4.3.2 智能筛选

使用CLI工具进一步筛选最相关的文档片段：

```typescript
/**
 * 筛选相关文档
 */
async filterRelevant(
  documents: KnowledgeDocument[],
  query: string
): Promise<KnowledgeDocument[]> {
  const filterCommand = `
请从以下文档中，筛选出与查询最相关的内容：

查询内容：${query}

文档列表：
${documents.map((doc, i) => `
文档 ${i + 1}:
标题：${doc.title}
类型：${doc.type}
路径：${doc.path}
内容：
${doc.content.substring(0, 1000)}...
`).join('\n\n')}

要求：
1. 分析每个文档与查询的相关性
2. 按相关性排序
3. 返回最相关的文档（包含完整内容）

输出格式：JSON数组
[
  {
    "index": 文档索引,
    "relevance": 0.95,
    "relevanceReason": "相关性说明",
    "content": "文档完整内容"
  }
]
`;

  const output = await this.cliExecutor.execute(filterCommand, {
    workDir: this.workspacePath,
  });

  const filtered = this.parseFilteredOutput(output);
  
  return filtered.map(item => documents[item.index]);
}
```

### 4.4 文档管理

#### 4.4.1 添加文档

```typescript
export class KnowledgeBaseManager {
  /**
   * 添加文档到知识库
   */
  async addDocument(document: KnowledgeDocument): Promise<void> {
    // 1. 保存文档到workspace
    await this.workspaceManager.saveToWorkspace(
      document.path,
      document.content,
      {
        applicationId: document.metadata.applicationId,
        projectId: document.metadata.projectId,
        documentType: document.type,
      }
    );

    // 2. 使用CLI工具分析文档
    const analyzeCommand = `
请分析以下文档：
路径：${document.path}
内容：
${document.content}

要求：
1. 识别文档类型
2. 提取文档标题
3. 生成文档摘要（200字符）
4. 提取关键标签
5. 识别关联文档

输出格式：JSON
`;

    const output = await this.cliExecutor.execute(analyzeCommand, {
      workDir: this.getWorkspacePath(document.metadata),
    });

    const analysis = this.parseAnalysisOutput(output);

    // 3. 更新文档元数据
    document.title = analysis.title || document.title;
    document.summary = analysis.summary;
    document.metadata.tags = analysis.tags || document.metadata.tags;
    document.metadata.relatedDocuments = analysis.relatedDocuments;

    // 4. 更新索引
    await this.updateIndex(document);

    logger.info('KnowledgeBaseManager: Document added', {
      documentId: document.id,
      path: document.path,
      type: document.type,
    });
  }
}
```

#### 4.4.2 更新文档

```typescript
/**
 * 更新文档
 */
async updateDocument(
  documentId: string,
  updates: Partial<KnowledgeDocument>
): Promise<void> {
  const document = await this.getDocument(documentId);
  
  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // 更新文档内容
  if (updates.content) {
    await this.workspaceManager.saveToWorkspace(
      document.path,
      updates.content,
      {
        applicationId: document.metadata.applicationId,
        projectId: document.metadata.projectId,
        documentType: document.type,
      }
    );
    
    // 重新分析文档
    await this.updateIndex({
      ...document,
      ...updates,
    });
  } else {
    // 只更新元数据
    await this.indexRepository.update(documentId, updates);
  }
}
```

---

## 5. 集成方案

### 5.1 与WritePRD集成

修改`WritePRD` Action，使用CLI知识库替代RAG：

```typescript
export class WritePRD extends BaseAction {
  private knowledgeBase: KnowledgeBaseManager;

  constructor() {
    super('WritePRD', 'Generate Product Requirements Document');
    this.knowledgeBase = new KnowledgeBaseManager(this.cliExecutor);
  }

  async run(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
    const workspaceOptions = this.validateWorkspaceOptions(options, 'PRD');
    
    // 1. 构建检索查询
    const query: RetrievalQuery = {
      keywords: this.extractKeywords(input),
      types: [DocumentType.MRD, DocumentType.PRD, DocumentType.DESIGN],
      applicationId: workspaceOptions.applicationId,
      projectId: workspaceOptions.projectId,
      maxResults: 10,
    };

    // 2. 检索相关文档
    const relevantDocs = await this.knowledgeBase.retrieveDocuments(query);

    // 3. 构建上下文
    const context = await this.knowledgeBase.buildContext(query, {
      maxTokens: 8000,
      includeMetadata: true,
    });

    // 4. 构建Prompt（包含上下文）
    const prompt = this.buildPRDPromptWithContext(input, context);

    // 5. 执行CLI生成
    if (this.isCLIMode()) {
      return await this.executeCLIWrite(prompt, workspaceOptions);
    } else {
      return await this.executeLLMWrite(prompt, workspaceOptions);
    }
  }

  /**
   * 构建包含上下文的PRD Prompt
   */
  private buildPRDPromptWithContext(
    input: string,
    context: string
  ): string {
    return `
请基于以下输入和参考文档，生成产品需求文档（PRD）：

【输入需求】
${input}

【参考文档】
${context}

【要求】
1. 参考历史文档的结构和格式
2. 保持与历史文档的一致性
3. 结合输入需求和参考文档，生成完整的PRD
4. 确保内容详细、具体、可执行
`;
  }
}
```

### 5.2 与WriteMRD集成

类似地，修改`WriteMRD` Action：

```typescript
export class WriteMRD extends BaseAction {
  private knowledgeBase: KnowledgeBaseManager;

  async run(userIdea: string, options?: WriteMRDOptions): Promise<IActionOutput> {
    const workspaceOptions = this.validateWorkspaceOptions(options, 'MRD');
    
    // 检索相关业务文档和代码
    const query: RetrievalQuery = {
      keywords: this.extractKeywords(userIdea),
      types: [DocumentType.BUSINESS, DocumentType.CODE, DocumentType.PRD],
      applicationId: workspaceOptions.applicationId,
      maxResults: 15,
    };

    const context = await this.knowledgeBase.buildContext(query, {
      maxTokens: 10000,
    });

    const prompt = this.buildMRDPromptWithContext(userIdea, context);
    
    // 执行生成...
  }
}
```

### 5.3 通用知识库服务

创建通用的知识库服务，供所有Action使用：

```typescript
/**
 * CLI Knowledge Base Service
 * 通用的知识库服务，供所有Action使用
 */
export class CLIKnowledgeBaseService {
  private managers: Map<string, KnowledgeBaseManager> = new Map();

  /**
   * 获取知识库管理器（按应用和项目）
   */
  getManager(applicationId: string, projectId: string): KnowledgeBaseManager {
    const key = `${applicationId}:${projectId}`;
    
    if (!this.managers.has(key)) {
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId,
        projectId,
      });
      
      const cliExecutor = new CLIExecutor({
        defaultWorkDir: workspacePath,
      });
      
      const manager = new KnowledgeBaseManager(cliExecutor, workspacePath);
      this.managers.set(key, manager);
    }
    
    return this.managers.get(key)!;
  }

  /**
   * 检索文档（便捷方法）
   */
  async retrieveDocuments(
    applicationId: string,
    projectId: string,
    query: RetrievalQuery
  ): Promise<KnowledgeDocument[]> {
    const manager = this.getManager(applicationId, projectId);
    return await manager.retrieveDocuments(query);
  }

  /**
   * 构建上下文（便捷方法）
   */
  async buildContext(
    applicationId: string,
    projectId: string,
    query: RetrievalQuery,
    options?: BuildOptions
  ): Promise<string> {
    const manager = this.getManager(applicationId, projectId);
    return await manager.buildContext(query, options);
  }
}

// 单例实例
export const cliKnowledgeBaseService = new CLIKnowledgeBaseService();
```

---

## 6. 与当前流程集成

### 6.1 当前流程分析

#### 6.1.1 现有RAG流程

当前系统在生成MRD和PRD时，使用RAG（Retrieval-Augmented Generation）流程：

**PRD生成流程（当前）**：
```
1. API Controller (PRDController.generatePRD)
   ↓
2. RAGService.searchSimilarPRDsByApplication (检索相似PRD)
   ↓
3. 合并检索结果 (combinePRDResults)
   ↓
4. WritePRD.run(input, { useRAG: true, relevantChunks })
   ↓
5. buildPRDWithRAGPrompt (构建包含RAG上下文的Prompt)
   ↓
6. LLM生成PRD
```

**MRD生成流程（当前）**：
```
1. API Controller (MRDController.generateMRD)
   ↓
2. RAGService.searchSimilarMRDs (检索相似MRD)
   ↓
3. WriteMRD.run(input, { useRAG: true, relevantChunks })
   ↓
4. buildMRDPrompt (构建包含RAG上下文的Prompt)
   ↓
5. LLM生成MRD
```

#### 6.1.2 集成点识别

CLI知识库可以在以下位置无缝替换RAG：

1. **API Controller层**：替换RAGService调用
2. **Action层**：替换`relevantChunks`参数来源
3. **Prompt构建层**：保持相同的Prompt格式，只改变上下文来源

#### 6.1.3 模式分离原则 ⚠️

**重要原则**：CLI模式和LLM模式的知识库使用策略不同

- **CLI模式**：
  - ✅ **必须使用CLI知识库（完全集成）**，不使用RAG
  - ✅ CLI工具可以直接读取文件系统，无需向量数据库
  - ✅ 利用CLI工具的代码和文档理解能力
  - ✅ 在Action层自动集成，无需API层改动
  
- **LLM模式**：
  - ✅ **继续使用RAG**，不使用CLI知识库
  - ✅ 保持现有RAG流程不变
  - ✅ 向后兼容，不影响现有功能

### 6.2 集成方案：完全集成（仅在CLI模式下生效）⭐

**核心思路**：在Action层直接集成CLI知识库，**仅在CLI模式下自动使用**，LLM模式继续使用RAG

**优点**：
- ✅ 更深度集成
- ✅ CLI模式下自动启用，无需API层改动
- ✅ LLM模式保持RAG流程不变，向后兼容
- ✅ 模式分离清晰，易于维护

**重要说明**：
- ⚠️ **仅在CLI模式下生效**：LLM模式不调用此方法
- ✅ **LLM模式继续使用RAG**：保持现有RAG流程不变

**实现步骤**：

**步骤1：创建CLI知识库服务（供BaseAction使用）**

```typescript
// backend/src/services/CLIKnowledgeBaseService.ts
import { CLIExecutor } from '../executors/CLIExecutor';
import { KnowledgeBaseManager } from '../utils/knowledge/KnowledgeBaseManager';
import { WorkspaceManager } from '../utils/WorkspaceManager';

export class CLIKnowledgeBaseService {
  private managers: Map<string, KnowledgeBaseManager> = new Map();

  /**
   * 获取知识库管理器
   */
  getManager(applicationId: string, projectId: string): KnowledgeBaseManager {
    const key = `${applicationId}:${projectId}`;
    
    if (!this.managers.has(key)) {
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId,
        projectId,
      });
      
      const cliExecutor = new CLIExecutor({
        defaultWorkDir: workspacePath,
      });
      
      const manager = new KnowledgeBaseManager(cliExecutor, workspacePath);
      this.managers.set(key, manager);
    }
    
    return this.managers.get(key)!;
  }
}

// 单例实例
export const cliKnowledgeBaseService = new CLIKnowledgeBaseService();
```

**步骤2：在BaseAction中添加知识库支持**

```typescript
// backend/src/core/base/BaseAction.ts
import { cliKnowledgeBaseService } from '../services/CLIKnowledgeBaseService';

export abstract class BaseAction {
  // ... 现有代码 ...

  /**
   * 获取知识库上下文（仅在CLI模式下使用CLI知识库）
   * ⚠️ 重要：仅在CLI模式下生效，LLM模式不调用此方法
   * LLM模式继续使用RAG（在Controller层处理）
   */
  protected async getKnowledgeBaseContext(
    query: string,
    documentTypes: string[],
    options?: { maxTokens?: number; maxResults?: number }
  ): Promise<string | null> {
    // ⚠️ 仅在CLI模式下使用CLI知识库
    // LLM模式不调用此方法，继续使用RAG（在Controller层处理）
    if (!this.isCLIMode()) {
      return null; // LLM模式不在这里处理，继续使用RAG
    }

    const workspaceOptions = this.getWorkspaceOptions();
    if (!workspaceOptions?.applicationId || !workspaceOptions?.projectId) {
      return null;
    }

    try {
      const manager = cliKnowledgeBaseService.getManager(
        workspaceOptions.applicationId,
        workspaceOptions.projectId
      );

      const retrievalQuery = {
        keywords: this.extractKeywords(query),
        types: documentTypes as any[],
        applicationId: workspaceOptions.applicationId,
        projectId: workspaceOptions.projectId,
        maxResults: options?.maxResults || 5,
      };

      const context = await manager.buildContext(retrievalQuery, {
        maxTokens: options?.maxTokens || 8000,
        includeMetadata: true,
      });

      return context;
    } catch (error) {
      logger.warn('BaseAction: Failed to get knowledge base context', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const words = text.split(/\s+/).filter(w => w.length > 2);
    return words.slice(0, 10);
  }
}
```

**步骤3：在WritePRD中集成（仅在CLI模式下生效）**

```typescript
// backend/src/actions/WritePRD.ts
export class WritePRD extends BaseAction {
  async run(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
    // ... 现有代码 ...

    const isCLIMode = this.isCLIMode();

    // ✅ CLI模式：自动获取CLI知识库上下文（完全集成）
    // ⚠️ 仅在CLI模式下生效，LLM模式不执行此逻辑
    if (isCLIMode && mode === 'new') {
      // 获取CLI知识库上下文
      const kbContext = await this.getKnowledgeBaseContext(
        input || mrdContent,
        ['MRD', 'PRD', 'DESIGN'],
        { maxTokens: 8000, maxResults: 5 }
      );

      // 如果有上下文，添加到输入中
      const enhancedInput = kbContext
        ? `${mrdContent}\n\n【参考文档】\n${kbContext}`
        : mrdContent;

      // 使用增强的输入执行CLI生成
      const handler = await this.getCachedHandler('write', () => this.createWriteHandler());
      return await this.executeWriteHandler(handler, enhancedInput, workspaceOptions, {
        type: 'prd',
        mode,
      });
    }

    // ✅ LLM模式：继续使用RAG（在Controller层处理，这里保持不变）
    // ... LLM模式代码保持不变，继续使用原有RAG流程 ...
  }
}
```

**步骤4：在WriteMRD中集成（仅在CLI模式下生效）**

```typescript
// backend/src/actions/WriteMRD.ts
export class WriteMRD extends BaseAction {
  async run(userIdea: string, options?: WriteMRDOptions): Promise<IActionOutput> {
    // ... 现有代码 ...

    const isCLIMode = this.isCLIMode();

    // ✅ CLI模式：自动获取CLI知识库上下文（完全集成）
    // ⚠️ 仅在CLI模式下生效，LLM模式不执行此逻辑
    if (isCLIMode && mode === 'new') {
      const kbContext = await this.getKnowledgeBaseContext(
        userIdea,
        ['BUSINESS', 'PRD', 'CODE'],
        { maxTokens: 10000, maxResults: 5 }
      );

      const enhancedInput = kbContext
        ? `${userIdea}\n\n【参考文档】\n${kbContext}`
        : userIdea;

      // 执行CLI生成
      // ... CLI生成逻辑 ...
    }

    // ✅ LLM模式：继续使用RAG（在Controller层处理，这里保持不变）
    // ... LLM模式代码保持不变，继续使用原有RAG流程 ...
  }
}
```

### 6.3 配置说明

**完全集成配置**：

完全集成在Action层自动处理，**无需额外配置**。CLI模式下自动使用CLI知识库，LLM模式继续使用RAG。

**环境变量配置**（可选，用于控制CLI模式是否启用知识库）：

```env
# .env
# CLI模式下启用CLI知识库（完全集成）
# 默认启用，设置为false可禁用
ENABLE_CLI_KNOWLEDGE_BASE_IN_CLI_MODE=true
```

**重要说明**：
- ⚠️ **CLI模式下**：自动使用CLI知识库，不使用RAG
- ✅ **LLM模式下**：继续使用RAG，不调用CLI知识库
- ✅ **无需Controller层改动**：在Action层自动处理

**在Action中的使用**（自动处理）：

```typescript
// WritePRD.ts - 完全集成
export class WritePRD extends BaseAction {
  async run(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
    const isCLIMode = this.isCLIMode();

    // CLI模式：自动获取CLI知识库上下文
    if (isCLIMode && mode === 'new') {
      // getKnowledgeBaseContext 自动调用，无需手动处理
      // ... CLI生成逻辑 ...
    }

    // LLM模式：继续使用RAG（在Controller层处理）
    // ... LLM模式代码保持不变 ...
  }
}
```

**在Controller中的使用**（LLM模式继续使用RAG）：

```typescript
// PRDController.ts - LLM模式继续使用RAG
export class PRDController {
  static async generatePRD(req: Request, res: Response) {
    const { useCLI = false, useRAG = false } = req.body;

    // CLI模式：在Action层自动处理，无需Controller层改动
    if (useCLI) {
      const result = await writePRDAction.run(requirements, {
        mode: 'new',
        applicationId,
        projectId: id,
      });
      // 会自动在Action层获取CLI知识库上下文
      return res.json({ success: true, prd: result.content });
    }

    // LLM模式：继续使用RAG（原有逻辑）
    if (useRAG) {
      await ensureRAGServiceInitialized();
      let searchResults: any[] = [];
      
      if (applicationId) {
        searchResults = await ragService.searchSimilarPRDsByApplication(
          applicationId,
          requirements,
          5
        );
      }
      
      if (searchResults.length === 0) {
        searchResults = await ragService.searchSimilarPRDs(id, requirements, 3);
      }

      const relevantChunks = searchResults.length > 0
        ? ragService.combinePRDResults(searchResults)
        : null;

      const result = await writePRDAction.run(requirements, {
        mode: 'new',
        useRAG: true,
        relevantChunks, // RAG检索结果
        applicationId,
        projectId: id,
      });
      
      return res.json({ success: true, prd: result.content });
    }

    // 标准生成（不使用知识库）
    // ...
  }
}
```

### 6.4 快速集成检查清单

- [ ] 创建`CLIKnowledgeBaseService`服务类
- [ ] 在`BaseAction`中添加`getKnowledgeBaseContext`方法（仅在CLI模式下生效）
- [ ] 修改`WritePRD.run`，在CLI模式下自动获取CLI知识库上下文
- [ ] 修改`WriteMRD.run`，在CLI模式下自动获取CLI知识库上下文
- [ ] 确保LLM模式继续使用RAG（Controller层保持不变）
- [ ] 测试CLI模式下的知识库集成
- [ ] 测试LLM模式下的RAG流程（确保不受影响）
- [ ] 添加配置开关（可选）

### 6.5 集成示例：完整流程

#### 6.5.1 PRD生成完整流程（集成后）

**CLI模式流程**（完全集成，不使用RAG）：
```
1. 用户请求生成PRD（useCLI=true）
   ↓
2. PRDController.generatePRD
   ↓
3. CLI模式检测：useCLI=true
   ↓
4. WritePRD.run(input) - 在Action层自动处理
   ↓
5. BaseAction.getKnowledgeBaseContext() - 自动获取CLI知识库上下文
   ├─ 成功 → 返回上下文
   └─ 失败 → 标准生成（不回退到RAG）
   ↓
6. CLI模式执行 → 使用CLI生成（上下文已包含）
   ↓
7. 保存PRD到workspace
   ↓
8. 返回结果
```

**LLM模式流程**（继续使用RAG，完全集成不生效）：
```
1. 用户请求生成PRD（useCLI=false, useRAG=true）
   ↓
2. PRDController.generatePRD
   ↓
3. LLM模式检测：useCLI=false
   ↓
4. RAG检索（继续使用RAG，完全集成不生效）
   ├─ RAG成功 → 使用RAG上下文
   └─ RAG失败 → 标准生成
   ↓
5. WritePRD.run(input, { relevantChunks, useRAG=true })
   ↓
6. LLM模式执行 → buildPRDWithRAGPrompt → LLM生成
   ↓
7. 保存PRD到workspace
   ↓
8. 返回结果
```

#### 6.5.2 代码示例：完全集成（仅在CLI模式下生效）

**在Action层自动处理，Controller层无需改动**：

```typescript
// WritePRD.ts - 完全集成（仅在CLI模式下生效）
export class WritePRD extends BaseAction {
  async run(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';
    const workspaceOptions = this.validateWorkspaceOptions(options, 'PRD');
    const { applicationId, projectId } = workspaceOptions;
    const isCLIMode = this.isCLIMode();

    // ✅ CLI模式：自动获取CLI知识库上下文
    if (isCLIMode && mode === 'new') {
      // getKnowledgeBaseContext 自动调用
      const kbContext = await this.getKnowledgeBaseContext(
        input || mrdContent,
        ['MRD', 'PRD', 'DESIGN'],
        { maxTokens: 8000, maxResults: 5 }
      );

      const enhancedInput = kbContext
        ? `${mrdContent}\n\n【参考文档】\n${kbContext}`
        : mrdContent;

      const handler = await this.getCachedHandler('write', () => this.createWriteHandler());
      return await this.executeWriteHandler(handler, enhancedInput, workspaceOptions, {
        type: 'prd',
        mode,
      });
    }

    // ✅ LLM模式：继续使用RAG（Controller层处理，这里保持不变）
    // ... LLM模式代码保持不变，继续使用原有RAG流程 ...
  }
}
```

**Controller层（LLM模式继续使用RAG）**：

```typescript
// PRDController.ts - LLM模式继续使用RAG
export class PRDController {
  static async generatePRD(req: Request, res: Response) {
    const { id } = req.params;
    const { requirements, useRAG = false, useCLI = false, mode = 'new' } = req.body;

    const project = await projectRepo.findById(id);
    const applicationId = project.application_id;
    let prdContent: string;

    if (mode === 'update') {
      // Update模式逻辑（保持不变）
      // ...
    } else {
      // New模式
      
      // ✅ CLI模式：在Action层自动处理，Controller层无需改动
      if (useCLI) {
        const latestPRD = await documentRepo.findLatestPRD(id);
        const nextVersion = latestPRD ? (latestPRD.version || 1) + 1 : 1;
        
        // 会自动在Action层获取CLI知识库上下文
        const result = await writePRDAction.run(requirements, {
          mode: 'new',
          applicationId,
          projectId: id,
          version: nextVersion,
        });
        prdContent = result.content;
      } 
      // ✅ LLM模式：继续使用RAG（完全集成不生效）
      else if (useRAG) {
        // 继续使用原有RAG流程
        await ensureRAGServiceInitialized();
        let searchResults: any[] = [];

        if (applicationId) {
          searchResults = await ragService.searchSimilarPRDsByApplication(
            applicationId,
            requirements,
            5
          );
        }

        if (searchResults.length === 0) {
          searchResults = await ragService.searchSimilarPRDs(id, requirements, 3);
        }

        const relevantChunks = searchResults.length > 0
          ? ragService.combinePRDResults(searchResults)
          : null;

        const latestPRD = await documentRepo.findLatestPRD(id);
        const nextVersion = latestPRD ? (latestPRD.version || 1) + 1 : 1;
        
        const result = await writePRDAction.run(requirements, {
          mode: 'new',
          useRAG: true,
          relevantChunks, // RAG检索结果
          applicationId,
          projectId: id,
          version: nextVersion,
        });
        prdContent = result.content;
      } else {
        // 标准生成（不使用知识库）
        const latestPRD = await documentRepo.findLatestPRD(id);
        const nextVersion = latestPRD ? (latestPRD.version || 1) + 1 : 1;
        const result = await writePRDAction.run(requirements, {
          mode: 'new',
          applicationId,
          projectId: id,
          version: nextVersion,
        });
        prdContent = result.content;
      }
    }

    // 保存PRD版本
    // ... 保存逻辑 ...

    return res.json({
      success: true,
      prd: prdContent,
      // ...
    });
  }
}
```

### 6.6 迁移建议

#### 6.6.1 渐进式迁移策略

1. **阶段1：实现完全集成（3-5天）**
   - 创建`CLIKnowledgeBaseService`服务类
   - 在`BaseAction`中实现`getKnowledgeBaseContext`方法
   - 在`WritePRD`和`WriteMRD`中集成
   - 确保仅在CLI模式下生效
   - 验证CLI模式下的知识库功能

2. **阶段2：测试和优化（2-3周）**
   - 测试CLI模式下的知识库集成
   - 确保LLM模式继续使用RAG（不受影响）
   - 收集性能和准确性数据
   - 优化CLI知识库性能

3. **阶段3：生产验证（1-2周）**
   - 在部分项目上启用
   - 监控错误率和用户反馈
   - 验证LLM模式RAG流程不受影响

4. **阶段4：全面启用（1周）**
   - 所有项目启用
   - 监控系统稳定性
   - 文档更新

#### 6.6.2 回滚方案

如果CLI知识库出现问题，可以快速回滚：

**禁用CLI知识库**：
```typescript
// 通过环境变量禁用CLI知识库
ENABLE_CLI_KNOWLEDGE_BASE_IN_CLI_MODE=false

// 或者在BaseAction.getKnowledgeBaseContext中直接返回null
// CLI模式会回退到标准生成（不使用知识库）
```

**LLM模式不受影响**：
- LLM模式继续使用RAG，不受影响
- 无需回滚操作

#### 6.6.3 重要原则总结

⚠️ **CLI模式（完全集成）**：
- ✅ **必须使用CLI知识库**（自动处理）
- ❌ **不使用RAG**
- ✅ CLI知识库失败时，直接标准生成（不回退到RAG）
- ✅ 在Action层自动处理，无需Controller层改动

✅ **LLM模式**：
- ✅ **继续使用RAG**（完全集成不生效）
- ✅ 保持现有RAG流程不变
- ✅ 向后兼容，不影响现有功能

---

## 7. 使用示例

### 6.1 添加业务文档

```typescript
// 在API Controller中
async function addBusinessDocument(req: Request, res: Response) {
  const { applicationId, projectId } = req.params;
  const { title, content, type, tags } = req.body;

  const manager = cliKnowledgeBaseService.getManager(applicationId, projectId);
  
  const document: KnowledgeDocument = {
    id: uuidv4(),
    path: `docs/business/${type}/${title}.md`,
    type: type as DocumentType,
    title,
    content,
    metadata: {
      applicationId,
      projectId,
      tags,
      createdAt: new Date(),
    },
    size: content.length,
  };

  await manager.addDocument(document);
  
  res.json({ success: true, documentId: document.id });
}
```

### 6.2 为PRD生成检索上下文

```typescript
// 在WritePRD Action中
async function generatePRDWithKnowledgeBase(
  mrdContent: string,
  applicationId: string,
  projectId: string
) {
  const manager = cliKnowledgeBaseService.getManager(applicationId, projectId);
  
  // 构建检索查询
  const query: RetrievalQuery = {
    keywords: extractKeywords(mrdContent),
    types: [DocumentType.MRD, DocumentType.PRD, DocumentType.DESIGN],
    applicationId,
    projectId,
    maxResults: 10,
  };

  // 检索相关文档
  const documents = await manager.retrieveDocuments(query);
  
  // 构建上下文
  const context = await manager.buildContext(query, {
    maxTokens: 8000,
    includeMetadata: true,
  });

  // 使用上下文生成PRD
  const prompt = `
基于以下MRD和参考文档，生成PRD：

【MRD内容】
${mrdContent}

【参考文档】
${context}

请参考历史文档的结构和内容，生成完整的PRD。
`;

  return await executeCLI(prompt);
}
```

### 6.3 检索历史代码

```typescript
// 检索相关代码文件
async function retrieveRelatedCode(
  query: string,
  applicationId: string,
  projectId: string
) {
  const manager = cliKnowledgeBaseService.getManager(applicationId, projectId);
  
  const codeQuery: RetrievalQuery = {
    keywords: [query],
    types: [DocumentType.CODE],
    applicationId,
    projectId,
    maxResults: 5,
  };

  const codeDocuments = await manager.retrieveDocuments(codeQuery);
  
  // 构建代码上下文
  const codeContext = await manager.buildContext(codeQuery, {
    maxTokens: 5000,
  });

  return codeContext;
}
```

---

## 8. 配置和扩展

### 7.1 配置选项

```typescript
export interface CLIKnowledgeBaseConfig {
  /** 默认检索的最大文档数 */
  defaultMaxResults?: number;
  
  /** 默认上下文的最大token数 */
  defaultMaxTokens?: number;
  
  /** CLI执行超时时间（毫秒） */
  cliTimeout?: number;
  
  /** 索引更新策略 */
  indexUpdateStrategy?: 'immediate' | 'lazy' | 'scheduled';
  
  /** 索引更新间隔（秒，仅scheduled模式） */
  indexUpdateInterval?: number;
  
  /** 文档类型映射 */
  documentTypeMapping?: Record<string, DocumentType>;
  
  /** 检索策略配置 */
  retrievalStrategies?: {
    /** 是否启用内容检索 */
    enableContentRetrieval?: boolean;
    /** 是否启用路径检索 */
    enablePathRetrieval?: boolean;
    /** 是否启用类型检索 */
    enableTypeRetrieval?: boolean;
  };
}
```

### 7.2 扩展点

#### 7.2.1 自定义检索策略

```typescript
export interface RetrievalStrategy {
  /**
   * 执行检索
   */
  retrieve(query: RetrievalQuery): Promise<KnowledgeDocument[]>;
  
  /**
   * 策略名称
   */
  getName(): string;
}

/**
 * 实现自定义检索策略
 */
export class CustomRetrievalStrategy implements RetrievalStrategy {
  async retrieve(query: RetrievalQuery): Promise<KnowledgeDocument[]> {
    // 自定义检索逻辑
    // 可以使用CLI工具执行复杂的检索任务
  }

  getName(): string {
    return 'custom';
  }
}

// 注册策略
knowledgeBaseManager.registerRetrievalStrategy(new CustomRetrievalStrategy());
```

#### 7.2.2 自定义文档分析器

```typescript
export interface DocumentAnalyzer {
  /**
   * 分析文档
   */
  analyze(document: KnowledgeDocument): Promise<DocumentAnalysis>;
}

export interface DocumentAnalysis {
  type: DocumentType;
  title: string;
  summary: string;
  tags: string[];
  relatedDocuments: string[];
  keyPoints: string[];
}
```

---

## 9. 性能优化

### 8.1 索引缓存

```typescript
export class KnowledgeBaseManager {
  private indexCache: Map<string, { index: DocumentIndex; timestamp: number }> = new Map();
  private cacheTTL = 3600000; // 1小时

  /**
   * 获取缓存的索引
   */
  async getCachedIndex(workspacePath: string): Promise<DocumentIndex | null> {
    const cached = this.indexCache.get(workspacePath);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.index;
    }
    
    return null;
  }

  /**
   * 更新索引缓存
   */
  async updateIndexCache(workspacePath: string, index: DocumentIndex): Promise<void> {
    this.indexCache.set(workspacePath, {
      index,
      timestamp: Date.now(),
    });
  }
}
```

### 8.2 并行检索

```typescript
/**
 * 并行执行多个检索策略
 */
async retrieveParallel(query: RetrievalQuery): Promise<KnowledgeDocument[]> {
  const strategies = [
    this.retrieveByPath.bind(this),
    this.retrieveByType.bind(this),
    this.retrieveByContent.bind(this),
  ];

  const results = await Promise.all(
    strategies.map(strategy => strategy(query))
  );

  // 合并结果，去重
  const merged = this.mergeAndDeduplicate(results);
  
  // 按相关性排序
  return this.sortByRelevance(merged, query);
}
```

### 8.3 增量索引更新

```typescript
/**
 * 增量更新索引（只更新变化的文档）
 */
async updateIndexIncremental(
  workspacePath: string,
  changedPaths: string[]
): Promise<void> {
  const index = await this.getDocumentIndex(workspacePath);
  
  for (const path of changedPaths) {
    // 读取文档
    const content = await this.readDocument(path);
    
    // 分析文档
    const analysis = await this.analyzeDocument(content);
    
    // 更新索引条目
    await this.updateIndexEntry(path, analysis);
  }
}
```

---

## 9. 错误处理和日志

### 9.1 错误处理

```typescript
export class KnowledgeBaseManager {
  /**
   * 检索文档（带错误处理）
   */
  async retrieveDocuments(query: RetrievalQuery): Promise<KnowledgeDocument[]> {
    try {
      return await this.doRetrieve(query);
    } catch (error) {
      logger.error('KnowledgeBaseManager: Retrieval failed', {
        query,
        error: error.message,
      });

      // 降级策略：返回空结果或使用缓存
      if (this.fallbackToCache) {
        return await this.getCachedResults(query);
      }

      throw error;
    }
  }
}
```

### 9.2 日志记录

```typescript
logger.info('KnowledgeBaseManager: Document retrieved', {
  query,
  documentCount: documents.length,
  executionTime: Date.now() - startTime,
});

logger.debug('KnowledgeBaseManager: Context built', {
  documentCount: selectedDocuments.length,
  totalTokens: currentTokens,
  maxTokens,
});
```

---

## 10. 测试策略

### 10.1 单元测试

```typescript
describe('KnowledgeBaseManager', () => {
  it('should build document index', async () => {
    const manager = new KnowledgeBaseManager(mockCLIExecutor, '/test/workspace');
    const index = await manager.buildIndex('/test/workspace');
    
    expect(index.documents.length).toBeGreaterThan(0);
    expect(index.statistics.totalDocuments).toBeGreaterThan(0);
  });

  it('should retrieve documents by type', async () => {
    const documents = await manager.retrieveDocuments({
      types: [DocumentType.PRD],
      maxResults: 5,
    });
    
    expect(documents.every(doc => doc.type === DocumentType.PRD)).toBe(true);
    expect(documents.length).toBeLessThanOrEqual(5);
  });
});
```

### 10.2 集成测试

```typescript
describe('CLI Knowledge Base Integration', () => {
  it('should integrate with WritePRD', async () => {
    const writePRD = new WritePRD();
    const result = await writePRD.run('用户需求', {
      applicationId: 'test-app',
      projectId: 'test-project',
    });
    
    expect(result.content).toContain('产品需求文档');
  });
});
```

---

## 11. 迁移计划

### 11.1 阶段1：基础设施（3-5天）

1. 实现`KnowledgeBaseManager`核心类
2. 实现`DocumentRetriever`检索器
3. 实现`ContextBuilder`上下文构建器
4. 实现文档索引管理

### 11.2 阶段2：集成（3-5天）

1. 修改`WritePRD`使用CLI知识库
2. 修改`WriteMRD`使用CLI知识库
3. 创建通用`CLIKnowledgeBaseService`
4. 添加API接口支持文档管理

### 11.3 阶段3：优化和测试（2-3天）

1. 性能优化（缓存、并行检索）
2. 错误处理和降级策略
3. 单元测试和集成测试
4. 文档更新

### 11.4 阶段4：扩展（可选，2-3天）

1. 支持更多文档类型
2. 实现自定义检索策略
3. 实现文档分析插件
4. 添加监控和指标

---

## 12. 总结

### 12.1 核心优势

- ✅ **无需向量数据库**：直接利用CLI工具的文件系统能力
- ✅ **完整上下文**：可以读取完整文档，不受chunk限制
- ✅ **智能检索**：CLI工具具备强大的代码和文档理解能力
- ✅ **统一接口**：与现有CLI模式保持一致
- ✅ **易于扩展**：支持自定义检索策略和分析器
- ✅ **模式分离**：CLI模式和LLM模式的知识库使用策略清晰分离

### 12.2 重要原则

⚠️ **CLI模式（完全集成）**：
- CLI模式必须使用CLI知识库（自动处理）
- CLI模式不使用RAG
- CLI知识库失败时，直接标准生成（不回退到RAG）
- 在Action层自动处理，无需Controller层改动

✅ **LLM模式**：
- LLM模式继续使用RAG（完全集成不生效）
- 保持现有RAG流程不变
- 向后兼容，不影响现有功能

### 12.3 注意事项

- ⚠️ CLI执行时间可能较长，需要合理设置超时
- ⚠️ 需要定期更新索引以保持准确性
- ⚠️ 大量文档时需要考虑性能优化
- ⚠️ 需要处理CLI执行失败的情况
- ⚠️ **CLI模式下必须确保CLI知识库可用，否则只能标准生成（不回退到RAG）**

### 12.4 后续优化

- 支持增量索引更新
- 实现文档版本管理
- 添加文档相关性评分
- 支持跨项目文档检索
- 实现文档自动分类和标签

---

**文档版本**: 1.4  
**创建日期**: 2026-01-25  
**最后更新**: 2026-01-25  
**文档状态**: 方案设计完成，包含集成指南  
**下一步**: 技术评审，开始实施阶段1

### 更新日志
- 2026-01-25: **重要更新** - 移除方案A，只保留完全集成方案：
  - 移除方案A（最小改动集成）的所有内容
  - 完全集成方案仅在CLI模式下生效，LLM模式不调用
  - LLM模式继续使用RAG，保持现有流程不变
  - 更新所有代码示例和检查清单
  - 简化配置说明（完全集成无需额外配置）
- 2026-01-25: **重要更新** - 明确CLI模式下不再使用RAG流程：
  - CLI模式下必须使用CLI知识库，不使用RAG
  - LLM模式下可以选择使用CLI知识库或RAG（优先CLI知识库）
  - 更新所有代码示例，明确模式分离
  - 更新配置说明和迁移建议
- 2026-01-25: 新增"6. 与当前流程集成"章节，详细说明如何快速简易地集成CLI知识库到MRD和PRD生成流程中，包括两种集成方案（最小改动集成和完全集成）、配置开关、迁移建议和完整代码示例
