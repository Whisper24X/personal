/**
 * API 客户端
 * 基于 Axios 的 HTTP 客户端，用于后端通信
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
          return Promise.reject(error.response.data);
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
    return this.client.get(`/projects/${projectId}/prds`, {
      params: { includeDeleted },
    });
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

  async adjustRequirementSection(
    projectId: string,
    requirementId: string,
    sectionNumber: number,
    userRequest: string
  ) {
    return this.client.post(
      `/projects/${projectId}/requirements/${requirementId}/sections/${sectionNumber}/adjust`,
      { userRequest }
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
}

export const apiClient = new APIClient();
export default apiClient;

