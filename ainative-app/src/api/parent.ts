import { get, post } from "./request"

// 监护人信息接口类型定义
export interface ParentInfo {
  id: string
  parentName: string
  parentPhone: string
  parentSex: string // 男M 女F
}

export interface QueryParentInfoResponse {
  parentInfo: ParentInfo[]
}

export interface StoreParentInfoRequest {
  parentInfo: ParentInfo[]
}

export interface StoreParentInfoResponse {
  // 空响应体
}

/**
 * 查询监护人信息
 */
export const queryParentInfo = () => {
  return get<QueryParentInfoResponse>("/yanxue/wechat/v1/user_wx/queryParentInfo")
}

/**
 * 检查监护人信息是否重复
 */
export const checkDuplicateParent = (
  parentInfo: ParentInfo,
  existingParents: ParentInfo[],
  excludeId?: string
) => {
  return existingParents.some(parent => {
    // 如果是编辑模式，排除当前编辑的监护人
    if (excludeId && parent.parentPhone === excludeId) {
      return false
    }

    // 检查手机号是否重复
    return parent.parentPhone === parentInfo.parentPhone
  })
}

/**
 * 保存监护人信息
 */
export const storeParentInfo = (data: StoreParentInfoRequest) => {
  return post<StoreParentInfoResponse>("/yanxue/wechat/v1/user_wx/storeParentInfo", data)
}
