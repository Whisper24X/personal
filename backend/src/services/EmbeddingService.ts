/**
 * Embedding Service
 * Generates text embeddings using the active LLM provider
 * Supports multiple providers: OpenAI, ZhipuAI, ARK, etc.
 */

import { getLLMConfig } from '../utils/config';
import { createLLM } from '../providers/llm';
import { logger } from '../utils';
import OpenAI from 'openai';
import axios, { AxiosInstance } from 'axios';

export class EmbeddingService {
  private llmConfig: any;
  private openaiClient?: OpenAI;
  private zhipuClient?: AxiosInstance;
  private arkClient?: AxiosInstance;
  private embeddingModel: string;
  private vectorSize: number;

  constructor() {
    // Default embedding model and vector size
    // Will be initialized when first used
    this.embeddingModel = 'text-embedding-ada-002';
    this.vectorSize = 1536; // OpenAI ada-002 default
  }

  /**
   * Initialize the embedding service with active LLM config
   */
  async initialize(userId?: string): Promise<void> {
    try {
      this.llmConfig = await getLLMConfig(userId);
      
      // Determine embedding model and vector size based on provider
      switch (this.llmConfig.provider) {
        case 'openai':
          this.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002';
          this.vectorSize = this.embeddingModel.includes('3-large') ? 3072 : 
                           this.embeddingModel.includes('3-small') ? 1536 : 1536;
          this.openaiClient = new OpenAI({
            apiKey: this.llmConfig.apiKey,
            baseURL: this.llmConfig.baseURL,
          });
          break;
        
        case 'zhipuai':
          // ZhipuAI uses text-embedding-2 model
          this.embeddingModel = 'text-embedding-2';
          this.vectorSize = 1024; // ZhipuAI text-embedding-2 default
          this.zhipuClient = axios.create({
            baseURL: this.llmConfig.baseURL || 'https://open.bigmodel.cn/api/paas/v4',
            timeout: 60000,
            headers: {
              'Authorization': `Bearer ${this.llmConfig.apiKey}`,
              'Content-Type': 'application/json',
            },
          });
          break;
        
        case 'ark':
          // ARK uses text-embedding model
          this.embeddingModel = 'text-embedding';
          this.vectorSize = 1024; // ARK default
          this.arkClient = axios.create({
            baseURL: this.llmConfig.baseURL || 'https://ark.cn-beijing.volces.com/api/v3',
            timeout: 60000,
            headers: {
              'Authorization': `Bearer ${this.llmConfig.apiKey}`,
              'Content-Type': 'application/json',
            },
          });
          break;
        
        default:
          // Fallback to OpenAI-compatible API
          logger.warn(`EmbeddingService: Provider ${this.llmConfig.provider} not explicitly supported, using OpenAI-compatible API`);
          this.embeddingModel = 'text-embedding-ada-002';
          this.vectorSize = 1536;
          if (this.llmConfig.apiKey) {
            this.openaiClient = new OpenAI({
              apiKey: this.llmConfig.apiKey,
              baseURL: this.llmConfig.baseURL,
            });
          }
      }

      logger.info('EmbeddingService: Initialized', {
        provider: this.llmConfig.provider,
        embeddingModel: this.embeddingModel,
        vectorSize: this.vectorSize,
      });
    } catch (error: any) {
      logger.error('EmbeddingService: Failed to initialize', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate embedding vector for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.llmConfig) {
      await this.initialize();
    }

    try {
      let embedding: number[];

      switch (this.llmConfig.provider) {
        case 'openai':
          embedding = await this.generateOpenAIEmbedding(text);
          break;
        
        case 'zhipuai':
          embedding = await this.generateZhipuEmbedding(text);
          break;
        
        case 'ark':
          embedding = await this.generateArkEmbedding(text);
          break;
        
        default:
          // Try OpenAI-compatible API
          if (this.openaiClient) {
            embedding = await this.generateOpenAIEmbedding(text);
          } else {
            throw new Error(`Embedding not supported for provider: ${this.llmConfig.provider}`);
          }
      }

      logger.debug('EmbeddingService: Generated embedding', {
        textLength: text.length,
        vectorSize: embedding.length,
      });

      return embedding;
    } catch (error: any) {
      logger.error('EmbeddingService: Failed to generate embedding', {
        error: error.message,
        provider: this.llmConfig?.provider,
      });
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.llmConfig) {
      await this.initialize();
    }

    try {
      const embeddings: number[][] = [];

      // Process in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchEmbeddings = await Promise.all(
          batch.map(text => this.generateEmbedding(text))
        );
        embeddings.push(...batchEmbeddings);
      }

      return embeddings;
    } catch (error: any) {
      logger.error('EmbeddingService: Failed to generate embeddings', {
        error: error.message,
        count: texts.length,
      });
      throw error;
    }
  }

  /**
   * Generate embedding using OpenAI API
   */
  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openaiClient.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Generate embedding using ZhipuAI API
   */
  private async generateZhipuEmbedding(text: string): Promise<number[]> {
    if (!this.zhipuClient) {
      throw new Error('ZhipuAI client not initialized');
    }

    const response = await this.zhipuClient.post('/embeddings', {
      model: this.embeddingModel,
      input: text,
    });

    if (response.data.error) {
      throw new Error(response.data.error.message || 'ZhipuAI embedding API error');
    }

    return response.data.data[0].embedding;
  }

  /**
   * Generate embedding using ARK API
   */
  private async generateArkEmbedding(text: string): Promise<number[]> {
    if (!this.arkClient) {
      throw new Error('ARK client not initialized');
    }

    const response = await this.arkClient.post('/embeddings', {
      model: this.embeddingModel,
      input: text,
    });

    if (response.data.error) {
      throw new Error(response.data.error.message || 'ARK embedding API error');
    }

    return response.data.data[0].embedding;
  }

  /**
   * Get vector size for current embedding model
   */
  getVectorSize(): number {
    return this.vectorSize;
  }

  /**
   * Get embedding model name
   */
  getEmbeddingModel(): string {
    return this.embeddingModel;
  }
}

export default EmbeddingService;

