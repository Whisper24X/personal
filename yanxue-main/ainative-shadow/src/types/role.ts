export interface Role {
  id?: string;
  name: string;
  remark: string;
  dataPermission: string;
  status: number;
  sort: number;
  permissionIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleQuery {
  page: number;
  pageSize: number;
  name?: string;
  dataPermission?: 'all' | 'dept' | 'deptAndBelow' | 'self';
  status?: number;
}

export interface RoleAllQuery {
  status?: number;
  dataPermission?: 'all' | 'dept' | 'deptAndBelow' | 'self';
}

export interface RoleResponse {
  list: Role[];
  total: number;
}

export interface RoleAllResponse {
  list: Role[];
}

export interface CreateRoleParams {
  id?: string;
  name: string;
  remark?: string;
  dataPermission: string;
  status: number;
  sort: number;
  permissionIds: string[];
}

export interface UpdateRoleParams {
  id: string;
  status: number;
}

// 数据权限选项
export const dataPermissionOptions = [
  { label: '全部数据', value: 'all' },
  { label: '本部门数据', value: 'dept' },
  { label: '本部门及以下数据', value: 'deptAndBelow' },
  { label: '仅本人数据', value: 'self' }
];

// 状态选项
export const statusOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: -1 }
]; 