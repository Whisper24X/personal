# RAGService 使用指南

## 概述

`RAGService` 是一个检索增强生成（Retrieval-Augmented Generation）服务，用于在 PRD（产品需求文档）和 MRD（市场需求文档）中进行相似文档检索。它支持基于文本相似度的检索，并可选择性地使用 LangChain 进行增强。

## 功能特性

- ✅ **PRD 检索**：在项目或应用范围内搜索相似的 PRD 文档
- ✅ **MRD 检索**：在项目或应用范围内搜索相似的 MRD 文档
- ✅ **文本相似度计算**：使用余弦相似度算法进行文档匹配
- ✅ **相关片段提取**：从文档中提取与查询最相关的文本片段
- ✅ **结果合并**：将多个搜索结果合并为统一的上下文
- 🔄 **LangChain 支持**（可选）：如果配置了 OpenAI API Key，可以使用 LangChain 增强检索

## 基本使用

### 1. 导入和初始化

```typescript
import { RAGService } from '../services/RAGService';

// 创建 RAGService 实例
const ragService = new RAGService();
```

### 2. 搜索相似的 PRD 文档

#### 在项目范围内搜索

```typescript
// 搜索项目内相似的 PRD
const results = await ragService.searchSimilarPRDs(
  projectId: string,      // 项目 ID
  query: string,          // 查询文本（用户需求）
  limit: number = 5       // 返回结果数量限制（默认 5）
);

// 返回结果格式
interface PRDSearchResult {
  documentId: string;     // 文档 ID
  version: number;        // 版本号
  content: string;        // 文档内容
  similarity: number;     // 相似度分数 (0-1)
  relevantChunks: Array<{ // 相关文本片段
    chunk: string;
    similarity: number;
  }>;
}
```

#### 在应用范围内搜索

```typescript
// 搜索应用内所有项目的相似 PRD
const results = await ragService.searchSimilarPRDsByApplication(
  applicationId: string,  // 应用 ID
  query: string,          // 查询文本
  limit: number = 5       // 返回结果数量限制
);
```

### 3. 搜索相似的 MRD 文档

#### 在项目范围内搜索

```typescript
const results = await ragService.searchSimilarMRDs(
  projectId: string,
  query: string,
  limit: number = 5
);
```

#### 在应用范围内搜索

```typescript
const results = await ragService.searchSimilarMRDsByApplication(
  applicationId: string,
  query: string,
  limit: number = 5
);
```

### 4. 提取相关文本片段

```typescript
// 从 PRD 内容中提取相关片段
const chunks = ragService.getRelevantPRDChunks(
  prdContent: string,     // PRD 文档内容
  query: string,          // 查询文本
  topK: number = 5        // 返回的片段数量
);

// 从 MRD 内容中提取相关片段
const chunks = ragService.getRelevantMRDChunks(
  mrdContent: string,
  query: string,
  topK: number = 5
);
```

### 5. 合并搜索结果

```typescript
// 合并多个 PRD 搜索结果为一个上下文字符串
const combinedContext = ragService.combinePRDResults(searchResults);

// 合并多个 MRD 搜索结果
const combinedContext = ragService.combineMRDResults(searchResults);
```

## 实际使用示例

### 示例 1：在 PRD 生成中使用 RAG

```typescript
import { RAGService } from '../services/RAGService';
import { WritePRD } from '../actions/WritePRD';

const ragService = new RAGService();
const writePRDAction = new WritePRD();

async function generatePRDWithRAG(projectId: string, requirements: string) {
  // 1. 搜索相似的 PRD
  const searchResults = await ragService.searchSimilarPRDs(
    projectId,
    requirements,
    5
  );

  // 2. 合并搜索结果
  const relevantChunks = ragService.combinePRDResults(searchResults);

  // 3. 使用 RAG 结果生成新的 PRD
  const result = await writePRDAction.run(requirements, {
    mode: 'new',
    useRAG: true,
    relevantChunks,
    projectId,
  });

  return result;
}
```

### 示例 2：跨应用搜索（优先应用级别，回退到项目级别）

```typescript
async function searchWithFallback(
  projectId: string,
  applicationId: string | null,
  query: string
) {
  let searchResults: PRDSearchResult[] = [];

  // 优先在应用范围内搜索
  if (applicationId) {
    searchResults = await ragService.searchSimilarPRDsByApplication(
      applicationId,
      query,
      5
    );
  }

  // 如果应用级别没有结果，回退到项目级别
  if (searchResults.length === 0) {
    searchResults = await ragService.searchSimilarPRDs(projectId, query, 3);
  }

  return searchResults;
}
```

### 示例 3：提取和使用相关片段

```typescript
async function extractRelevantContent(
  documentContent: string,
  query: string
) {
  // 提取最相关的 5 个片段
  const chunks = ragService.getRelevantPRDChunks(
    documentContent,
    query,
    5
  );

  // 使用片段构建上下文
  const context = chunks
    .map((chunk, index) => `片段 ${index + 1} (相似度: ${chunk.similarity.toFixed(3)}):\n${chunk.chunk}`)
    .join('\n\n---\n\n');

  return context;
}
```

## 配置说明

### 环境变量

- `OPENAI_API_KEY`（可选）：如果设置了此环境变量且安装了 `@langchain/openai`，RAGService 会尝试使用 LangChain 进行增强检索
  - 注意：当前实现中，即使配置了 LangChain，实际检索仍使用文本相似度算法作为回退

### 依赖项

- **必需**：
  - `DocumentRepository`：用于访问数据库中的文档
  - `textSimilarity` 工具：提供文本相似度计算功能

- **可选**：
  - `@langchain/openai`：用于 LangChain 增强（如果可用）

## 工作原理

1. **关键词提取**：从查询文本中提取关键词，增强匹配效果
2. **相似度计算**：使用余弦相似度算法计算文档与查询的相似度
3. **文档分块**：将文档内容分割成段落或句子块
4. **片段匹配**：找出与查询最相关的文本片段
5. **结果排序**：按相似度降序排列，过滤低相似度结果（阈值：0.1）

## 注意事项

1. **相似度阈值**：默认过滤掉相似度低于 0.1 的结果
2. **性能考虑**：对于大量文档，搜索可能需要一些时间
3. **LangChain 状态**：当前 LangChain 集成是部分实现的，实际仍使用文本相似度算法
4. **空结果处理**：如果没有找到匹配的文档，方法会返回空数组

## 在项目中的实际应用

在 `PRDController` 和 `MRDController` 中，RAGService 被用于：

1. **更新模式**：在更新现有文档时，搜索相似的历史文档作为参考
2. **RAG 模式**：在生成新文档时，检索相关的历史文档片段来增强生成质量
3. **跨项目检索**：当项目属于某个应用时，可以在应用范围内搜索相关文档

## 相关文件

- `backend/src/services/RAGService.ts` - RAGService 实现
- `backend/src/utils/textSimilarity.ts` - 文本相似度工具
- `backend/src/database/repositories/DocumentRepository.ts` - 文档数据访问
- `backend/src/api/controllers/PRDController.ts` - PRD API 控制器（使用示例）
- `backend/src/api/controllers/MRDController.ts` - MRD API 控制器（使用示例）

