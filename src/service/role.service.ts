import request from './axios.interceptor'
import type {
  Role,
  RoleQuery,
  RoleResponse,
  CreateRoleParams,
  UpdateRoleParams,
  RoleAllQuery,
  RoleAllResponse
} from '@/types/role';

const BASE_URL = `/shadow/v1/sysRole`

export function getRoleList(params: RoleQuery) {
  return request.get<RoleResponse>(`${BASE_URL}/list`, params);
}

export function getRoleAll(params: RoleAllQuery) {
  return request.get<RoleAllResponse>(`${BASE_URL}/select`, params);
}


export function createRole(data: CreateRoleParams) {
  return request.post<any, CreateRoleParams>(`${BASE_URL}/store`, data);
}

export function updateRole(data: UpdateRoleParams) {
  return request.post<any, UpdateRoleParams>(`${BASE_URL}/status`, data);
}

export function deleteRole(id: string) {
  return request.post<any>(`${BASE_URL}/del`, { id });
}

// 获取角色的权限菜单
export function getRoleMenus(roleId: string) {
  return request.get<string[]>(`${BASE_URL}/menus/${roleId}`);
}

