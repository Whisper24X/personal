/**
 * RAG Service
 * Provides Retrieval-Augmented Generation capabilities for PRD and MRD documents
 * Uses Qdrant vector database for semantic search with Rerank and hybrid query support
 * 
 * Enhanced with knowledge categorization for structured knowledge retrieval
 */

import { DocumentRepository } from '../database/repositories/DocumentRepository';
import { KnowledgeBaseRepository } from '../database/repositories/KnowledgeBaseRepository';
import { EmbeddingService } from './EmbeddingService';
import { QdrantService } from './QdrantService';
import { RerankService } from './RerankService';
import { extractKeywords, findSimilarChunks } from '../utils/textSimilarity';
import { logger } from '../utils';
import { 
  KnowledgeType,
  KnowledgeChunk, 
  StructuredKnowledgeContext,
  createEmptyKnowledgeContext,
  categorizeKnowledgeChunks,
} from '../prompts/knowledge';

export interface PRDSearchResult {
  documentId: string;
  version: number;
  content: string;
  similarity: number;
  relevantChunks: Array<{ chunk: string; similarity: number }>;
}

export interface MRDSearchResult {
  documentId: string;
  version: number;
  content: string;
  similarity: number;
  relevantChunks: Array<{ chunk: string; similarity: number }>;
}

export interface KnowledgeBaseSearchResult {
  documentId: string;
  title: string;
  content: string;
  similarity: number;
  relevantChunks: Array<{ chunk: string; similarity: number }>;
}

export class RAGService {
  private documentRepo: DocumentRepository;
  private knowledgeBaseRepo: KnowledgeBaseRepository;
  private embeddingService: EmbeddingService;
  private qdrantService: QdrantService;
  private rerankService: RerankService;
  private useVectorSearch: boolean;
  private useRerank: boolean;
  private useHybridSearch: boolean;

  constructor() {
    this.documentRepo = new DocumentRepository();
    this.knowledgeBaseRepo = new KnowledgeBaseRepository();
    this.embeddingService = new EmbeddingService();
    
    // Initialize Qdrant service (will be initialized with correct vector size later)
    this.qdrantService = new QdrantService('knowledge-base', 1536);
    this.rerankService = new RerankService(this.embeddingService);

    // Feature flags
    this.useVectorSearch = process.env.USE_VECTOR_SEARCH !== 'false'; // Default true
    this.useRerank = process.env.USE_RERANK !== 'false'; // Default true
    this.useHybridSearch = process.env.USE_HYBRID_SEARCH !== 'false'; // Default true (启用混合查询)

    logger.info('RAGService: Initialized', {
      useVectorSearch: this.useVectorSearch,
      useRerank: this.useRerank,
      useHybridSearch: this.useHybridSearch,
    });
  }

  /**
   * Initialize services (call this before first use)
   */
  async initialize(userId?: string): Promise<void> {
    try {
      await this.embeddingService.initialize(userId);
      const vectorSize = this.embeddingService.getVectorSize();
      
      // Reinitialize Qdrant service with correct vector size
      this.qdrantService = new QdrantService('knowledge-base', vectorSize);
      await this.qdrantService.ensureCollection();

      logger.info('RAGService: Services initialized', {
        vectorSize,
      });
    } catch (error: any) {
      logger.warn('RAGService: Failed to initialize vector services, falling back to text similarity', {
        error: error.message,
      });
      this.useVectorSearch = false;
    }
  }

