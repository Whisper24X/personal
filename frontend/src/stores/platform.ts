/**
 * 平台 Store
 * Pinia 平台状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '../api/client';

export interface Platform {
  id: string;
  name: string;
  status: string;
  progress: number;
  totalCost: number;
  createdAt: string;
  completedAt?: string;
}

export const usePlatformStore = defineStore('platform', () => {
  // 状态
  const platforms = ref<Platform[]>([]);
  const currentPlatform = ref<any>(null);
  const messages = ref<any[]>([]);
  const documents = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const platformCount = computed(() => platforms.value.length);
  const completedCount = computed(
    () => platforms.value.filter((p) => p.status === 'completed').length
  );

  // 操作方法
  async function fetchPlatforms() {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.getPlatforms() as any;
      platforms.value = response.platforms || response.projects || [];
    } catch (err: any) {
      error.value = err.message || '获取平台列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function createPlatform(data: {
    name: string;
    idea: string;
    description?: string;
    investment?: number;
    nRound?: number;
    businessLineId?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      // 转换参数名以兼容后端
      const apiData = {
        ...data,
        applicationId: data.businessLineId,
      };
      delete (apiData as any).businessLineId;
      
      const response = await apiClient.createPlatform(apiData) as any;
      await fetchPlatforms(); // 刷新列表
      return response.platform || response.project;
    } catch (err: any) {
      // Handle duplicate platform name error (409 Conflict)
      if (err.status === 409 || err.error === 'Duplicate project name') {
        error.value = err.message || '平台名称已存在，请使用不同的名称';
      } else {
        error.value = err.message || '创建平台失败';
      }
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function startPlatform(id: string) {
    try {
      await apiClient.startPlatform(id);
      await fetchPlatform(id); // 刷新平台状态
    } catch (err: any) {
      error.value = err.message || '启动平台失败';
      throw err;
    }
  }

  async function fetchPlatform(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.getPlatform(id) as any;
      currentPlatform.value = response.platform || response.project;
      if (!currentPlatform.value) {
        error.value = '平台不存在';
      }
    } catch (err: any) {
      // Handle 404 specifically
      if (err.response?.status === 404 || err.response?.data?.error === 'Project not found') {
        error.value = '平台不存在';
      } else {
        error.value = err.response?.data?.message || err.message || '获取平台失败';
      }
      currentPlatform.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMessages(id: string) {
    try {
      const response = await apiClient.getPlatformMessages(id) as any;
      messages.value = response.messages || [];
    } catch (err: any) {
      error.value = err.message || '获取消息失败';
    }
  }

  async function fetchDocuments(id: string) {
    try {
      const response = await apiClient.getPlatformDocuments(id) as any;
      documents.value = response.documents || [];
    } catch (err: any) {
      error.value = err.message || '获取文档失败';
    }
  }

  return {
    // 状态
    platforms,
    currentPlatform,
    messages,
    documents,
    loading,
    error,
    // 计算属性
    platformCount,
    completedCount,
    // 操作方法
    fetchPlatforms,
    createPlatform,
    startPlatform,
    fetchPlatform,
    fetchMessages,
    fetchDocuments,
  };
});
