import type { PermissionRule } from '@/service/permission.service'

export interface LoginParams {
  username: string
  password: string
}

export interface LogOutParams {
  adminId: string
}

export interface LoginResponse {
  token: string
  expiredAt: string
  refreshAt: string
}

export interface UserInfo {
  id: string
  nickname: string
  /** 是否需要修改密码 */
  isChangePwd: boolean
}

export interface ChangePasswordParams {
  password: string
  oldPassword: string
}

export interface UserPermission {
  list: PermissionRule[]
}

export interface PermissionDept {
  /** 子集 */
  children: PermissionDept[]
  /** 创建时间 */
  createdAt: string
  /** Id */
  id: string
  /** 是否可选 */
  isSelect: boolean
  /** 名称 */
  name: string
  /** pid */
  pid: string
  /** 备注 */
  remark: string
  /** 状态:-1=禁用,1=启用 */
  status: number
  /** 更新时间 */
  updatedAt: string
  storeList?: PermissionDept[]
}
