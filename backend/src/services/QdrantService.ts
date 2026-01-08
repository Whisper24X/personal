/**
 * Qdrant Service
 * Manages Qdrant vector database connection and collections
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../utils';

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, any>;
}

export interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, any>;
}

export class QdrantService {
  private client: QdrantClient;
  private url: string;
  private apiKey?: string;
  private collectionName: string;
  private vectorSize: number;

  constructor(collectionName: string = 'knowledge-base', vectorSize: number = 1536) {
    this.url = process.env.QDRANT_URL || 'http://localhost:6333';
    this.apiKey = process.env.QDRANT_API_KEY;
    this.collectionName = collectionName;
    this.vectorSize = vectorSize;

    // Initialize Qdrant client
    const config: any = {
      url: this.url,
    };

    if (this.apiKey) {
      config.apiKey = this.apiKey;
    }

    this.client = new QdrantClient(config);

    logger.info('QdrantService: Initialized', {
      url: this.url,
      collectionName: this.collectionName,
      vectorSize: this.vectorSize,
      hasApiKey: !!this.apiKey,
    });
  }

  /**
   * Create collection if it doesn't exist
   */
  async ensureCollection(): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (col: any) => col.name === this.collectionName
      );

      if (!collectionExists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
        });

        logger.info('QdrantService: Collection created', {
          collectionName: this.collectionName,
          vectorSize: this.vectorSize,
        });
      } else {
        logger.debug('QdrantService: Collection already exists', {
          collectionName: this.collectionName,
        });
      }
    } catch (error: any) {
      logger.error('QdrantService: Failed to ensure collection', {
        error: error.message,
        collectionName: this.collectionName,
      });
      throw error;
    }
  }

  /**
   * Upsert points (vectors) into the collection
   */
  async upsertPoints(points: QdrantPoint[]): Promise<void> {
    try {
      await this.ensureCollection();

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: points.map(point => ({
          id: point.id,
          vector: point.vector,
          payload: point.payload || {},
        })),
      });

      logger.info('QdrantService: Points upserted', {
        collectionName: this.collectionName,
        count: points.length,
      });
    } catch (error: any) {
      logger.error('QdrantService: Failed to upsert points', {
        error: error.message,
        count: points.length,
      });
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  async search(
    queryVector: number[],
    limit: number = 10,
    filter?: Record<string, any>
  ): Promise<QdrantSearchResult[]> {
    try {
      await this.ensureCollection();

      const searchParams: any = {
        vector: queryVector,
        limit,
        with_payload: true,
      };

      if (filter) {
        searchParams.filter = filter;
      }

      const results = await this.client.search(this.collectionName, searchParams);

      return results.map((result: any) => ({
        id: result.id,
        score: result.score,
        payload: result.payload,
      }));
    } catch (error: any) {
      logger.error('QdrantService: Failed to search', {
        error: error.message,
        limit,
      });
      throw error;
    }
  }

  /**
   * Delete points by IDs
   */
  async deletePoints(ids: (string | number)[]): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: ids,
      });

      logger.info('QdrantService: Points deleted', {
        collectionName: this.collectionName,
        count: ids.length,
      });
    } catch (error: any) {
      logger.error('QdrantService: Failed to delete points', {
        error: error.message,
        count: ids.length,
      });
      throw error;
    }
  }

  /**
   * Delete points by filter
   */
  async deletePointsByFilter(filter: Record<string, any>): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter,
      });

      logger.info('QdrantService: Points deleted by filter', {
        collectionName: this.collectionName,
        filter,
      });
    } catch (error: any) {
      logger.error('QdrantService: Failed to delete points by filter', {
        error: error.message,
        filter,
      });
      throw error;
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<any> {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return info;
    } catch (error: any) {
      logger.error('QdrantService: Failed to get collection info', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clear all points in collection
   */
  async clearCollection(): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [],
        },
      });

      logger.info('QdrantService: Collection cleared', {
        collectionName: this.collectionName,
      });
    } catch (error: any) {
      logger.error('QdrantService: Failed to clear collection', {
        error: error.message,
      });
      throw error;
    }
  }
}

export default QdrantService;

