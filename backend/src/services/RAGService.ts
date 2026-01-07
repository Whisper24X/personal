/**
 * RAG Service
 * Provides Retrieval-Augmented Generation capabilities for PRD and MRD documents
 * Uses LangChain for enhanced document retrieval and vector search
 * Falls back to simple text similarity algorithms if LangChain is not available
 */

import { DocumentRepository } from '../database/repositories/DocumentRepository';
import { calculateCosineSimilarity, findSimilarChunks, extractKeywords } from '../utils/textSimilarity';
import { logger } from '../utils';

// LangChain imports (optional, will fallback if not available)
let useLangChain = false;
let OpenAIEmbeddings: any;

try {
  // Try to import LangChain components
  OpenAIEmbeddings = require('@langchain/openai').OpenAIEmbeddings;
  useLangChain = true;
} catch (error) {
  logger.debug('RAGService: LangChain imports not available, will use text similarity fallback');
  useLangChain = false;
}

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

export class RAGService {
  private documentRepo: DocumentRepository;
  private useLangChainRAG: boolean;

  constructor() {
    this.documentRepo = new DocumentRepository();

    // Check if LangChain should be used (requires OpenAI API key)
    this.useLangChainRAG = process.env.OPENAI_API_KEY !== undefined && useLangChain;

    if (this.useLangChainRAG) {
      try {
        // Initialize OpenAI embeddings if API key is available
        // Note: LangChain integration is partially implemented
        // Full implementation requires vector store setup and document chunking
        // Currently falls back to text similarity for actual retrieval
        new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY,
        });
        logger.info('RAGService: LangChain embeddings initialized (using text similarity for retrieval)');
      } catch (error: any) {
        logger.warn('RAGService: Failed to initialize LangChain embeddings, falling back to text similarity', {
          error: error.message,
        });
        this.useLangChainRAG = false;
      }
    } else {
      logger.info('RAGService: Using text similarity algorithm (LangChain not configured or OpenAI API key not set)');
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
      });

      // Get all PRD documents for the project (excluding deleted ones)
      const allPRDs = await this.documentRepo.findPRDsByProject(projectId, false);

      if (allPRDs.length === 0) {
        logger.info('RAGService: No PRDs found for project', { projectId });
        return [];
      }

      // Extract keywords from query for better matching
      const queryKeywords = extractKeywords(query, 10);
      const queryWithKeywords = query + ' ' + queryKeywords.join(' ');

      // Calculate similarity for each PRD
      const results: PRDSearchResult[] = [];

      for (const prd of allPRDs) {
        const similarity = calculateCosineSimilarity(prd.content, queryWithKeywords);

        // Extract relevant chunks from PRD content
        const relevantChunks = findSimilarChunks(prd.content, query, 3);

        results.push({
          documentId: prd.id,
          version: prd.version || 1,
          content: prd.content,
          similarity,
          relevantChunks,
        });
      }

      // Sort by similarity (descending) and return top results
      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .filter(result => result.similarity > 0.1); // Filter out very low similarity

      logger.info('RAGService: Search completed', {
        projectId,
        totalPRDs: allPRDs.length,
        resultsCount: sortedResults.length,
        topSimilarity: sortedResults[0]?.similarity || 0,
      });

      return sortedResults;
    } catch (error: any) {
      logger.error('RAGService: Failed to search similar PRDs', {
        projectId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get relevant chunks from PRD content based on query
   * Returns top K most relevant text chunks
   */
  getRelevantPRDChunks(
    prdContent: string,
    query: string,
    topK: number = 5
  ): Array<{ chunk: string; similarity: number }> {
    try {
      logger.debug('RAGService: Extracting relevant chunks', {
        contentLength: prdContent.length,
        queryLength: query.length,
        topK,
      });

      const chunks = findSimilarChunks(prdContent, query, topK);

      logger.debug('RAGService: Chunks extracted', {
        chunksCount: chunks.length,
        avgSimilarity: chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length || 0,
      });

      return chunks;
    } catch (error: any) {
      logger.error('RAGService: Failed to extract relevant chunks', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Search for similar PRDs across all projects in an application
   * Returns PRDs sorted by similarity score
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

      // Get all PRD documents for the application (excluding deleted ones)
      const allPRDs = await this.documentRepo.findPRDsByApplication(applicationId, false);

      if (allPRDs.length === 0) {
        logger.info('RAGService: No PRDs found for application', { applicationId });
        return [];
      }

      // Extract keywords from query for better matching
      const queryKeywords = extractKeywords(query, 10);
      const queryWithKeywords = query + ' ' + queryKeywords.join(' ');

      // Calculate similarity for each PRD
      const results: PRDSearchResult[] = [];

      for (const prd of allPRDs) {
        const similarity = calculateCosineSimilarity(prd.content, queryWithKeywords);

        // Extract relevant chunks from PRD content
        const relevantChunks = findSimilarChunks(prd.content, query, 3);

        results.push({
          documentId: prd.id,
          version: prd.version || 1,
          content: prd.content,
          similarity,
          relevantChunks,
        });
      }

      // Sort by similarity (descending) and return top results
      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .filter(result => result.similarity > 0.1); // Filter out very low similarity

      logger.info('RAGService: Application search completed', {
        applicationId,
        totalPRDs: allPRDs.length,
        resultsCount: sortedResults.length,
        topSimilarity: sortedResults[0]?.similarity || 0,
      });

      return sortedResults;
    } catch (error: any) {
      logger.error('RAGService: Failed to search similar PRDs by application', {
        applicationId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Combine multiple PRD search results into a single context
   * Useful for generating new PRD based on multiple historical PRDs
   */
  combinePRDResults(results: PRDSearchResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const combined: string[] = [];

    for (const result of results) {
      combined.push(`## PRD Version ${result.version} (Similarity: ${result.similarity.toFixed(3)})`);
      combined.push('');

      // Include relevant chunks if available
      if (result.relevantChunks.length > 0) {
        combined.push('### Relevant Sections:');
        for (const chunk of result.relevantChunks) {
          combined.push(chunk.chunk);
          combined.push('');
        }
      } else {
        // If no specific chunks, include first part of content
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
   * Search for similar MRDs in a project based on query
   * Returns MRDs sorted by similarity score
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

      // Get all MRD documents for the project (excluding deleted ones)
      const allMRDs = await this.documentRepo.findMRDsByProject(projectId, false);

      if (allMRDs.length === 0) {
        logger.info('RAGService: No MRDs found for project', { projectId });
        return [];
      }

      // Extract keywords from query for better matching
      const queryKeywords = extractKeywords(query, 10);
      const queryWithKeywords = query + ' ' + queryKeywords.join(' ');

      // Calculate similarity for each MRD
      const results: MRDSearchResult[] = [];

      for (const mrd of allMRDs) {
        const similarity = calculateCosineSimilarity(mrd.content, queryWithKeywords);

        // Extract relevant chunks from MRD content
        const relevantChunks = findSimilarChunks(mrd.content, query, 3);

        results.push({
          documentId: mrd.id,
          version: mrd.version || 1,
          content: mrd.content,
          similarity,
          relevantChunks,
        });
      }

      // Sort by similarity (descending) and return top results
      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .filter(result => result.similarity > 0.1); // Filter out very low similarity

      logger.info('RAGService: MRD search completed', {
        projectId,
        totalMRDs: allMRDs.length,
        resultsCount: sortedResults.length,
        topSimilarity: sortedResults[0]?.similarity || 0,
      });

      return sortedResults;
    } catch (error: any) {
      logger.error('RAGService: Failed to search similar MRDs', {
        projectId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Search for similar MRDs across all projects in an application
   * Returns MRDs sorted by similarity score
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

      // Get all MRD documents for the application (excluding deleted ones)
      const allMRDs = await this.documentRepo.findMRDsByApplication(applicationId, false);

      if (allMRDs.length === 0) {
        logger.info('RAGService: No MRDs found for application', { applicationId });
        return [];
      }

      // Extract keywords from query for better matching
      const queryKeywords = extractKeywords(query, 10);
      const queryWithKeywords = query + ' ' + queryKeywords.join(' ');

      // Calculate similarity for each MRD
      const results: MRDSearchResult[] = [];

      for (const mrd of allMRDs) {
        const similarity = calculateCosineSimilarity(mrd.content, queryWithKeywords);

        // Extract relevant chunks from MRD content
        const relevantChunks = findSimilarChunks(mrd.content, query, 3);

        results.push({
          documentId: mrd.id,
          version: mrd.version || 1,
          content: mrd.content,
          similarity,
          relevantChunks,
        });
      }

      // Sort by similarity (descending) and return top results
      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .filter(result => result.similarity > 0.1); // Filter out very low similarity

      logger.info('RAGService: Application MRD search completed', {
        applicationId,
        totalMRDs: allMRDs.length,
        resultsCount: sortedResults.length,
        topSimilarity: sortedResults[0]?.similarity || 0,
      });

      return sortedResults;
    } catch (error: any) {
      logger.error('RAGService: Failed to search similar MRDs by application', {
        applicationId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get relevant chunks from MRD content based on query
   * Returns top K most relevant text chunks
   */
  getRelevantMRDChunks(
    mrdContent: string,
    query: string,
    topK: number = 5
  ): Array<{ chunk: string; similarity: number }> {
    try {
      logger.debug('RAGService: Extracting relevant MRD chunks', {
        contentLength: mrdContent.length,
        queryLength: query.length,
        topK,
      });

      const chunks = findSimilarChunks(mrdContent, query, topK);

      logger.debug('RAGService: MRD chunks extracted', {
        chunksCount: chunks.length,
        avgSimilarity: chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length || 0,
      });

      return chunks;
    } catch (error: any) {
      logger.error('RAGService: Failed to extract relevant MRD chunks', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Combine multiple MRD search results into a single context
   * Useful for generating new MRD based on multiple historical MRDs
   */
  combineMRDResults(results: MRDSearchResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const combined: string[] = [];

    for (const result of results) {
      combined.push(`## MRD Version ${result.version} (Similarity: ${result.similarity.toFixed(3)})`);
      combined.push('');

      // Include relevant chunks if available
      if (result.relevantChunks.length > 0) {
        combined.push('### Relevant Sections:');
        for (const chunk of result.relevantChunks) {
          combined.push(chunk.chunk);
          combined.push('');
        }
      } else {
        // If no specific chunks, include first part of content
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

