/**
 * 角色和Action Store
 * Pinia 状态管理，统一管理角色和action的元数据
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '../api/client';

export interface RoleMetadata {
  profile: string;
  name: string;
  displayName?: string;
  goal: string;
  constraints: string;
  description: string;
  actions: ActionMetadata[];
}

export interface ActionMetadata {
  name: string;
  description: string;
  displayName?: string;
}

export const useRoleActionStore = defineStore('roleAction', () => {
  // 状态
  const roles = ref<RoleMetadata[]>([]);
  const actions = ref<ActionMetadata[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性：角色映射表（按profile）
  const rolesByProfile = computed(() => {
    const map: Record<string, RoleMetadata> = {};
    roles.value.forEach((role) => {
      map[role.profile] = role;
    });
    return map;
  });

  // 计算属性：Action映射表（按name）
  const actionsByName = computed(() => {
    const map: Record<string, ActionMetadata> = {};
    actions.value.forEach((action) => {
      map[action.name] = action;
    });
    return map;
  });

  // 计算属性：角色显示名称映射（从API获取，如果没有则使用profile）
  const roleDisplayNames = computed(() => {
    const map: Record<string, string> = {};
    roles.value.forEach((role) => {
      map[role.profile] = role.displayName || role.profile;
    });
    return map;
  });

  // 计算属性：Action显示名称映射（从API获取，如果没有则使用name）
  const actionDisplayNames = computed(() => {
    const map: Record<string, string> = {};
    actions.value.forEach((action) => {
      map[action.name] = action.displayName || action.name;
    });
    return map;
  });

  // 操作方法：获取所有角色和action
  async function fetchRolesAndActions() {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.get('/config/roles-actions') as any;
      if (response.success) {
        roles.value = response.roles || [];
        actions.value = response.actions || [];
      } else {
        error.value = '获取角色和action失败';
      }
    } catch (err: any) {
      error.value = err.message || '获取角色和action失败';
      console.error('Failed to fetch roles and actions:', err);
    } finally {
      loading.value = false;
    }
  }

  // 操作方法：获取角色描述
  function getRoleDescription(role: string): string {
    const roleData = rolesByProfile.value[role];
    return roleData?.description || '';
  }

  // 操作方法：获取Action描述
  function getActionDescription(action: string): string {
    const actionData = actionsByName.value[action];
    return actionData?.description || '';
  }

  // 操作方法：获取角色显示名称
  function getRoleDisplayName(role: string): string {
    return roleDisplayNames.value[role] || role;
  }

  // 操作方法：获取Action显示名称
  function getActionDisplayName(action: string): string {
    return actionDisplayNames.value[action] || action;
  }

  // 操作方法：获取角色信息
  function getRole(profile: string): RoleMetadata | undefined {
    return rolesByProfile.value[profile];
  }

  // 操作方法：获取Action信息
  function getAction(name: string): ActionMetadata | undefined {
    return actionsByName.value[name];
  }

  return {
    // 状态
    roles,
    actions,
    loading,
    error,
    // 计算属性
    rolesByProfile,
    actionsByName,
    roleDisplayNames,
    actionDisplayNames,
    // 操作方法
    fetchRolesAndActions,
    getRoleDescription,
    getActionDescription,
    getRoleDisplayName,
    getActionDisplayName,
    getRole,
    getAction,
  };
});

