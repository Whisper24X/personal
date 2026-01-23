/**
 * 业务线 Store
 * Pinia 业务线状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '../api/client';

export interface BusinessLine {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  platformCount: number;
  createdAt: string;
  updatedAt: string;
}

export const useBusinessLineStore = defineStore('businessLine', () => {
  // 状态
  const businessLines = ref<BusinessLine[]>([]);
  const currentBusinessLine = ref<BusinessLine | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const businessLineCount = computed(() => businessLines.value.length);

  // 操作方法
  async function fetchBusinessLines() {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.getBusinessLines() as any;
      businessLines.value = response.businessLines || response.applications || [];
    } catch (err: any) {
      error.value = err.message || '获取业务线列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function createBusinessLine(data: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.createBusinessLine(data) as any;
      await fetchBusinessLines(); // 刷新列表
      return response.businessLine || response.application;
    } catch (err: any) {
      error.value = err.message || '创建业务线失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchBusinessLine(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.getBusinessLine(id) as any;
      currentBusinessLine.value = response.businessLine || response.application;
      return currentBusinessLine.value;
    } catch (err: any) {
      error.value = err.message || '获取业务线失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateBusinessLine(id: string, data: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.updateBusinessLine(id, data) as any;
      await fetchBusinessLines(); // 刷新列表
      if (currentBusinessLine.value?.id === id) {
        currentBusinessLine.value = response.businessLine || response.application;
      }
      return response.businessLine || response.application;
    } catch (err: any) {
      error.value = err.message || '更新业务线失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteBusinessLine(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await apiClient.deleteBusinessLine(id);
      await fetchBusinessLines(); // 刷新列表
      if (currentBusinessLine.value?.id === id) {
        currentBusinessLine.value = null;
      }
    } catch (err: any) {
      error.value = err.message || '删除业务线失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    // 状态
    businessLines,
    currentBusinessLine,
    loading,
    error,
    // 计算属性
    businessLineCount,
    // 操作方法
    fetchBusinessLines,
    createBusinessLine,
    fetchBusinessLine,
    updateBusinessLine,
    deleteBusinessLine,
  };
});
