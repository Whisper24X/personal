import request from './axios.interceptor'
import type {
  Department,
  DepartmentQuery,
  DepartmentTreeQuery,
  DepartmentResponse,
  DepartmentTreeResponse,
  CreateDepartmentParams,
  CreateDepartmentResponse,
  DeleteDepartmentParams,
  DeleteDepartmentResponse,
  UpdateDepartmentParams,
  UpdateDepartmentResponse
} from '@/types/department';

const BASE_URL = `/shadow/v1/sysDept`

export function createDepartment(data: CreateDepartmentParams) {
  return request.post<CreateDepartmentResponse, CreateDepartmentParams>(`${BASE_URL}/store`, data);
}

export function updateDepartment(data: UpdateDepartmentParams) {
  return request.post<UpdateDepartmentResponse, UpdateDepartmentParams>(`${BASE_URL}/status`, data);
}

export function deleteDepartment(id: string) {
  return request.post<DeleteDepartmentResponse, DeleteDepartmentParams>(`${BASE_URL}/del`, { id });
}

export function getDepartmentTree() {
  return request.get<DepartmentResponse>(`${BASE_URL}/list`);
}