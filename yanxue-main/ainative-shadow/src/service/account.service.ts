import request from './axios.interceptor'
import type {
  UserQuery,
  UserResponse,
  CreateUserParams,
  UpdateUserParams,
  ResetPasswordParams,
  DisableUserParams,
} from '@/types/account'

const BASE_URL = `/shadow/v1/sysAdmin`

export function getUserList(params: UserQuery) {
  return request.get<UserResponse>(`${BASE_URL}List`, params)
}

export function createUser(data: CreateUserParams) {
  return request.post<any>(`${BASE_URL}Store`, data)
}

export function updateUser(data: UpdateUserParams) {
  return request.post<any>(`${BASE_URL}Update`, data)
}

export function deleteUser(id: string) {
  return request.post<any>(`${BASE_URL}DelReply`, { id })
}

export function disableUser(data: DisableUserParams) {
  return request.post<any>(`${BASE_URL}Status`, data)
}

export function resetPassword(data: ResetPasswordParams) {
  return request.post<any>(`${BASE_URL}ResetPwd`, data)
}

// /shadow/v1/sysAdminPermission
export function getUserPermission() {
  return request.get<any>(`${BASE_URL}Permission`)
}

export function getDepartmentList() {
  return request.get<any>(`/shadow/v1/sysAdminDeptList`)
}
