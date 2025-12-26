/**
 * 应用 Store
 * Pinia 应用状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '../api/client';

export interface Application {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}

export const useApplicationStore = defineStore('application', () => {
  // 状态
  const applications = ref<Application[]>([]);
  const currentApplication = ref<Application | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const applicationCount = computed(() => applications.value.length);

  // 操作方法
  async function fetchApplications() {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.getApplications();
      applications.value = response.applications || [];
    } catch (err: any) {
      error.value = err.message || '获取应用列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function createApplication(data: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.createApplication(data);
      await fetchApplications(); // 刷新列表
      return response.application;
    } catch (err: any) {
      error.value = err.message || '创建应用失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchApplication(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.getApplication(id);
      currentApplication.value = response.application;
      return response.application;
    } catch (err: any) {
      error.value = err.message || '获取应用失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateApplication(id: string, data: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.updateApplication(id, data);
      await fetchApplications(); // 刷新列表
      if (currentApplication.value?.id === id) {
        currentApplication.value = response.application;
      }
      return response.application;
    } catch (err: any) {
      error.value = err.message || '更新应用失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteApplication(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await apiClient.deleteApplication(id);
      await fetchApplications(); // 刷新列表
      if (currentApplication.value?.id === id) {
        currentApplication.value = null;
      }
    } catch (err: any) {
      error.value = err.message || '删除应用失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    // 状态
    applications,
    currentApplication,
    loading,
    error,
    // 计算属性
    applicationCount,
    // 操作方法
    fetchApplications,
    createApplication,
    fetchApplication,
    updateApplication,
    deleteApplication,
  };
});

