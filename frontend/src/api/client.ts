/**
 * API 客户端
 * 基于 Axios 的 HTTP 客户端，用于后端通信
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL;
if (!API_BASE_URL) {
  throw new Error('VITE_API_URL environment variable is not set. Please configure it in your .env file.');
}

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器（用于认证令牌等）
    this.client.interceptors.request.use(
      (config) => {
        // 如果可用，添加认证令牌
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器（用于错误处理）
    this.client.interceptors.response.use(
      (response) => response.data as any,
      (error) => {
        if (error.response) {
          // Preserve status code in error object
          const errorData = error.response.data;
          if (errorData && typeof errorData === 'object') {
            errorData.status = error.response.status;
          }
          return Promise.reject(errorData || error.response.data);
        }
        return Promise.reject(error);
      }
    );
  }

  // 应用 API 端点
  async createApplication(data: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    return this.client.post('/applications', data);
  }

  async getApplications() {
    return this.client.get('/applications');
  }

  async getApplication(id: string) {
    return this.client.get(`/applications/${id}`);
  }

  async updateApplication(id: string, data: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    return this.client.put(`/applications/${id}`, data);
  }

  async deleteApplication(id: string) {
    return this.client.delete(`/applications/${id}`);
  }

  async getApplicationProjects(id: string) {
    return this.client.get(`/applications/${id}/projects`);
  }

  // 项目 API 端点
  async createProject(data: {
    name: string;
    idea: string;
    description?: string;
    investment?: number;
    nRound?: number;
    applicationId?: string;
  }) {
    return this.client.post('/projects', data);
  }

  async startProject(id: string) {
    return this.client.post(`/projects/${id}/start`);
  }

  async getProject(id: string) {
    return this.client.get(`/projects/${id}`);
  }

  async getProjects(limit?: number) {
    return this.client.get('/projects', { params: { limit } });
  }

  async getProjectMessages(id: string, limit?: number) {
    return this.client.get(`/projects/${id}/messages`, { params: { limit } });
  }

  async getProjectDocuments(id: string) {
    return this.client.get(`/projects/${id}/documents`);
  }

  // PRD API 端点
  async generatePRD(projectId: string, data: {
    requirements: string;
    mode?: 'new' | 'update';
    useRAG?: boolean;
  }) {
    return this.client.post(`/projects/${projectId}/prd`, data);
  }

  async getPRDs(projectId: string, includeDeleted?: boolean) {
    const response = await this.client.get(`/projects/${projectId}/prds`, {
      params: { includeDeleted },
    }) as any;
    // Normalize response format
    return {
      prds: response.documents || response.prds || [],
      ...response,
    };
  }

  async getPRD(projectId: string, prdId: string) {
    return this.client.get(`/projects/${projectId}/prds/${prdId}`);
  }

  async deletePRD(projectId: string, prdId: string) {
    return this.client.delete(`/projects/${projectId}/prds/${prdId}`);
  }

  async restorePRD(projectId: string, prdId: string) {
    return this.client.post(`/projects/${projectId}/prds/${prdId}/restore`);
  }

  async getPRDSections(projectId: string, prdId: string) {
    return this.client.get(`/projects/${projectId}/prds/${prdId}/sections`);
  }

  async adjustPRDSection(
    projectId: string,
    prdId: string,
    sectionNumber: number,
    userRequest: string
  ) {
    return this.client.post(
      `/projects/${projectId}/prds/${prdId}/sections/${sectionNumber}/adjust`,
      { userRequest }
    );
  }

  // MRD API 端点
  async generateMRD(projectId: string, data: {
    requirements: string;
    mode?: 'new' | 'update';
    useRAG?: boolean;
  }) {
    return this.client.post(`/projects/${projectId}/mrd`, data);
  }

  async getMRDs(projectId: string) {
    const response = await this.client.get(`/projects/${projectId}/mrds`) as any;
    // Normalize response format
    return {
      documents: response.documents || [],
      ...response,
    };
  }

  async getMRD(projectId: string, mrdId: string) {
    return this.client.get(`/projects/${projectId}/mrds/${mrdId}`);
  }

  async adjustMRDSection(
    projectId: string,
    mrdId: string,
    sectionNumber: number,
    userRequest: string,
    applicationId?: string,
    version?: number
  ) {
    return this.client.post(
      `/projects/${projectId}/mrds/${mrdId}/adjust-section`,
      { sectionNumber, userRequest, applicationId, version }
    );
  }

  async getSectionConversation(
    projectId: string,
    sectionNumber: number,
    documentType: 'PRD' | 'MRD' = 'PRD',
    applicationId?: string,
    version?: number
  ) {
    return this.client.get(
      `/projects/${projectId}/sections/${sectionNumber}/conversation`,
      {
        params: { documentType, applicationId, version },
      }
    );
  }

  // LLM Config API 端点
  async getLLMConfigs() {
    return this.client.get('/config/llm');
  }

  async getActiveLLMConfig() {
    return this.client.get('/config/llm/active');
  }

  async getLLMConfigByProvider(provider: string) {
    return this.client.get(`/config/llm/${provider}`);
  }

  async createLLMConfig(data: {
    provider: string;
    apiKey?: string;
    baseURL?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    isActive?: boolean;
  }) {
    return this.client.post('/config/llm', data);
  }


  async activateLLMConfig(id: string) {
    return this.client.post(`/config/llm/${id}/activate`);
  }

  async deleteLLMConfig(id: string) {
    return this.client.delete(`/config/llm/${id}`);
  }

  // Provider Config API 端点 (API keys and base URLs)
  async getProviderConfigs() {
    return this.client.get('/config/llm/providers');
  }

  async getProviderConfig(provider: string) {
    return this.client.get(`/config/llm/providers/${provider}`);
  }

  async saveProviderConfig(data: {
    provider: string;
    apiKey?: string;
    baseURL?: string;
    model?: string;
  }) {
    return this.client.post('/config/llm/providers', data);
  }

  // Role LLM Config API 端点
  async getRoleLLMConfigs() {
    return this.client.get('/config/role-llm');
  }

  async getRoleLLMConfig(profile: string) {
    return this.client.get(`/config/role-llm/${profile}`);
  }

  async saveRoleLLMConfig(profile: string, data: {
    provider: string;
    apiKey?: string;
    baseURL?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    repository?: string;
    branchName?: string;
    autoCreatePr?: boolean;
  }) {
    return this.client.post(`/config/role-llm/${profile}`, data);
  }

  async deleteRoleLLMConfig(profile: string) {
    return this.client.delete(`/config/role-llm/${profile}`);
  }

  // Prompt Config API 端点
  async getPromptConfigs() {
    return this.client.get('/config/prompts');
  }

  async getPromptConfigsGrouped() {
    return this.client.get('/config/prompts/grouped');
  }

  async getPromptConfigsByType(type: string) {
    return this.client.get(`/config/prompts/${type}`);
  }

  async getPromptConfig(type: string, key: string) {
    return this.client.get(`/config/prompts/${type}/${key}`);
  }

  async savePromptConfig(data: {
    promptType: string;
    promptKey: string;
    content: string;
    description?: string;
    isActive?: boolean;
  }) {
    return this.client.post('/config/prompts', data);
  }

  async deletePromptConfig(type: string, key: string) {
    return this.client.delete(`/config/prompts/${type}/${key}`);
  }

  // Download zip archive
  async downloadZip(projectId: string, zipPath: string) {
    // Encode the zip path for URL
    const encodedPath = encodeURIComponent(zipPath);
    const url = `${API_BASE_URL}/projects/${projectId}/download/${encodedPath}`;

    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = zipPath.split('/').pop() || 'archive.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Interactive session API endpoints (polling mode)
  async pollInteractiveMessages(projectId: string, lastMessageId?: string | null) {
    const params: Record<string, string> = {};
    if (lastMessageId) {
      params.lastMessageId = lastMessageId;
    }
    return this.client.get(`/interactive/${projectId}/poll`, { params });
  }

  async sendInteractiveAction(projectId: string, action: string, modifiedContent?: string) {
    return this.client.post(`/interactive/${projectId}/action`, {
      action,
      modifiedContent,
    });
  }

  /**
   * Confirm role completion and allow proceeding to next role
   * This endpoint clears the confirmation status in database
   */
  async confirmRoleCompletion(projectId: string, action: string, modifiedContent?: string) {
    return this.client.post(`/interactive/${projectId}/confirm`, {
      action,
      modifiedContent,
    });
  }

  // Get workflow information (all roles and their actions)
  async getInteractiveWorkflow(projectId: string) {
    return this.client.get(`/interactive/${projectId}/workflow`);
  }

  // Get current running role and action
  async getInteractiveRunning(projectId: string) {
    return this.client.get(`/interactive/${projectId}/running`);
  }

  // Reset workflow from a specific role (reset that role and all downstream roles)
  async resetInteractiveWorkflow(projectId: string, role: string) {
    return this.client.post(`/interactive/${projectId}/reset-workflow`, {
      role,
    });
  }

  // Recover from stale or failed actions
  async recoverFromStaleActions(projectId: string) {
    return this.client.post(`/interactive/${projectId}/recover`);
  }

  // Knowledge Base API endpoints
  async createKnowledgeBase(projectId: string, data: {
    title: string;
    content: string;
    description?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }) {
    return this.client.post(`/projects/${projectId}/knowledge-base`, data);
  }

  async getKnowledgeBases(projectId: string, includeInactive?: boolean) {
    return this.client.get(`/projects/${projectId}/knowledge-base`, {
      params: { includeInactive },
    });
  }

  async getKnowledgeBase(projectId: string, docId: string) {
    return this.client.get(`/projects/${projectId}/knowledge-base/${docId}`);
  }

  async updateKnowledgeBase(projectId: string, docId: string, data: {
    title?: string;
    content?: string;
    description?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    isActive?: boolean;
  }) {
    return this.client.put(`/projects/${projectId}/knowledge-base/${docId}`, data);
  }

  async deleteKnowledgeBase(projectId: string, docId: string) {
    return this.client.delete(`/projects/${projectId}/knowledge-base/${docId}`);
  }

  async searchKnowledgeBase(projectId: string, query: string, limit?: number) {
    return this.client.post(`/projects/${projectId}/knowledge-base/search`, {
      query,
      limit,
    });
  }

  // Generic GET method for custom endpoints
  async get(url: string, config?: any) {
    return this.client.get(url, config);
  }

  // Generic POST method for custom endpoints
  async post(url: string, data?: any, config?: any) {
    return this.client.post(url, data, config);
  }

  // 工作流 API 端点
  async getApplicationWorkflows(applicationId: string) {
    return this.client.get(`/applications/${applicationId}/workflows`);
  }

  async getDefaultWorkflow(applicationId: string) {
    return this.client.get(`/applications/${applicationId}/workflows/default`);
  }

  async createWorkflow(applicationId: string, data: {
    name: string;
    description?: string;
    isDefault?: boolean;
    workflowConfig: {
      roles: Array<{
        profile: string;
        name?: string;
        order: number;
        actions: string[];
        watch_actions?: string[];
        config?: Record<string, any>;
      }>;
    };
  }) {
    return this.client.post(`/applications/${applicationId}/workflows`, data);
  }

  async updateWorkflow(applicationId: string, workflowId: string, data: {
    name?: string;
    description?: string;
    isDefault?: boolean;
    workflowConfig?: {
      roles: Array<{
        profile: string;
        name?: string;
        order: number;
        actions: string[];
        watch_actions?: string[];
        config?: Record<string, any>;
      }>;
    };
  }) {
    return this.client.put(`/applications/${applicationId}/workflows/${workflowId}`, data);
  }

  async deleteWorkflow(applicationId: string, workflowId: string) {
    return this.client.delete(`/applications/${applicationId}/workflows/${workflowId}`);
  }

  async setDefaultWorkflow(applicationId: string, workflowId: string) {
    return this.client.post(`/applications/${applicationId}/workflows/${workflowId}/set-default`);
  }
}

export const apiClient = new APIClient();
export default apiClient;

