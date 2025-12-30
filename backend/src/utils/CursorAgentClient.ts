/**
 * Cursor Cloud Agent API Client
 * Wrapper for Cursor Cloud Agent API endpoints
 * Documentation: https://cursor.com/cn/docs/cloud-agent/api/endpoints
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from './logger';

const CURSOR_API_BASE_URL = 'https://api.cursor.com/v0';

export interface CursorAgent {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'FINISHED' | 'FAILED' | 'STOPPED';
  source: {
    repository: string;
    ref: string;
  };
  target: {
    branchName: string;
    url: string;
    prUrl?: string;
    autoCreatePr: boolean;
    openAsCursorGithubApp: boolean;
    skipReviewerRequest: boolean;
  };
  summary?: string;
  createdAt: string;
}

export interface CursorAgentListResponse {
  agents: CursorAgent[];
  nextCursor?: string;
}

export interface CursorAgentConversationMessage {
  id: string;
  type: 'user_message' | 'assistant_message';
  text: string;
}

export interface CursorAgentConversationResponse {
  id: string;
  messages: CursorAgentConversationMessage[];
}

export interface CreateAgentRequest {
  prompt: {
    text: string;
    images?: Array<{
      data: string; // base64 encoded image
      dimension: {
        width: number;
        height: number;
      };
    }>;
  };
  source: {
    repository: string;
    ref?: string;
  };
  target?: {
    branchName?: string;
    autoCreatePr?: boolean;
    openAsCursorGithubApp?: boolean;
    skipReviewerRequest?: boolean;
  };
  model?: string;
}

export interface CreateAgentResponse {
  id: string;
}

export interface FollowupRequest {
  prompt: {
    text: string;
    images?: Array<{
      data: string;
      dimension: {
        width: number;
        height: number;
      };
    }>;
  };
}

export interface FollowupResponse {
  id: string;
}

export interface ApiKeyInfo {
  apiKeyName: string;
  createdAt: string;
  userEmail: string;
}

export interface ModelsResponse {
  models: string[];
}

export interface Repository {
  owner: string;
  name: string;
  repository: string;
}

export interface RepositoriesResponse {
  repositories: Repository[];
}

export class CursorAgentClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey?: string) {
    // Get API key from parameter, environment variable, or use default
    this.apiKey = apiKey || process.env.CURSOR_API_KEY || 'key_a92ddf19fb19678761a887bc0dc43eed735db8c3b4a19ad120f8d43538893056';

    this.client = axios.create({
      baseURL: CURSOR_API_BASE_URL,
      timeout: 300000, // 5分钟超时，适合长时间运行的agent任务
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        username: this.apiKey,
        password: '', // Basic Auth with API key as username
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response.data,
      (error: AxiosError) => {
        // Extract error information without circular references
        const errorData = error.response?.data;
        const errorMessage = (errorData as any)?.message || (errorData as any)?.error || error.message;

        // Log error with safe serializable data only
        logger.error('Cursor API request failed', {
          message: errorMessage,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: errorData,
          url: error.config?.url,
          method: error.config?.method,
          errorStack: error.stack,
        });

        // Create a clean error object without circular references
        const enhancedError: any = new Error(errorMessage);
        enhancedError.statusCode = error.response?.status;
        enhancedError.statusText = error.response?.statusText;
        enhancedError.responseData = errorData;
        enhancedError.url = error.config?.url;
        enhancedError.method = error.config?.method;

        return Promise.reject(enhancedError);
      }
    );
  }

  /**
   * 创建一个新的Cloud Agent
   * POST /agents
   */
  async createAgent(request: CreateAgentRequest): Promise<CreateAgentResponse> {
    logger.info('Creating Cursor Cloud Agent', {
      promptLength: request.prompt.text.length,
      repository: request.source.repository,
      ref: request.source.ref,
      branchName: request.target?.branchName,
      autoCreatePr: request.target?.autoCreatePr,
      model: request.model,
    });

    // Validate required fields
    if (!request.prompt?.text) {
      throw new Error('prompt.text is required');
    }
    if (!request.source?.repository) {
      throw new Error('source.repository is required');
    }

    try {
      const response = await this.client.post<any, CreateAgentResponse>('/agents', request);
      logger.info('Cloud Agent created successfully', { agentId: response.id });
      return response;
    } catch (error: any) {
      // Extract safe error information
      const errorMessage = error?.message || String(error);
      const statusCode = error?.statusCode;
      const responseData = error?.responseData;

      logger.error('Failed to create Cloud Agent', {
        message: errorMessage,
        statusCode,
        responseData,
        request: {
          repository: request.source.repository,
          ref: request.source.ref,
          branchName: request.target?.branchName,
          autoCreatePr: request.target?.autoCreatePr,
          model: request.model,
          promptLength: request.prompt.text.length,
        },
      });

      // Include more details in error message if available
      let detailedMessage = errorMessage;
      if (responseData && typeof responseData === 'object') {
        const details = (responseData as any).error || (responseData as any).message;
        if (details) {
          // Avoid duplicate messages
          if (!errorMessage.includes(details)) {
            detailedMessage = `${errorMessage}: ${details}`;
          } else {
            detailedMessage = errorMessage;
          }
        }
      }

      // Check for specific error types and provide helpful messages
      if (detailedMessage.includes('Usage-based pricing') || detailedMessage.includes('hard limit')) {
        throw new Error(`创建Cloud Agent失败: 需要启用基于使用量的定价并设置至少 $2 的消费限额。请在 https://www.cursor.com/dashboard?tab=settings 中配置。\n\n原始错误: ${detailedMessage}`);
      }

      throw new Error(`创建Cloud Agent失败: ${detailedMessage}`);
    }
  }

  /**
   * 获取Agent状态
   * GET /agents/{id}
   */
  async getAgent(id: string): Promise<CursorAgent> {
    logger.debug('Getting agent status', { agentId: id });
    try {
      const response = await this.client.get<any, CursorAgent>(`/agents/${id}`);
      return response;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      logger.error('Failed to get agent status', {
        message: errorMessage,
        statusCode: error?.statusCode,
        agentId: id,
      });
      throw new Error(`获取Agent状态失败: ${errorMessage}`);
    }
  }

  /**
   * 获取Agent会话历史
   * GET /agents/{id}/conversation
   */
  async getAgentConversation(id: string): Promise<CursorAgentConversationResponse> {
    logger.debug('Getting agent conversation', { agentId: id });
    try {
      const response = await this.client.get<any, CursorAgentConversationResponse>(`/agents/${id}/conversation`);
      return response;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      logger.error('Failed to get agent conversation', {
        message: errorMessage,
        statusCode: error?.statusCode,
        agentId: id,
      });
      throw new Error(`获取Agent会话失败: ${errorMessage}`);
    }
  }

  /**
   * 发送后续消息
   * POST /agents/{id}/followup
   */
  async sendFollowup(id: string, request: FollowupRequest): Promise<FollowupResponse> {
    logger.info('Sending followup message', { agentId: id, promptLength: request.prompt.text.length });
    try {
      const response = await this.client.post<any, FollowupResponse>(`/agents/${id}/followup`, request);
      logger.info('Followup message sent successfully', { agentId: id });
      return response;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      logger.error('Failed to send followup message', {
        message: errorMessage,
        statusCode: error?.statusCode,
        agentId: id,
      });
      throw new Error(`发送后续消息失败: ${errorMessage}`);
    }
  }

  /**
   * 停止Agent
   * POST /agents/{id}/stop
   */
  async stopAgent(id: string): Promise<{ id: string }> {
    logger.info('Stopping agent', { agentId: id });
    try {
      const response = await this.client.post<any, { id: string }>(`/agents/${id}/stop`);
      logger.info('Agent stopped successfully', { agentId: id });
      return response;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      logger.error('Failed to stop agent', {
        message: errorMessage,
        statusCode: error?.statusCode,
        agentId: id,
      });
      throw new Error(`停止Agent失败: ${errorMessage}`);
    }
  }

  /**
   * 删除Agent
   * DELETE /agents/{id}
   */
  async deleteAgent(id: string): Promise<{ id: string }> {
    logger.info('Deleting agent', { agentId: id });
    try {
      const response = await this.client.delete<any, { id: string }>(`/agents/${id}`);
      logger.info('Agent deleted successfully', { agentId: id });
      return response;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      logger.error('Failed to delete agent', {
        message: errorMessage,
        statusCode: error?.statusCode,
        agentId: id,
      });
      throw new Error(`删除Agent失败: ${errorMessage}`);
    }
  }

  /**
   * 列出所有Agents
   * GET /agents
   */
  async listAgents(limit: number = 20, cursor?: string): Promise<CursorAgentListResponse> {
    logger.debug('Listing agents', { limit, cursor });
    try {
      const params: any = { limit };
      if (cursor) {
        params.cursor = cursor;
      }
      const response = await this.client.get<any, CursorAgentListResponse>('/agents', { params });
      return response;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      logger.error('Failed to list agents', {
        message: errorMessage,
        statusCode: error?.statusCode,
      });
      throw new Error(`列出Agents失败: ${errorMessage}`);
    }
  }

  /**
   * 获取可用模型列表
   * GET /models
   */
  async listModels(): Promise<ModelsResponse> {
    logger.debug('Listing available models');
    try {
      const response = await this.client.get<any, ModelsResponse>('/models');
      return response;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      logger.error('Failed to list models', {
        message: errorMessage,
        statusCode: error?.statusCode,
      });
      throw new Error(`获取模型列表失败: ${errorMessage}`);
    }
  }

  /**
   * 获取API Key信息
   * GET /me
   */
  async getApiKeyInfo(): Promise<ApiKeyInfo> {
    logger.debug('Getting API key info');
    try {
      const response = await this.client.get<any, ApiKeyInfo>('/me');
      return response;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      logger.error('Failed to get API key info', {
        message: errorMessage,
        statusCode: error?.statusCode,
      });
      throw new Error(`获取API Key信息失败: ${errorMessage}`);
    }
  }

  /**
   * List GitHub repositories
   * GET /v0/repositories
   * Note: This endpoint has strict rate limits: 1 request per user per minute, 30 requests per user per hour
   */
  async listRepositories(): Promise<RepositoriesResponse> {
    return this.client.get('/v0/repositories');
  }
}

// Export a default instance
// 从环境变量或配置文件读取API Key
const CURSOR_API_KEY = process.env.CURSOR_API_KEY || 'key_a92ddf19fb19678761a887bc0dc43eed735db8c3b4a19ad120f8d43538893056';
export const cursorAgentClient = new CursorAgentClient(CURSOR_API_KEY);

