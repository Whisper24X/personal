/**
 * RAG Service
 * Provides Retrieval-Augmented Generation capabilities for PRD documents
 * Uses simple text similarity algorithms for document retrieval
 */

import { DocumentRepository } from '../database/repositories/DocumentRepository';
import { ProjectRepository } from '../database/repositories/ProjectRepository';
import { calculateCosineSimilarity, findSimilarChunks, extractKeywords } from '../utils/textSimilarity';
import { logger } from '../utils';

export interface PRDSearchResult {
  documentId: string;
  version: number;
  content: string;
  similarity: number;
  relevantChunks: Array<{ chunk: string; similarity: number }>;
}

export class RAGService {
  private documentRepo: DocumentRepository;
  private projectRepo: ProjectRepository;

  constructor() {
    this.documentRepo = new DocumentRepository();
    this.projectRepo = new ProjectRepository();
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
}

export default RAGService;

