export interface User {
  id?: string;
  phone?: string;
  nickname?: string;
  avatar?: string;
  status: number;
  isChangePwd?: boolean;
  roleIds?: string[];
  deptIds?: string[];
  roleList?: { roleId: string; roleName: string }[];
  deptList?: { deptId: string; deptName: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserQuery {
  page: number;
  pageSize: number;
  phone?: string;
  nickname?: string;
  status?: number;
}

export interface UserResponse {
  list: User[];
  total: number;
}

export interface CreateUserParams {
  id?: string;
  phone: string;
  nickname: string;
  avatar: string;
  status?: number;
  roleIds: string[];
  deptIds: string[];
}

export interface UpdateUserParams {
  id: string;
  status?: number;
}

export interface DisableUserParams {
  id: string;
  status: number;
}

export interface ResetPasswordParams {
  id: string;
}

// 状态选项
export const userStatusOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: -1 }
]; 