import request from '@/service/axios.interceptor'

/**
 * 用户查询参数接口
 */
export interface UserQuery {
    page: number;
    pageSize: number;
    phone?: string;
}

/**
 * 用户微信信息接口
 */
export interface UserWxInfo {
    id: string;
    unionid?: string;
    offiaccountOpenId?: string;
    offiaccountFollow?: boolean;
    status: number;
    createdAt?: Date;
    updatedAt?: Date;
    nickname?: string;
    sex?: number;
    province?: string;
    city?: string;
    country?: string;
    headimgurl?: string;
    miniprogramOpenId?: string;
}

/**
 * 用户信息接口
 */
export interface User {
    id?: string;
    phone?: string;
    nickname?: string;
    avatar?: string;
    status: number;
    createdAt?: Date;
    updatedAt?: Date;
    userWxInfo?: UserWxInfo;
}

/**
 * 用户响应接口
 */
export interface UserResponse {
    total: number;
    list: User[];
}

/**
 * 获取用户信息参数
 */
export interface GetUserInfoParams {
    id: string;
}

/**
 * 获取用户信息响应
 */
export interface GetUserInfoResponse {
    userInfo: User;
}

/**
 * 删除用户参数
 */
export interface DeleteUserParams {
    id: string;
}

/**
 * 解绑微信参数
 */
export interface UnbindUserWxParams {
    id: string;
}

/**
 * 更新用户状态参数
 */
export interface UpdateUserStatusParams {
    id: string;
    status: number;
}


/**
 * 获取用户列表
 * @param params 查询参数
 * @returns 用户列表和总数
 */
export function getUserList(params: UserQuery) {
    return request.post<UserResponse>(`/api/shadow/v1/user/list`, params)
}

/**
 * 获取用户详情
 * @param params 用户ID
 * @returns 用户详情
 */
export function getUserInfo(params: GetUserInfoParams) {
    return request.post<GetUserInfoResponse>(`/api/shadow/v1/user/info`, params)
}

/**
 * 删除用户
 * @param params 用户ID
 * @returns 删除结果
 */
export function deleteUser(params: DeleteUserParams) {
    return request.post<any>(`/api/shadow/v1/user/delete`, params)
}

/**
 * 更新用户状态（启用/禁用）
 * @param params 用户ID和状态
 * @returns 操作结果
 */
export function updateUserStatus(params: UpdateUserStatusParams) {
    return request.post<any>(`/api/shadow/v1/user/update_status`, params)
}

/**
 * 解绑用户微信
 * @param params 用户ID
 * @returns 操作结果
 */
export function unbindUserWx(params: UnbindUserWxParams) {
    return request.post<any>(`/api/shadow/v1/user/unbind_user_wx`, params)
} 