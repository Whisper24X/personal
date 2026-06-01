import request from './axios.interceptor'

/** 规则类型枚举 */
export enum RuleType {
  菜单目录 = 'menu_dir',
  菜单项 = 'menu',
  页面按钮 = 'button',
}

export const ruleTypeList = [
  { value: RuleType.菜单目录, label: '菜单目录' },
  { value: RuleType.菜单项, label: '菜单项' },
  { value: RuleType.页面按钮, label: '页面按钮' },
]

/** 权限规则信息 */
export interface PermissionRule {
  /** Id */
  id: string
  /** 上级菜单 */
  pid: string
  /** 类型:menu_dir=菜单目录,menu=菜单项,button=页面按钮 */
  type: RuleType
  /** 标题 */
  title: string
  /** 规则名称 */
  name: string
  /** 路由路径 */
  path: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
  /** 子菜单列表 */
  children: PermissionRule[]
}

/** 权限规则列表响应 */
export interface PermissionRuleResponse {
  /** 列表 */
  list?: PermissionRule[]
}

/** 查询权限规则列表 */
export const queryPermissionRules = () => {
  return request.get<PermissionRuleResponse>(
    '/shadow/v1/sysPermission/list',
  )
}

/** 创建\编辑权限规则 */
export const createPermissionRule = (
  data: Omit<PermissionRule, 'id' | 'createdAt' | 'updatedAt' | 'children'>,
) => {
  return request.post<PermissionRule>(
    '/shadow/v1/sysPermission/store',
    { ...data, status: 1 },
  )
}

/** 删除权限规则 */
export const deletePermissionRule = (id: string) => {
  return request.post(`/shadow/v1/sysPermission/del`, { id })
}
