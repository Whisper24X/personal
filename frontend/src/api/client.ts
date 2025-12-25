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
      (response) => response.data,
      (error) => {
        if (error.response) {
          return Promise.reject(error.response.data);
        }
        return Promise.reject(error);
      }
    );
  }

  // 项目 API 端点
  async createProject(data: {
    name: string;
    idea: string;
    description?: string;
    investment?: number;
    nRound?: number;
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
}

export const apiClient = new APIClient();
export default apiClient;

