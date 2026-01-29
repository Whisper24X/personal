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

  // ==================== 业务线 API 端点（原应用 API）====================
  
  // 创建业务线
  async createBusinessLine(data: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    return this.client.post('/applications', data);
  }

  // 获取业务线列表
  async getBusinessLines() {
    return this.client.get('/applications');
  }

  // 获取单个业务线
  async getBusinessLine(id: string) {
    return this.client.get(`/applications/${id}`);
  }

  // 更新业务线
  async updateBusinessLine(id: string, data: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    return this.client.put(`/applications/${id}`, data);
  }

  // 删除业务线
  async deleteBusinessLine(id: string) {
    return this.client.delete(`/applications/${id}`);
  }

  // 获取业务线下的平台列表
  async getBusinessLinePlatforms(id: string) {
    return this.client.get(`/applications/${id}/projects`);
  }

  // 获取业务线工作流列表
  async getBusinessLineWorkflows(businessLineId: string) {
    return this.client.get(`/applications/${businessLineId}/workflows`);
  }

  // 兼容旧的应用 API（保持向后兼容）
  async createApplication(data: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    return this.createBusinessLine(data);
  }

  async getApplications() {
    return this.getBusinessLines();
  }

  async getApplication(id: string) {
    return this.getBusinessLine(id);
  }

  async updateApplication(id: string, data: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    return this.updateBusinessLine(id, data);
  }

  async deleteApplication(id: string) {
    return this.deleteBusinessLine(id);
  }

  async getApplicationProjects(id: string) {
    return this.getBusinessLinePlatforms(id);
  }

  // ==================== 平台 API 端点（原项目 API）====================
  
  // 创建平台
  async createPlatform(data: {
    name: string;
    idea?: string;
    description?: string;
    investment?: number;
    nRound?: number;
    applicationId?: string;
    gitRepoUrl?: string;
  }) {
    return this.client.post('/projects', data);
  }

  // 启动平台
  async startPlatform(id: string) {
    return this.client.post(`/projects/${id}/start`);
  }

  // 获取单个平台
  async getPlatform(id: string) {
    return this.client.get(`/projects/${id}`);
  }

  // 删除平台
  async deletePlatform(id: string) {
    return this.client.delete(`/projects/${id}`);
  }

  // 获取平台列表
  async getPlatforms(limit?: number) {
    return this.client.get('/projects', { params: { limit } });
  }

  // 获取平台消息
  async getPlatformMessages(id: string, limit?: number) {
    return this.client.get(`/projects/${id}/messages`, { params: { limit } });
  }

  // 获取平台文档
  async getPlatformDocuments(id: string) {
    return this.client.get(`/projects/${id}/documents`);
  }

  // ==================== 平台版本 API 端点 ====================

  /**
   * 创建平台版本
   * @param platformId 平台ID
   * @param data 版本数据
   */
  async createPlatformVersion(platformId: string, data: {
    versionName: string;
    idea: string;
    description?: string;
  }) {
    return this.client.post(`/projects/${platformId}/versions`, data);
  }

  /**
   * 获取平台所有版本
   * @param platformId 平台ID
   */
  async getPlatformVersions(platformId: string) {
    return this.client.get(`/projects/${platformId}/versions`);
  }

  /**
   * 获取平台当前激活版本
   * @param platformId 平台ID
   */
  async getActivePlatformVersion(platformId: string) {
    return this.client.get(`/projects/${platformId}/versions/active`);
  }

  /**
   * 获取单个版本详情
   * @param platformId 平台ID
   * @param versionId 版本ID
   */
  async getPlatformVersion(platformId: string, versionId: string) {
    return this.client.get(`/projects/${platformId}/versions/${versionId}`);
  }

  /**
   * 更新版本信息
   * @param platformId 平台ID
   * @param versionId 版本ID
   * @param data 更新数据
   */
  async updatePlatformVersion(platformId: string, versionId: string, data: {
    description?: string;
    metadata?: Record<string, any>;
  }) {
    return this.client.put(`/projects/${platformId}/versions/${versionId}`, data);
  }

  /**
   * 删除版本
   * @param platformId 平台ID
   * @param versionId 版本ID
   */
  async deletePlatformVersion(platformId: string, versionId: string) {
    return this.client.delete(`/projects/${platformId}/versions/${versionId}`);
  }

  /**
   * 激活版本（切换到该版本的 Git 分支）
   * @param platformId 平台ID
   * @param versionId 版本ID
   */
  async activatePlatformVersion(platformId: string, versionId: string) {
    return this.client.post(`/projects/${platformId}/versions/${versionId}/activate`);
  }

  /**
   * 获取平台 Git 分支信息
   * @param platformId 平台ID
   */
  async getPlatformBranches(platformId: string) {
    return this.client.get(`/projects/${platformId}/branches`);
  }

  // 兼容旧的项目 API（保持向后兼容）
  async createProject(data: {
    name: string;
    idea: string;
    description?: string;
    investment?: number;
    nRound?: number;
    applicationId?: string;
  }) {
    return this.createPlatform(data);
  }

  async startProject(id: string) {
    return this.startPlatform(id);
  }

  async getProject(id: string) {
    return this.getPlatform(id);
  }

  async deleteProject(id: string) {
    return this.deletePlatform(id);
  }

  async getProjects(limit?: number) {
    return this.getPlatforms(limit);
  }

  async getProjectMessages(id: string, limit?: number) {
    return this.getPlatformMessages(id, limit);
  }

  async getProjectDocuments(id: string) {
    return this.getPlatformDocuments(id);
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

  // Prototype API 端点
  async getPrototype(projectId: string, prdId: string) {
    return this.client.get(`/projects/${projectId}/prds/${prdId}/prototype`);
  }

  async getPrototypeFile(projectId: string, prdId: string, filename: string) {
    return this.client.get(`/projects/${projectId}/prds/${prdId}/prototype/${filename}`, {
      responseType: 'text',
    });
  }

  async generatePrototype(projectId: string, prdId: string) {
    return this.client.post(`/projects/${projectId}/prds/${prdId}/prototype/generate`);
  }

  // Version-based prototype preview (no database query)
  getPrototypePreviewUrl(projectId: string, versionId: string): string {
    return `/api/projects/${projectId}/versions/${versionId}/prototype/preview`;
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

  async reviewMRD(
    projectId: string,
    mrdId: string,
    data?: {
      applicationId?: string;
      version?: number;
      mrdContent?: string;
    }
  ) {
    return this.client.post(`/projects/${projectId}/mrds/${mrdId}/review`, data || {});
  }

  async improveMRD(
    projectId: string,
    mrdId: string,
    data?: {
      reviewReport?: string;
      applicationId?: string;
      version?: number;
    }
  ) {
    return this.client.post(`/projects/${projectId}/mrds/${mrdId}/improve`, data || {});
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

  // LLM Model Registry API 端点 (全局模型管理)
  async getLLMModels() {
    return this.client.get('/config/llm/models');
  }

  async getLLMModelsByProvider(provider: string) {
    return this.client.get(`/config/llm/models/${provider}`);
  }

  async createLLMModel(data: {
    provider: string;
    modelName: string;
    displayName?: string;
    isDefault?: boolean;
    sortOrder?: number;
  }) {
    return this.client.post('/config/llm/models', data);
  }

  async updateLLMModel(id: string, data: {
    displayName?: string;
    isDefault?: boolean;
    sortOrder?: number;
  }) {
    return this.client.put(`/config/llm/models/${id}`, data);
  }

  async deleteLLMModel(id: string) {
    return this.client.delete(`/config/llm/models/${id}`);
  }

  async updateLLMModelSortOrder(updates: { id: string; sortOrder: number }[]) {
    return this.client.put('/config/llm/models/sort', { updates });
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

  // Migration API endpoints
  async migrateWorkflowConfig() {
    return this.client.post('/config/migrate-workflow');
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

  // ==================== 工作流 API 端点 ====================

  /**
   * 获取工作流执行状态
   * 返回当前状态、运行位置、步骤列表、待确认信息等
   * @param projectId 项目ID
   * @param versionId 版本ID（必需）
   */
  async getWorkflowState(projectId: string, versionId: string) {
    return this.client.get(`/workflow/${projectId}/state`, {
      params: { versionId },
    });
  }

  /**
   * 获取工作流执行完整记录
   * 包含工作流配置快照和所有执行详情
   * @param projectId 项目ID
   * @param versionId 版本ID（必需）
   */
  async getWorkflowExecution(projectId: string, versionId: string) {
    return this.client.get(`/workflow/${projectId}/execution`, {
      params: { versionId },
    });
  }

  /**
   * 启动工作流执行
   * @param projectId 项目ID
   * @param versionId 版本ID（必需）
   * @param currentPosition 可选：从指定位置开始执行（用于 reset 后启动）
   */
  async startWorkflow(projectId: string, versionId: string, currentPosition?: { roleIndex: number; actionIndex: number }) {
    return this.client.post(`/workflow/${projectId}/start`, { versionId, currentPosition });
  }

  /**
   * 确认并继续执行下一步
   * @param projectId 项目ID
   * @param versionId 版本ID（必需）
   */
  async confirmWorkflow(projectId: string, versionId: string) {
    return this.client.post(`/workflow/${projectId}/confirm`, { versionId });
  }

  /**
   * 重置工作流到指定角色
   * @param projectId 项目ID
   * @param versionId 版本ID（必需）
   * @param targetRole 目标角色名称（该角色及下游角色将被重置）
   */
  async resetWorkflow(projectId: string, versionId: string, targetRole: string) {
    return this.client.post(`/workflow/${projectId}/reset`, {
      versionId,
      targetRole,
    });
  }

  /**
   * 暂停工作流执行
   * @param projectId 项目ID
   * @param versionId 版本ID（必需）
   */
  async pauseWorkflow(projectId: string, versionId: string) {
    return this.client.post(`/workflow/${projectId}/pause`, { versionId });
  }

  /**
   * 恢复已暂停的工作流
   * @param projectId 项目ID
   * @param versionId 版本ID（必需）
   */
  async resumeWorkflow(projectId: string, versionId: string) {
    return this.client.post(`/workflow/${projectId}/resume`, { versionId });
  }

  /**
   * 重试失败的工作流
   * @param projectId 项目ID
   * @param versionId 版本ID（必需）
   */
  async retryWorkflow(projectId: string, versionId: string) {
    return this.client.post(`/workflow/${projectId}/retry`, { versionId });
  }

  /**
   * 恢复工作流状态（用于页面刷新、服务重启等场景）
   * @param projectId 项目ID
   * @param versionId 版本ID（必需）
   */
  async recoverWorkflow(projectId: string, versionId: string) {
    return this.client.post(`/workflow/${projectId}/recover`, { versionId });
  }

  /**
   * 获取恢复状态（检查是否需要恢复）
   * @param projectId 项目ID
   * @param versionId 版本ID（必需）
   */
  async getWorkflowRecoveryStatus(projectId: string, versionId: string) {
    return this.client.get(`/workflow/${projectId}/recovery-status`, {
      params: { versionId },
    });
  }

  // Download workspace code (full ainative-workspace directory)
  downloadWorkspaceCode(projectId: string, versionId?: string) {
    let url = `${API_BASE_URL}/projects/${projectId}/download/code`;
    if (versionId) {
      url += `?versionId=${versionId}`;
    }
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectId}-workspace.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Download workspace docs (docs and openspec directories)
  downloadWorkspaceDocs(projectId: string, versionId?: string) {
    let url = `${API_BASE_URL}/projects/${projectId}/download/docs`;
    if (versionId) {
      url += `?versionId=${versionId}`;
    }
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectId}-docs.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // ==================== 知识库文件上传 API 端点 ====================

  /**
   * 上传知识库文件
   * @param projectId 项目ID
   * @param file 要上传的文件
   */
  async uploadKnowledgeFile(projectId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.client.post(`/projects/${projectId}/knowledge/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * 获取已上传的知识库文件列表
   * @param projectId 项目ID
   */
  async getKnowledgeFiles(projectId: string) {
    return this.client.get(`/projects/${projectId}/knowledge/files`);
  }

  /**
   * 获取知识库文件内容
   * @param projectId 项目ID
   * @param filename 文件名
   */
  async getKnowledgeFile(projectId: string, filename: string) {
    return this.client.get(`/projects/${projectId}/knowledge/files/${encodeURIComponent(filename)}`);
  }

  /**
   * 删除知识库文件
   * @param projectId 项目ID
   * @param filename 文件名
   */
  async deleteKnowledgeFile(projectId: string, filename: string) {
    return this.client.delete(`/projects/${projectId}/knowledge/files/${encodeURIComponent(filename)}`);
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

