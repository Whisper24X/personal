import { post } from "./request"

// 用户绑定学生相关接口类型定义
export interface UserBindStudentInfo {
  id: string
  studentIdentityCard: string
  studentName: string
  studentSex: string // 男M 女F
  studentAge: number // 1-100
  createdAt: string
  updatedAt: string
}

/**
 * 创建/更新用户绑定学生信息
 * @description 该接口同时支持新增和更新操作：
 * - 新增：不传 id 参数
 * - 更新：传入 id 参数
 */
export const createUserBindStudent = (data: {
  id?: string
  studentName: string
  studentIdentityCard: string
  studentSex: string // 男M 女F
  studentAge: number // 1-100
}) => {
  return post<{ id: string }>("/yanxue/wechat/v1/user_bind_student/create", data)
}

/**
 * 获取用户绑定学生信息列表
 */
export const getUserBindStudentList = () => {
  return post<{
    list: UserBindStudentInfo[]
  }>("/yanxue/wechat/v1/user_bind_student/list", {})
}

/**
 * 获取单个用户绑定学生信息
 */
export const getUserBindStudentInfo = (id: string) => {
  return post<{
    info: UserBindStudentInfo
  }>("/yanxue/wechat/v1/user_bind_student/info", { id })
}

/**
 * 删除用户绑定学生信息
 */
export const deleteUserBindStudent = (id: string) => {
  return post("/yanxue/wechat/v1/user_bind_student/delete", { id })
}
