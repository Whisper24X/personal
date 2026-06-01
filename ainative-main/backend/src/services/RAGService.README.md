# RAG Service 使用指南

## 概述

`RAGService` 是一个基于 Qdrant 向量数据库的检索增强生成（Retrieval-Augmented Generation）服务，用于在 PRD（产品需求文档）和 MRD（市场需求文档）中进行语义相似度检索。

## 功能特性

- ✅ **向量搜索**：使用 Qdrant 向量数据库进行高效的语义搜索
- ✅ **Rerank 重排序**：对检索结果进行重排序，提升结果相关性
- ✅ **混合查询**：默认启用，结合关键词搜索和向量搜索，提升检索效果
- ✅ **自动索引**：文档创建后自动索引到 Qdrant
- ✅ **知识库支持**：支持项目级别的知识库文档管理
- ✅ **多提供商支持**：支持 OpenAI、ZhipuAI、ARK 等多种 LLM 提供商的 embedding API
- ✅ **降级支持**：如果向量搜索不可用，自动降级到文本相似度搜索

## 架构

```
用户查询
  ↓
EmbeddingService (生成查询向量)
  ↓
QdrantService (向量搜索)
  ↓
RerankService (重排序)
  ↓
返回最相关的文档
```

## 环境配置

在 `.env` 文件中配置以下环境变量：

```bash
# Qdrant配置
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key  # 可选

# RAG功能开关
USE_VECTOR_SEARCH=true
USE_RERANK=true
USE_HYBRID_SEARCH=true  # 默认启用混合查询
```

## 安装和启动 Qdrant

### 使用 Docker

```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 使用 Docker Compose

```yaml
version: '3.8'
services:
  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - ./qdrant_storage:/qdrant/storage
```

## 基本使用

### 1. 初始化 RAG Service

```typescript
import { RAGService } from '../services/RAGService';

const ragService = new RAGService();

// 初始化（会自动检测激活的模型配置）
await ragService.initialize();
```

### 2. 索引文档

文档创建后会自动索引，也可以手动索引：

```typescript
await ragService.indexDocuments([
  {
    id: 'doc-1',
    content: '文档内容...',
    type: 'PRD',
    projectId: 'project-1',
    version: 1,
  },
]);
```

### 3. 搜索相似文档

```typescript
// 搜索项目内的相似 PRD
const results = await ragService.searchSimilarPRDs(
  'project-id',
  '用户需求描述',
  5  // 返回前5个结果
);

// 搜索应用内的相似 PRD
const appResults = await ragService.searchSimilarPRDsByApplication(
  'application-id',
  '用户需求描述',
  5
);
```

## 知识库功能

知识库功能允许为项目添加额外的文档作为知识库，这些文档会被自动索引到 Qdrant，并在 RAG 搜索中使用。

### 创建知识库文档

```typescript
// 通过 API 创建知识库文档
POST /api/projects/:projectId/knowledge-base
{
  "title": "技术规范",
  "content": "文档内容...",
  "description": "可选描述",
  "tags": ["技术", "规范"],
  "metadata": {}
}
```

### 搜索知识库

```typescript
// 搜索知识库文档
POST /api/projects/:projectId/knowledge-base/search
{
  "query": "查询文本",
  "limit": 5
}
```

### 知识库 API

- `POST /api/projects/:id/knowledge-base` - 创建知识库文档
- `GET /api/projects/:id/knowledge-base` - 列出所有知识库文档
- `GET /api/projects/:id/knowledge-base/:docId` - 获取单个文档
- `PUT /api/projects/:id/knowledge-base/:docId` - 更新文档
- `DELETE /api/projects/:id/knowledge-base/:docId` - 删除文档
- `POST /api/projects/:id/knowledge-base/search` - 搜索文档

## 支持的 Embedding 提供商

### OpenAI
- 模型：`text-embedding-ada-002`（默认）、`text-embedding-3-small`、`text-embedding-3-large`
- 向量维度：1536（ada-002）或 3072（3-large）

### ZhipuAI
- 模型：`text-embedding-2`
- 向量维度：1024

### ARK (豆包)
- 模型：`text-embedding`
- 向量维度：1024

## 工作流程

1. **文档创建**：当 PRD 或 MRD 创建时，自动调用 `indexDocuments` 将文档分块并索引到 Qdrant
2. **查询处理**：
   - 用户输入查询文本
   - EmbeddingService 生成查询向量
   - QdrantService 执行向量搜索
   - RerankService 对结果重排序（如果启用）
   - 返回最相关的文档片段
3. **结果合并**：使用 `combinePRDResults` 或 `combineMRDResults` 将多个结果合并为上下文

## 性能优化

- **批量处理**：EmbeddingService 支持批量生成 embeddings
- **分块索引**：文档自动分块（默认 500 字符），提升检索精度
- **缓存**：LLM 配置缓存，减少数据库查询
- **降级机制**：如果向量搜索失败，自动降级到文本相似度搜索

## 故障排查

### Qdrant 连接失败

1. 检查 Qdrant 服务是否运行：`curl http://localhost:6333/health`
2. 检查 `QDRANT_URL` 环境变量是否正确
3. 查看日志中的错误信息

### Embedding 生成失败

1. 检查 LLM 配置是否正确（API Key、Base URL）
2. 检查激活的模型是否支持 embedding API
3. 查看 EmbeddingService 日志

### 搜索结果为空

1. 确认文档已正确索引到 Qdrant
2. 检查 Qdrant 集合是否存在：`curl http://localhost:6333/collections/knowledge-base`
3. 检查知识库文档是否已创建并激活
4. 确认项目 ID 正确

## API 参考

### RAGService

- `initialize(userId?: string)`: 初始化服务
- `indexDocuments(documents)`: 索引文档到 Qdrant（支持 PRD、MRD、KNOWLEDGE_BASE）
- `searchSimilarPRDs(projectId, query, limit)`: 搜索相似 PRD
- `searchSimilarMRDs(projectId, query, limit)`: 搜索相似 MRD
- `searchKnowledgeBase(projectId, query, limit)`: 搜索知识库文档
- `combinePRDResults(results)`: 合并 PRD 搜索结果
- `combineMRDResults(results)`: 合并 MRD 搜索结果

### EmbeddingService

- `initialize(userId?: string)`: 初始化 embedding 服务
- `generateEmbedding(text)`: 生成单个文本的 embedding
- `generateEmbeddings(texts)`: 批量生成 embeddings

### QdrantService

- `ensureCollection()`: 确保集合存在
- `upsertPoints(points)`: 插入或更新向量点
- `search(queryVector, limit, filter)`: 搜索相似向量
- `deletePoints(ids)`: 删除向量点

### RerankService

- `rerank(query, results, topN)`: 对搜索结果重排序

## 示例

完整示例请参考：
- `backend/src/api/controllers/PRDController.ts`
- `backend/src/api/controllers/MRDController.ts`
- `backend/src/api/controllers/KnowledgeBaseController.ts`