  /**
   * Index documents into Qdrant
   */
  async indexDocuments(
    documents: Array<{ id: string; content: string; type: 'PRD' | 'MRD' | 'KNOWLEDGE_BASE'; projectId?: string; version?: number; title?: string }>
  ): Promise<void> {
    if (!this.useVectorSearch) {
      logger.debug('RAGService: Vector search disabled, skipping indexing');
      return;
    }

    try {
      // Split documents into chunks
      const chunks: Array<{ id: string; text: string; documentId: string; type: string; projectId?: string; version?: number }> = [];
      
      for (const doc of documents) {
        const docChunks = this.splitIntoChunks(doc.content, 500);
        for (let i = 0; i < docChunks.length; i++) {
          chunks.push({
            id: `${doc.id}_chunk_${i}`,
            text: docChunks[i],
            documentId: doc.id,
            type: doc.type,
            projectId: doc.projectId,
            version: doc.version,
          });
        }
      }

      // Generate embeddings for chunks
      const texts = chunks.map(chunk => chunk.text);
      const embeddings = await this.embeddingService.generateEmbeddings(texts);

      // Prepare points for Qdrant
      const points = chunks.map((chunk, index) => {
        const doc = documents.find(d => d.id === chunk.documentId);
        return {
          id: chunk.id,
          vector: embeddings[index],
          payload: {
            text: chunk.text,
            documentId: chunk.documentId,
            type: chunk.type,
            projectId: chunk.projectId,
            version: chunk.version,
            title: doc?.title,
          },
        };
      });

      // Upsert to Qdrant
      await this.qdrantService.upsertPoints(points);

      logger.info('RAGService: Documents indexed', {
        documentCount: documents.length,
        chunkCount: chunks.length,
      });
    } catch (error: any) {
      logger.error('RAGService: Failed to index documents', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Search for similar PRDs in a project based on query
   * Returns PRDs sorted by similarity score
   */
  async searchSimilarPRDs(
    projectId: string,
    query: string,
    limit: number = 5
  ): Promise<PRDSearchResult[]> {
    try {
      logger.info('RAGService: Searching similar PRDs', {
        projectId,
        queryLength: query.length,
        limit,
        useVectorSearch: this.useVectorSearch,
      });

      if (this.useVectorSearch) {
        return await this.searchSimilarPRDsVector(projectId, query, limit);
      } else {
        return await this.searchSimilarPRDsText(projectId, query, limit);
      }
    } catch (error: any) {
      logger.error('RAGService: Failed to search similar PRDs', {
        projectId,
        error: error.message,
      });
      // Fallback to text search
      return await this.searchSimilarPRDsText(projectId, query, limit);
    }
  }

  /**
   * Vector-based search for PRDs
   */
  private async searchSimilarPRDsVector(
    projectId: string,
    query: string,
    limit: number
  ): Promise<PRDSearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Search in Qdrant
    const searchResults = await this.qdrantService.search(queryEmbedding, limit * 2, {
      must: [
        { key: 'type', match: { value: 'PRD' } },
        { key: 'projectId', match: { value: projectId } },
      ],
    });

    // Rerank if enabled
    let rerankedResults = searchResults;
    if (this.useRerank && searchResults.length > 0) {
      rerankedResults = await this.rerankService.rerank(query, searchResults, limit);
    }

    // Group by document and get full content
    const documentMap = new Map<string, PRDSearchResult>();
    
    for (const result of rerankedResults.slice(0, limit)) {
      const payload = result.payload;
      if (!payload || !payload.documentId) continue;

      const docId = payload.documentId as string;
      
      if (!documentMap.has(docId)) {
        // Get full document content
        const doc = await this.documentRepo.findById(docId);
        if (!doc || doc.doc_type !== 'PRD') continue;

        const relevantChunks = findSimilarChunks(doc.content, query, 3);

        documentMap.set(docId, {
          documentId: docId,
          version: payload.version || doc.version || 1,
          content: doc.content,
          similarity: result.score,
          relevantChunks,
        });
      } else {
        // Update similarity if this chunk has higher score
        const existing = documentMap.get(docId)!;
        if (result.score > existing.similarity) {
          existing.similarity = result.score;
        }
      }
    }

    const results = Array.from(documentMap.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    logger.info('RAGService: Vector search completed', {
      projectId,
      resultsCount: results.length,
      topSimilarity: results[0]?.similarity || 0,
    });

    return results;
  }

  /**
   * Text-based search for PRDs (fallback)
   */
  private async searchSimilarPRDsText(
    projectId: string,
    query: string,
    limit: number
  ): Promise<PRDSearchResult[]> {
    const allPRDs = await this.documentRepo.findPRDsByProject(projectId, false);

    if (allPRDs.length === 0) {
      logger.info('RAGService: No PRDs found for project', { projectId });
      return [];
    }

    const results: PRDSearchResult[] = [];

    for (const prd of allPRDs) {
      const similarity = this.calculateTextSimilarity(prd.content, query);
      const relevantChunks = findSimilarChunks(prd.content, query, 3);

      results.push({
        documentId: prd.id,
        version: prd.version || 1,
        content: prd.content,
        similarity,
        relevantChunks,
      });
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .filter(result => result.similarity > 0.1);
  }

  /**
   * Search for similar PRDs across all projects in an application
   */
  async searchSimilarPRDsByApplication(
    applicationId: string,
    query: string,
    limit: number = 5
  ): Promise<PRDSearchResult[]> {
    try {
      logger.info('RAGService: Searching similar PRDs by application', {
        applicationId,
        queryLength: query.length,
        limit,
      });

      if (this.useVectorSearch) {
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);
        const searchResults = await this.qdrantService.search(queryEmbedding, limit * 2, {
          must: [
            { key: 'type', match: { value: 'PRD' } },
          ],
        });

        let rerankedResults = searchResults;
        if (this.useRerank && searchResults.length > 0) {
          rerankedResults = await this.rerankService.rerank(query, searchResults, limit);
        }

        const documentMap = new Map<string, PRDSearchResult>();
        
        for (const result of rerankedResults.slice(0, limit)) {
          const payload = result.payload;
          if (!payload || !payload.documentId) continue;

          const docId = payload.documentId as string;
          
          if (!documentMap.has(docId)) {
            const doc = await this.documentRepo.findById(docId);
            if (!doc || doc.doc_type !== 'PRD') continue;

            const relevantChunks = findSimilarChunks(doc.content, query, 3);

            documentMap.set(docId, {
              documentId: docId,
              version: payload.version || doc.version || 1,
              content: doc.content,
              similarity: result.score,
              relevantChunks,
            });
          }
        }

        return Array.from(documentMap.values())
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
      } else {
        const allPRDs = await this.documentRepo.findPRDsByApplication(applicationId, false);
        const results: PRDSearchResult[] = [];

        for (const prd of allPRDs) {
          const similarity = this.calculateTextSimilarity(prd.content, query);
          const relevantChunks = findSimilarChunks(prd.content, query, 3);

          results.push({
            documentId: prd.id,
            version: prd.version || 1,
            content: prd.content,
            similarity,
            relevantChunks,
          });
        }

        return results
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit)
          .filter(result => result.similarity > 0.1);
      }
    } catch (error: any) {
      logger.error('RAGService: Failed to search similar PRDs by application', {
        applicationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Search for similar MRDs in a project based on query
   */
  async searchSimilarMRDs(
    projectId: string,
    query: string,
    limit: number = 5
  ): Promise<MRDSearchResult[]> {
    try {
      logger.info('RAGService: Searching similar MRDs', {
        projectId,
        queryLength: query.length,
        limit,
      });

      if (this.useVectorSearch) {
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);
        const searchResults = await this.qdrantService.search(queryEmbedding, limit * 2, {
          must: [
            { key: 'type', match: { value: 'MRD' } },
            { key: 'projectId', match: { value: projectId } },
          ],
        });

        let rerankedResults = searchResults;
        if (this.useRerank && searchResults.length > 0) {
          rerankedResults = await this.rerankService.rerank(query, searchResults, limit);
        }

        const documentMap = new Map<string, MRDSearchResult>();
        
        for (const result of rerankedResults.slice(0, limit)) {
          const payload = result.payload;
          if (!payload || !payload.documentId) continue;

          const docId = payload.documentId as string;
          
          if (!documentMap.has(docId)) {
            const doc = await this.documentRepo.findById(docId);
            if (!doc || doc.doc_type !== 'MRD') continue;

            const relevantChunks = findSimilarChunks(doc.content, query, 3);

            documentMap.set(docId, {
              documentId: docId,
              version: payload.version || doc.version || 1,
              content: doc.content,
              similarity: result.score,
              relevantChunks,
            });
          }
        }

        return Array.from(documentMap.values())
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
      } else {
        const allMRDs = await this.documentRepo.findMRDsByProject(projectId, false);

        if (allMRDs.length === 0) {
          return [];
        }

        const results: MRDSearchResult[] = [];

        for (const mrd of allMRDs) {
          const similarity = this.calculateTextSimilarity(mrd.content, query);
          const relevantChunks = findSimilarChunks(mrd.content, query, 3);

          results.push({
            documentId: mrd.id,
            version: mrd.version || 1,
            content: mrd.content,
            similarity,
            relevantChunks,
          });
        }

        return results
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit)
          .filter(result => result.similarity > 0.1);
      }
    } catch (error: any) {
      logger.error('RAGService: Failed to search similar MRDs', {
        projectId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Search for similar MRDs across all projects in an application
   */
  async searchSimilarMRDsByApplication(
    applicationId: string,
    query: string,
    limit: number = 5
  ): Promise<MRDSearchResult[]> {
    try {
      logger.info('RAGService: Searching similar MRDs by application', {
        applicationId,
        queryLength: query.length,
        limit,
      });

      if (this.useVectorSearch) {
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);
        const searchResults = await this.qdrantService.search(queryEmbedding, limit * 2, {
          must: [
            { key: 'type', match: { value: 'MRD' } },
          ],
        });

        let rerankedResults = searchResults;
        if (this.useRerank && searchResults.length > 0) {
          rerankedResults = await this.rerankService.rerank(query, searchResults, limit);
        }

        const documentMap = new Map<string, MRDSearchResult>();
        
        for (const result of rerankedResults.slice(0, limit)) {
          const payload = result.payload;
          if (!payload || !payload.documentId) continue;

          const docId = payload.documentId as string;
          
          if (!documentMap.has(docId)) {
            const doc = await this.documentRepo.findById(docId);
            if (!doc || doc.doc_type !== 'MRD') continue;

            const relevantChunks = findSimilarChunks(doc.content, query, 3);

            documentMap.set(docId, {
              documentId: docId,
              version: payload.version || doc.version || 1,
              content: doc.content,
              similarity: result.score,
              relevantChunks,
            });
          }
        }

        return Array.from(documentMap.values())
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
      } else {
        const allMRDs = await this.documentRepo.findMRDsByApplication(applicationId, false);
        const results: MRDSearchResult[] = [];

        for (const mrd of allMRDs) {
          const similarity = this.calculateTextSimilarity(mrd.content, query);
          const relevantChunks = findSimilarChunks(mrd.content, query, 3);

          results.push({
            documentId: mrd.id,
            version: mrd.version || 1,
            content: mrd.content,
            similarity,
            relevantChunks,
          });
        }

        return results
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit)
          .filter(result => result.similarity > 0.1);
      }
    } catch (error: any) {
      logger.error('RAGService: Failed to search similar MRDs by application', {
        applicationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Combine multiple PRD search results into a single context
   */
  combinePRDResults(results: PRDSearchResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const combined: string[] = [];

    for (const result of results) {
      combined.push(`## PRD Version ${result.version} (Similarity: ${result.similarity.toFixed(3)})`);
      combined.push('');

      if (result.relevantChunks.length > 0) {
        combined.push('### Relevant Sections:');
        for (const chunk of result.relevantChunks) {
          combined.push(chunk.chunk);
          combined.push('');
        }
      } else {
        const preview = result.content.substring(0, 1000);
        combined.push(preview);
        if (result.content.length > 1000) {
          combined.push('...');
        }
        combined.push('');
      }

      combined.push('---');
      combined.push('');
    }

    return combined.join('\n');
  }

  /**
   * Combine multiple MRD search results into a single context
   */
  combineMRDResults(results: MRDSearchResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const combined: string[] = [];

    for (const result of results) {
      combined.push(`## MRD Version ${result.version} (Similarity: ${result.similarity.toFixed(3)})`);
      combined.push('');

      if (result.relevantChunks.length > 0) {
        combined.push('### Relevant Sections:');
        for (const chunk of result.relevantChunks) {
          combined.push(chunk.chunk);
          combined.push('');
        }
      } else {
        const preview = result.content.substring(0, 1000);
        combined.push(preview);
        if (result.content.length > 1000) {
          combined.push('...');
        }
        combined.push('');
      }

      combined.push('---');
      combined.push('');
    }

    return combined.join('\n');
  }

  /**
   * Get relevant chunks from PRD content
   */
  getRelevantPRDChunks(
    prdContent: string,
    query: string,
    topK: number = 5
  ): Array<{ chunk: string; similarity: number }> {
    return findSimilarChunks(prdContent, query, topK);
  }

  /**
   * Get relevant chunks from MRD content
   */
  getRelevantMRDChunks(
    mrdContent: string,
    query: string,
    topK: number = 5
  ): Array<{ chunk: string; similarity: number }> {
    return findSimilarChunks(mrdContent, query, topK);
  }

  /**
   * Split text into chunks
   */
  private splitIntoChunks(text: string, chunkSize: number = 500): string[] {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph.length <= chunkSize) {
        chunks.push(paragraph.trim());
      } else {
        const sentences = paragraph.split(/[.!?]+\s+/);
        let currentChunk = '';

        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= chunkSize) {
            currentChunk += sentence + '. ';
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = sentence + '. ';
          }
        }

        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
      }
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Calculate text similarity (fallback method)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const tokens1 = text1.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
    const tokens2 = text2.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);

    if (tokens1.length === 0 || tokens2.length === 0) {
      return 0;
    }

    const freq1 = new Map<string, number>();
    const freq2 = new Map<string, number>();

    for (const token of tokens1) {
      freq1.set(token, (freq1.get(token) || 0) + 1);
    }
    for (const token of tokens2) {
      freq2.set(token, (freq2.get(token) || 0) + 1);
    }

    const allWords = new Set([...freq1.keys(), ...freq2.keys()]);
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const word of allWords) {
      const count1 = freq1.get(word) || 0;
      const count2 = freq2.get(word) || 0;
      dotProduct += count1 * count2;
      magnitude1 += count1 * count1;
      magnitude2 += count2 * count2;
    }

    const denominator = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Search knowledge base documents
   * Supports both vector search and hybrid search
   */
  async searchKnowledgeBase(
    projectId: string,
    query: string,
    limit: number = 5
  ): Promise<KnowledgeBaseSearchResult[]> {
    try {
      logger.info('RAGService: Searching knowledge base', {
        projectId,
        queryLength: query.length,
        limit,
        useVectorSearch: this.useVectorSearch,
        useHybridSearch: this.useHybridSearch,
      });

      if (this.useVectorSearch) {
        return await this.searchKnowledgeBaseVector(projectId, query, limit);
      } else {
        return await this.searchKnowledgeBaseText(projectId, query, limit);
      }
    } catch (error: any) {
      logger.error('RAGService: Failed to search knowledge base', {
        projectId,
        error: error.message,
      });
      // Fallback to text search
      return await this.searchKnowledgeBaseText(projectId, query, limit);
    }
  }

  /**
   * Vector-based search for knowledge base documents
   */
  private async searchKnowledgeBaseVector(
    projectId: string,
    query: string,
    limit: number
  ): Promise<KnowledgeBaseSearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Extract keywords for hybrid search
    const keywords = extractKeywords(query, 10);
    
    // Search in Qdrant
    const searchResults = await this.qdrantService.search(queryEmbedding, limit * 2, {
      must: [
        { key: 'type', match: { value: 'KNOWLEDGE_BASE' } },
        { key: 'projectId', match: { value: projectId } },
      ],
    });

    // If hybrid search is enabled, also search by keywords
    let hybridResults = searchResults;
    if (this.useHybridSearch && keywords.length > 0) {
      // Get all knowledge base documents for keyword matching
      const allDocs = await this.knowledgeBaseRepo.findByProjectId(projectId);
      
      // Calculate keyword-based similarity
      const keywordResults = allDocs
        .map(doc => {
          const keywordSimilarity = this.calculateKeywordSimilarity(
            doc.content,
            keywords.join(' ')
          );
          return {
            id: doc.id,
            score: keywordSimilarity,
            payload: {
              text: doc.content,
              documentId: doc.id,
              type: 'KNOWLEDGE_BASE',
              projectId: projectId,
              title: doc.title,
            },
          };
        })
        .filter(r => r.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Merge vector and keyword results
      const vectorMap = new Map(searchResults.map(r => [r.id, r]));
      const keywordMap = new Map(keywordResults.map(r => [r.id, r]));

      // Combine results with weighted scores
      const combined = new Map<string, any>();
      
      for (const [id, result] of vectorMap) {
        const idStr = String(id);
        const keywordResult = keywordMap.get(idStr);
        const combinedScore = keywordResult
          ? 0.6 * result.score + 0.4 * keywordResult.score
          : result.score;
        combined.set(idStr, { ...result, score: combinedScore });
      }

      // Add keyword-only results
      for (const [id, result] of keywordMap) {
        if (!combined.has(id)) {
          combined.set(id, result);
        }
      }

      hybridResults = Array.from(combined.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit * 2);
    }

    // Rerank if enabled
    let rerankedResults = hybridResults;
    if (this.useRerank && hybridResults.length > 0) {
      rerankedResults = await this.rerankService.rerank(query, hybridResults, limit);
    }

    // Get full document content
    const results: KnowledgeBaseSearchResult[] = [];
    const processedIds = new Set<string>();

    for (const result of rerankedResults.slice(0, limit)) {
      const payload = result.payload;
      if (!payload || !payload.documentId) continue;

      const docId = payload.documentId as string;
      if (processedIds.has(docId)) continue;
      processedIds.add(docId);

      const doc = await this.knowledgeBaseRepo.findById(docId);
      if (!doc || !doc.is_active) continue;

      const relevantChunks = findSimilarChunks(doc.content, query, 3);

      results.push({
        documentId: docId,
        title: doc.title,
        content: doc.content,
        similarity: result.score,
        relevantChunks,
      });
    }

    logger.info('RAGService: Knowledge base vector search completed', {
      projectId,
      resultsCount: results.length,
      topSimilarity: results[0]?.similarity || 0,
    });

    return results;
  }

  /**
   * Text-based search for knowledge base documents (fallback)
   */
  private async searchKnowledgeBaseText(
    projectId: string,
    query: string,
    limit: number
  ): Promise<KnowledgeBaseSearchResult[]> {
    const allDocs = await this.knowledgeBaseRepo.findByProjectId(projectId);
    const results: KnowledgeBaseSearchResult[] = [];

    for (const doc of allDocs) {
      if (!doc.is_active) continue;

      const similarity = this.calculateTextSimilarity(doc.content, query);
      const relevantChunks = findSimilarChunks(doc.content, query, 3);

      results.push({
        documentId: doc.id,
        title: doc.title,
        content: doc.content,
        similarity,
        relevantChunks,
      });
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .filter(result => result.similarity > 0.1);
  }

  /**
   * Calculate keyword-based similarity
   */
  private calculateKeywordSimilarity(text: string, keywords: string): number {
    const textLower = text.toLowerCase();
    const keywordsLower = keywords.toLowerCase();
    const keywordList = keywordsLower.split(/\s+/).filter(k => k.length > 0);

    if (keywordList.length === 0) {
      return 0;
    }

    let matchCount = 0;
    for (const keyword of keywordList) {
      if (textLower.includes(keyword)) {
        matchCount++;
      }
    }

    return matchCount / keywordList.length;
  }

  // ===============================================
  // 知识分类检索能力 - Knowledge Categorization
  // ===============================================

  /**
   * 按知识类型检索知识库
   * @param projectId 项目ID
   * @param query 查询文本
   * @param knowledgeType 知识类型
   * @param limit 返回数量限制
   * @returns 分类后的知识片段
   */
  async searchByKnowledgeType(
    projectId: string,
    query: string,
    knowledgeType: KnowledgeType,
    limit: number = 5
  ): Promise<KnowledgeChunk[]> {
    try {
      logger.info('RAGService: Searching by knowledge type', {
        projectId,
        knowledgeType,
        queryLength: query.length,
        limit,
      });

      // 根据知识类型搜索不同来源
      let results: KnowledgeChunk[] = [];

      switch (knowledgeType) {
        case KnowledgeType.HISTORY_PRD:
          results = await this.searchHistoryPRDs(projectId, query, limit);
          break;
        case KnowledgeType.HISTORY_MRD:
          results = await this.searchHistoryMRDs(projectId, query, limit);
          break;
        case KnowledgeType.BUSINESS_RULES:
        case KnowledgeType.TERMINOLOGY:
        case KnowledgeType.TECH_CONSTRAINTS:
        case KnowledgeType.FEATURE_LIST:
        case KnowledgeType.COMPETITOR_ANALYSIS:
        case KnowledgeType.DEV_SPEC:
          results = await this.searchKnowledgeBaseByType(projectId, query, knowledgeType, limit);
          break;
        default:
          logger.warn('RAGService: Unknown knowledge type', { knowledgeType });
      }

      return results;
    } catch (error: any) {
      logger.error('RAGService: Failed to search by knowledge type', {
        projectId,
        knowledgeType,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * 检索历史PRD并转换为知识片段
   */
  private async searchHistoryPRDs(
    projectId: string,
    query: string,
    limit: number
  ): Promise<KnowledgeChunk[]> {
    const prdResults = await this.searchSimilarPRDs(projectId, query, limit);
    
    return prdResults.flatMap(result => 
      result.relevantChunks.map(chunk => ({
        content: chunk.chunk,
        type: KnowledgeType.HISTORY_PRD,
        sourceDocumentId: result.documentId,
        sourceTitle: `PRD v${result.version}`,
        similarity: chunk.similarity,
      }))
    );
  }

  /**
   * 检索历史MRD并转换为知识片段
   */
  private async searchHistoryMRDs(
    projectId: string,
    query: string,
    limit: number
  ): Promise<KnowledgeChunk[]> {
    const mrdResults = await this.searchSimilarMRDs(projectId, query, limit);
    
    return mrdResults.flatMap(result => 
      result.relevantChunks.map(chunk => ({
        content: chunk.chunk,
        type: KnowledgeType.HISTORY_MRD,
        sourceDocumentId: result.documentId,
        sourceTitle: `MRD v${result.version}`,
        similarity: chunk.similarity,
      }))
    );
  }

  /**
   * 按知识类型检索知识库文档
   */
  private async searchKnowledgeBaseByType(
    projectId: string,
    query: string,
    knowledgeType: KnowledgeType,
    limit: number
  ): Promise<KnowledgeChunk[]> {
    const kbResults = await this.searchKnowledgeBase(projectId, query, limit * 2);
    
    // 根据知识类型过滤和标记结果
    // Note: KNOWLEDGE_TYPE_LABELS and KNOWLEDGE_TYPE_PATHS can be used for 
    // more advanced filtering based on document paths in future enhancements
    
    // 过滤：如果文档标题或内容包含相关关键词
    const filteredResults = kbResults.filter(result => {
      const titleLower = result.title.toLowerCase();
      const contentLower = result.content.toLowerCase();
      
      // 简单的关键词匹配来判断知识类型
      switch (knowledgeType) {
        case KnowledgeType.BUSINESS_RULES:
          return titleLower.includes('规则') || titleLower.includes('rule') ||
                 contentLower.includes('业务规则') || contentLower.includes('business rule');
        case KnowledgeType.TERMINOLOGY:
          return titleLower.includes('术语') || titleLower.includes('词典') ||
                 titleLower.includes('glossary') || titleLower.includes('terminology');
        case KnowledgeType.TECH_CONSTRAINTS:
          return titleLower.includes('约束') || titleLower.includes('技术') ||
                 titleLower.includes('constraint') || titleLower.includes('technical');
        case KnowledgeType.FEATURE_LIST:
          return titleLower.includes('功能') || titleLower.includes('feature') ||
                 titleLower.includes('清单') || titleLower.includes('list');
        case KnowledgeType.COMPETITOR_ANALYSIS:
          return titleLower.includes('竞品') || titleLower.includes('competitor') ||
                 titleLower.includes('分析') || titleLower.includes('analysis');
        case KnowledgeType.DEV_SPEC:
          return titleLower.includes('规范') || titleLower.includes('spec') ||
                 titleLower.includes('开发') || titleLower.includes('development');
        default:
          return true; // 不过滤
      }
    });

    // 如果过滤后没有结果，返回所有结果（带标记）
    const resultsToUse = filteredResults.length > 0 ? filteredResults : kbResults;

    return resultsToUse.slice(0, limit).flatMap(result =>
      result.relevantChunks.map(chunk => ({
        content: chunk.chunk,
        type: knowledgeType,
        sourceDocumentId: result.documentId,
        sourceTitle: result.title,
        similarity: chunk.similarity,
      }))
    );
  }

  /**
   * 获取结构化知识上下文
   * 按多种知识类型并行检索，返回分类整理后的知识上下文
   * 
   * @param projectId 项目ID
   * @param query 查询文本
   * @param knowledgeTypes 需要检索的知识类型数组
   * @param limitPerType 每种类型的返回数量限制
   * @returns 结构化知识上下文
   */
  async getStructuredKnowledgeContext(
    projectId: string,
    query: string,
    knowledgeTypes: KnowledgeType[],
    limitPerType: number = 3
  ): Promise<StructuredKnowledgeContext> {
    try {
      logger.info('RAGService: Getting structured knowledge context', {
        projectId,
        knowledgeTypes,
        queryLength: query.length,
        limitPerType,
      });

      // 并行检索所有知识类型
      const searchPromises = knowledgeTypes.map(type =>
        this.searchByKnowledgeType(projectId, query, type, limitPerType)
      );

      const results = await Promise.all(searchPromises);
      
      // 合并所有结果
      const allChunks: KnowledgeChunk[] = results.flat();
      
      // 分类整理
      const context = categorizeKnowledgeChunks(allChunks);

      logger.info('RAGService: Structured knowledge context retrieved', {
        projectId,
        totalChunks: allChunks.length,
        terminologyCount: context.terminology.length,
        businessRulesCount: context.businessRules.length,
        existingFeaturesCount: context.existingFeatures.length,
        techConstraintsCount: context.techConstraints.length,
        competitorsCount: context.competitors.length,
        historyPRDCount: context.historyPRD.length,
        historyMRDCount: context.historyMRD.length,
        devSpecCount: context.devSpec.length,
      });

      return context;
    } catch (error: any) {
      logger.error('RAGService: Failed to get structured knowledge context', {
        projectId,
        error: error.message,
      });
      return createEmptyKnowledgeContext();
    }
  }

  /**
   * Combine knowledge base search results into a single context string
   */
  combineKnowledgeBaseResults(results: KnowledgeBaseSearchResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const combined: string[] = [];

    for (const result of results) {
      combined.push(`## ${result.title} (Similarity: ${result.similarity.toFixed(3)})`);
      combined.push('');

      if (result.relevantChunks.length > 0) {
        combined.push('### Relevant Sections:');
        for (const chunk of result.relevantChunks) {
          combined.push(chunk.chunk);
          combined.push('');
        }
      } else {
        const preview = result.content.substring(0, 1000);
        combined.push(preview);
        if (result.content.length > 1000) {
          combined.push('...');
        }
        combined.push('');
      }

      combined.push('---');
      combined.push('');
    }

    return combined.join('\n');
  }
}

export default RAGService;

// 导出知识分类相关类型
export { KnowledgeType, KnowledgeChunk, StructuredKnowledgeContext };
