/**
 * Rerank Service
 * Reranks search results to improve relevance
 * Uses cross-encoder approach: calculates similarity between query and each document
 */

import { EmbeddingService } from './EmbeddingService';
import { logger } from '../utils';

export interface RerankResult {
  id: string | number;
  score: number;
  payload?: Record<string, any>;
  originalScore?: number;
}

export class RerankService {
  private embeddingService: EmbeddingService;

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Rerank search results based on query-document similarity
   * Uses embedding similarity to rerank results
   */
  async rerank(
    query: string,
    results: Array<{ id: string | number; score: number; payload?: Record<string, any> }>,
    topN: number = 5
  ): Promise<RerankResult[]> {
    try {
      if (results.length === 0) {
        return [];
      }

      logger.debug('RerankService: Starting rerank', {
        queryLength: query.length,
        resultsCount: results.length,
        topN,
      });

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Calculate similarity for each result
      const rerankedResults: RerankResult[] = [];

      for (const result of results) {
        // Get document text from payload
        const documentText = this.extractTextFromPayload(result.payload);
        
        if (!documentText) {
          // If no text found, keep original score
          rerankedResults.push({
            id: result.id,
            score: result.score,
            payload: result.payload,
            originalScore: result.score,
          });
          continue;
        }

        // Generate document embedding
        const docEmbedding = await this.embeddingService.generateEmbedding(documentText);

        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);

        // Combine original score with similarity (weighted average)
        // You can adjust weights based on your needs
        const rerankScore = 0.7 * similarity + 0.3 * result.score;

        rerankedResults.push({
          id: result.id,
          score: rerankScore,
          payload: result.payload,
          originalScore: result.score,
        });
      }

      // Sort by rerank score (descending) and return top N
      const sortedResults = rerankedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);

      logger.info('RerankService: Rerank completed', {
        originalCount: results.length,
        rerankedCount: sortedResults.length,
        topScore: sortedResults[0]?.score || 0,
      });

      return sortedResults;
    } catch (error: any) {
      logger.error('RerankService: Failed to rerank', {
        error: error.message,
      });
      // Return original results if rerank fails
      return results.map(r => ({
        id: r.id,
        score: r.score,
        payload: r.payload,
        originalScore: r.score,
      })).slice(0, topN);
    }
  }

  /**
   * Extract text content from payload
   */
  private extractTextFromPayload(payload?: Record<string, any>): string | null {
    if (!payload) {
      return null;
    }

    // Try different possible text fields
    if (payload.text) {
      return payload.text;
    }
    if (payload.content) {
      return payload.content;
    }
    if (payload.chunk) {
      return payload.chunk;
    }
    if (typeof payload === 'string') {
      return payload;
    }

    return null;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magnitudeA += vecA[i] * vecA[i];
      magnitudeB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }
}

export default RerankService;

