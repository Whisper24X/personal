/**
 * Cursor Cloud Agent API Client
 * Wrapper for Cursor Cloud Agent API endpoints
 * Documentation: https://cursor.com/cn/docs/cloud-agent/api/endpoints
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from './logger';

const CURSOR_API_BASE_URL = 'https://api.cursor.com';

export interface CursorAgent {
  id: string;
  name: string;
  status: 'RUNNING' | 'FINISHED' | 'STOPPED' | 'FAILED';
  source: {
    repository: string;
    ref: string;
  };
  target: {
    branchName: string;
    url: string;
    prUrl?: string;
    autoCreatePr?: boolean;
    openAsCursorGithubApp?: boolean;
    skipReviewerRequest?: boolean;
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
  name: string;
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

  constructor(apiKey: string = 'key_a92ddf19fb19678761a887bc0dc43eed735db8c3b4a19ad120f8d43538893056') {
    this.apiKey = apiKey;
    
    this.client = axios.create({
      baseURL: CURSOR_API_BASE_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        username: this.apiKey,
        password: '', // Basic auth with empty password
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('CursorAgentClient: Request', {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error('CursorAgentClient: Request error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response.data,
      (error: AxiosError) => {
        logger.error('CursorAgentClient: Response error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * List all agents
   * GET /v0/agents
   */
  async listAgents(limit?: number, cursor?: string): Promise<CursorAgentListResponse> {
    const params: Record<string, string | number> = {};
    if (limit !== undefined) {
      params.limit = limit;
    }
    if (cursor) {
      params.cursor = cursor;
    }

    return this.client.get('/v0/agents', { params });
  }

  /**
   * Get agent status
   * GET /v0/agents/{id}
   */
  async getAgent(id: string): Promise<CursorAgent> {
    return this.client.get(`/v0/agents/${id}`);
  }

  /**
   * Get agent conversation
   * GET /v0/agents/{id}/conversation
   */
  async getAgentConversation(id: string): Promise<CursorAgentConversationResponse> {
    return this.client.get(`/v0/agents/${id}/conversation`);
  }

  /**
   * Create a new agent
   * POST /v0/agents
   */
  async createAgent(request: CreateAgentRequest): Promise<CreateAgentResponse> {
    return this.client.post('/v0/agents', request);
  }

  /**
   * Send followup prompt to agent
   * POST /v0/agents/{id}/followup
   */
  async sendFollowup(id: string, request: FollowupRequest): Promise<FollowupResponse> {
    return this.client.post(`/v0/agents/${id}/followup`, request);
  }

  /**
   * Stop a running agent
   * POST /v0/agents/{id}/stop
   */
  async stopAgent(id: string): Promise<{ id: string }> {
    return this.client.post(`/v0/agents/${id}/stop`);
  }

  /**
   * Delete an agent
   * DELETE /v0/agents/{id}
   */
  async deleteAgent(id: string): Promise<{ id: string }> {
    return this.client.delete(`/v0/agents/${id}`);
  }

  /**
   * Get API key information
   * GET /v0/me
   */
  async getApiKeyInfo(): Promise<ApiKeyInfo> {
    return this.client.get('/v0/me');
  }

  /**
   * List available models
   * GET /v0/models
   */
  async listModels(): Promise<ModelsResponse> {
    return this.client.get('/v0/models');
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
export const cursorAgentClient = new CursorAgentClient();

