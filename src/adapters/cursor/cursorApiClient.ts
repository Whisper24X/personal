/**
 * Cursor Cloud Agent API Client
 * 用于调用Cursor API生成HTML原型
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('CursorApiClient');

export interface CursorAgentCreateRequest {
  prompt: {
    text: string;
    images?: Array<{
      data: string; // base64
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

export interface CursorAgentMessage {
  id: string;
  type: 'user_message' | 'assistant_message';
  text: string;
}

export interface CursorAgentConversation {
  id: string;
  messages: CursorAgentMessage[];
}

export interface CursorFollowupRequest {
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

export class CursorApiClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://api.cursor.com/v0',
      timeout: 300000, // 5分钟超时
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        username: apiKey,
        password: '', // Basic Auth with API key as username
      },
    });

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        logger.error('Cursor API request failed', error, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  /**
   * 创建一个新的Cloud Agent
   */
  async createAgent(request: CursorAgentCreateRequest): Promise<CursorAgent> {
    logger.info('Creating Cursor Cloud Agent', {
      promptLength: request.prompt.text.length,
      repository: request.source.repository,
    });

    try {
      const response = await this.client.post<any, CursorAgent>('/agents', request);
      logger.info('Cloud Agent created successfully', { agentId: response.id });
      return response;
    } catch (error) {
      logger.error('Failed to create Cloud Agent', error);
      throw new Error(`创建Cloud Agent失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取Agent状态
   */
  async getAgentStatus(agentId: string): Promise<CursorAgent> {
    logger.debug('Getting agent status', { agentId });

    try {
      const response = await this.client.get<any, CursorAgent>(`/agents/${agentId}`);
      return response;
    } catch (error) {
      logger.error('Failed to get agent status', error, { agentId });
      throw new Error(`获取Agent状态失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取Agent会话历史
   */
  async getAgentConversation(agentId: string): Promise<CursorAgentConversation> {
    logger.debug('Getting agent conversation', { agentId });

    try {
      const response = await this.client.get<any, CursorAgentConversation>(`/agents/${agentId}/conversation`);
      return response;
    } catch (error) {
      logger.error('Failed to get agent conversation', error, { agentId });
      throw new Error(`获取Agent会话失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 发送后续消息
   */
  async sendFollowup(agentId: string, request: CursorFollowupRequest): Promise<{ id: string }> {
    logger.info('Sending followup message', { agentId, promptLength: request.prompt.text.length });

    try {
      const response = await this.client.post<any, { id: string }>(`/agents/${agentId}/followup`, request);
      logger.info('Followup message sent successfully', { agentId });
      return response;
    } catch (error) {
      logger.error('Failed to send followup message', error, { agentId });
      throw new Error(`发送后续消息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 停止Agent
   */
  async stopAgent(agentId: string): Promise<{ id: string }> {
    logger.info('Stopping agent', { agentId });

    try {
      const response = await this.client.post<any, { id: string }>(`/agents/${agentId}/stop`);
      logger.info('Agent stopped successfully', { agentId });
      return response;
    } catch (error) {
      logger.error('Failed to stop agent', error, { agentId });
      throw new Error(`停止Agent失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 删除Agent
   */
  async deleteAgent(agentId: string): Promise<{ id: string }> {
    logger.info('Deleting agent', { agentId });

    try {
      const response = await this.client.delete<any, { id: string }>(`/agents/${agentId}`);
      logger.info('Agent deleted successfully', { agentId });
      return response;
    } catch (error) {
      logger.error('Failed to delete agent', error, { agentId });
      throw new Error(`删除Agent失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 列出所有Agents
   */
  async listAgents(limit: number = 20, cursor?: string): Promise<{ agents: CursorAgent[]; nextCursor?: string }> {
    logger.debug('Listing agents', { limit, cursor });

    try {
      const params: any = { limit };
      if (cursor) {
        params.cursor = cursor;
      }
      const response = await this.client.get<any, { agents: CursorAgent[]; nextCursor?: string }>('/agents', { params });
      return response;
    } catch (error) {
      logger.error('Failed to list agents', error);
      throw new Error(`列出Agents失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<{ models: string[] }> {
    logger.debug('Listing available models');

    try {
      const response = await this.client.get<any, { models: string[] }>('/models');
      return response;
    } catch (error) {
      logger.error('Failed to list models', error);
      throw new Error(`获取模型列表失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取API Key信息
   */
  async getApiKeyInfo(): Promise<{ apiKeyName: string; createdAt: string; userEmail: string }> {
    logger.debug('Getting API key info');

    try {
      const response = await this.client.get<any, { apiKeyName: string; createdAt: string; userEmail: string }>('/me');
      return response;
    } catch (error) {
      logger.error('Failed to get API key info', error);
      throw new Error(`获取API Key信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 创建默认实例
// 从环境变量或配置文件读取API Key
const CURSOR_API_KEY = process.env.CURSOR_API_KEY || 'key_5ec9b36ee4704179ee13de83f518d34d235d867bd1182f92c7b062f00fb8fce6';

export const cursorApiClient = new CursorApiClient(CURSOR_API_KEY);

