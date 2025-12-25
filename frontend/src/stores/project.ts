/**
 * 项目 Store
 * Pinia 项目状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '../api/client';

export interface Project {
  id: string;
  name: string;
  status: string;
  progress: number;
  totalCost: number;
  createdAt: string;
  completedAt?: string;
}

export const useProjectStore = defineStore('project', () => {
  // 状态
  const projects = ref<Project[]>([]);
  const currentProject = ref<any>(null);
  const messages = ref<any[]>([]);
  const documents = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const projectCount = computed(() => projects.value.length);
  const completedCount = computed(
    () => projects.value.filter((p) => p.status === 'completed').length
  );

  // 操作方法
  async function fetchProjects() {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.getProjects();
      projects.value = response.projects || [];
    } catch (err: any) {
      error.value = err.message || '获取项目列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function createProject(data: {
    name: string;
    idea: string;
    description?: string;
    investment?: number;
    nRound?: number;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.createProject(data);
      await fetchProjects(); // 刷新列表
      return response.project;
    } catch (err: any) {
      error.value = err.message || '创建项目失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function startProject(id: string) {
    try {
      await apiClient.startProject(id);
      await fetchProject(id); // 刷新项目状态
    } catch (err: any) {
      error.value = err.message || '启动项目失败';
      throw err;
    }
  }

  async function fetchProject(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.getProject(id);
      currentProject.value = response.project;
    } catch (err: any) {
      error.value = err.message || '获取项目失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchMessages(id: string) {
    try {
      const response = await apiClient.getProjectMessages(id);
      messages.value = response.messages || [];
    } catch (err: any) {
      error.value = err.message || '获取消息失败';
    }
  }

  async function fetchDocuments(id: string) {
    try {
      const response = await apiClient.getProjectDocuments(id);
      documents.value = response.documents || [];
    } catch (err: any) {
      error.value = err.message || '获取文档失败';
    }
  }

  return {
    // 状态
    projects,
    currentProject,
    messages,
    documents,
    loading,
    error,
    // 计算属性
    projectCount,
    completedCount,
    // 操作方法
    fetchProjects,
    createProject,
    startProject,
    fetchProject,
    fetchMessages,
    fetchDocuments,
  };
});

