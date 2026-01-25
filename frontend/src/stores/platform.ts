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

export interface PlatformVersion {
  id: string;
  projectId: string;
  versionName: string;
  description?: string;
  branchName: string;
  isActive: boolean;
  workspacePath?: string;
  createdAt: string;
  updatedAt?: string;
}

export const usePlatformStore = defineStore('platform', () => {
  // 状态
  const platforms = ref<Platform[]>([]);
  const currentPlatform = ref<any>(null);
  const messages = ref<any[]>([]);
  const documents = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // 版本相关状态
  const activeVersion = ref<PlatformVersion | null>(null);
  const versions = ref<PlatformVersion[]>([]);

  // 计算属性
  const platformCount = computed(() => platforms.value.length);
  const completedCount = computed(
    () => platforms.value.filter((p) => p.status === 'completed').length
  );
  const activeVersionId = computed(() => activeVersion.value?.id || null);

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
    idea?: string;
    description?: string;
    investment?: number;
    nRound?: number;
    businessLineId?: string;
    gitRepoUrl?: string;
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

  // ==================== 版本管理方法 ====================

  /**
   * 获取平台所有版本
   */
  async function fetchVersions(platformId: string) {
    try {
      const response = await apiClient.getPlatformVersions(platformId) as any;
      versions.value = response.versions || [];
      
      // 设置当前活动版本
      const active = versions.value.find(v => v.isActive);
      if (active) {
        activeVersion.value = active;
      }
      
      return versions.value;
    } catch (err: any) {
      error.value = err.message || '获取版本列表失败';
      return [];
    }
  }

  /**
   * 获取当前活动版本
   */
  async function fetchActiveVersion(platformId: string) {
    try {
      const response = await apiClient.getActivePlatformVersion(platformId) as any;
      if (response.version) {
        activeVersion.value = response.version;
      }
      return activeVersion.value;
    } catch (err: any) {
      error.value = err.message || '获取活动版本失败';
      return null;
    }
  }

  /**
   * 设置活动版本
   */
  function setActiveVersion(version: PlatformVersion | null) {
    activeVersion.value = version;
  }

  /**
   * 激活指定版本
   */
  async function activateVersion(platformId: string, versionId: string) {
    try {
      await apiClient.activatePlatformVersion(platformId, versionId);
      // 刷新版本列表以获取最新状态
      await fetchVersions(platformId);
      return activeVersion.value;
    } catch (err: any) {
      error.value = err.message || '激活版本失败';
      throw err;
    }
  }

  /**
   * 清除版本状态（切换平台时调用）
   */
  function clearVersionState() {
    activeVersion.value = null;
    versions.value = [];
  }

  return {
    // 状态
    platforms,
    currentPlatform,
    messages,
    documents,
    loading,
    error,
    // 版本相关状态
    activeVersion,
    versions,
    // 计算属性
    platformCount,
    completedCount,
    activeVersionId,
    // 操作方法
    fetchPlatforms,
    createPlatform,
    startPlatform,
    fetchPlatform,
    fetchMessages,
    fetchDocuments,
    // 版本管理方法
    fetchVersions,
    fetchActiveVersion,
    setActiveVersion,
    activateVersion,
    clearVersionState,
  };
});
