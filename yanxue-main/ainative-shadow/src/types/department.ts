export interface Department {
  id: number | string
  name: string
  pid: number | string
  type: string
  status: number
  remark?: string
  createdAt?: string
  updatedAt?: string
  children?: Department[]
}

export interface DepartmentQuery {
  keyword?: string
  pageSize: number
  pageNum: number
}

export interface DepartmentTreeQuery {
  keyword?: string
}

// 响应接口定义
export interface DepartmentResponse {
  list: Department[]
  total: number
}

export interface DepartmentTreeResponse {
  list: Department[]
}

export interface CreateDepartmentParams {
  id?: string
  pid: string
  type: string
  name: string
  remark?: string
  sort: string
  status: number
}

export interface UpdateDepartmentParams {
  id: string
  status: number
}

export interface CreateDepartmentResponse {
  code: number
  message: string
  data: Department
}

export interface UpdateDepartmentResponse { }

export interface DeleteDepartmentParams {
  id: string | number
}

export interface DeleteDepartmentResponse {
  code: number
  message: string
}
