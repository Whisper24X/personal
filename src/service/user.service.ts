import request from './axios.interceptor'
import type {
  LoginParams,
  LoginResponse,
  UserPermission,
  UserInfo,
  ChangePasswordParams,
  PermissionDept,
} from '@/types/login'

/** 获取用户信息 */
export const getUserPermission = (): Promise<UserPermission> => {
  return request.get(`/shadow/v1/sysAdminPermission`)
}

/** 获取用户信息 */
export const getUserInfo = (): Promise<{ info: UserInfo }> => {
  return request.get(`/shadow/v1/sysAdminInfo`)
}

/** 登录 */
export const postLogin = (data: LoginParams): Promise<LoginResponse> => {
  return request.post(`/shadow/v1/sysAuthLogin`, data)
}

/** 登出 */
export const postLogout = (): Promise<any> => {
  return request.post(`/shadow/v1/SysAuthLogout`, {})
}

/** 修改密码 */
export const changePassword = (data: ChangePasswordParams): Promise<any> => {
  return request.post('/shadow/v1/sysAdminChangePwd', data)
}

/** 获取部门列表 */
export const getDeptList = (): Promise<{ list: PermissionDept[] }> => {
  return request.get('/shadow/v1/sysAdminDeptList')
}
