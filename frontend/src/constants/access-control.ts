import type { AppRouteMeta } from '@/types/router/meta'

export type AccessScope = 'global' | 'businessLine' | 'project'

export type CapabilityOption = {
  code: string
  label: string
  description: string
}

type AccessCapabilityDefinition = {
  label: string
  description: string
  scope: AccessScope
}

export const ACCESS_CAPABILITY_CONFIG = {
  'businessLine.create': {
    label: '创建业务线',
    description: '登录后创建新的业务线',
    scope: 'global',
  },
  'businessLine.read': {
    label: '查看业务线',
    description: '查看业务线基础信息和列表',
    scope: 'businessLine',
  },
  'businessLine.update': {
    label: '编辑业务线',
    description: '修改业务线名称与描述',
    scope: 'businessLine',
  },
  'businessLine.delete': {
    label: '删除业务线',
    description: '删除业务线',
    scope: 'businessLine',
  },
  'businessLine.member.manage': {
    label: '成员管理',
    description: '邀请、调整和移除业务线成员',
    scope: 'businessLine',
  },
  'businessLine.project.list.all': {
    label: '查看全部项目',
    description: '查看该业务线下所有项目条目',
    scope: 'businessLine',
  },
  'businessLine.project.list.joined': {
    label: '查看已加入项目',
    description: '查看当前用户已加入的项目条目',
    scope: 'businessLine',
  },
  'businessLine.project.create': {
    label: '创建项目',
    description: '在业务线下新建项目',
    scope: 'businessLine',
  },
  'businessLine.project.update': {
    label: '编辑项目条目',
    description: '编辑业务线下项目条目',
    scope: 'businessLine',
  },
  'businessLine.project.delete': {
    label: '删除项目条目',
    description: '删除业务线下项目条目',
    scope: 'businessLine',
  },
  'project.read': {
    label: '查看项目',
    description: '访问项目详情和基础信息',
    scope: 'project',
  },
  'project.update': {
    label: '项目配置',
    description: '修改项目配置',
    scope: 'project',
  },
  'project.delete': {
    label: '删除项目',
    description: '删除项目',
    scope: 'project',
  },
  'project.member.manage': {
    label: '成员管理',
    description: '添加、调整和移除项目成员',
    scope: 'project',
  },
  'project.task.read': {
    label: '查看任务',
    description: '查看项目任务列表和详情',
    scope: 'project',
  },
  'project.task.create': {
    label: '创建任务',
    description: '创建和编辑任务',
    scope: 'project',
  },
  'project.task.execute': {
    label: '执行任务',
    description: '执行、重试和推进任务',
    scope: 'project',
  },
  'project.task.cancel': {
    label: '取消任务',
    description: '取消运行中的任务',
    scope: 'project',
  },
  'project.kanban.view': {
    label: '查看看板',
    description: '查看项目看板',
    scope: 'project',
  },
  'project.workflow.view': {
    label: '查看工作流',
    description: '查看工作流模板',
    scope: 'project',
  },
  'project.workflow.manage': {
    label: '管理工作流',
    description: '新增、编辑和删除工作流模板',
    scope: 'project',
  },
  'project.artifact.read': {
    label: '查看产物',
    description: '查看任务产物',
    scope: 'project',
  },
} as const satisfies Record<string, AccessCapabilityDefinition>

export type AccessCapabilityCode = keyof typeof ACCESS_CAPABILITY_CONFIG

export type RouteAccessConfig = {
  title: string
  capabilities: readonly AccessCapabilityCode[]
}

export const ROUTE_ACCESS_CONFIG = {
  rootRedirect: {
    title: '仪表盘',
    capabilities: ['project.read'],
  },
  home: {
    title: '首页',
    capabilities: [],
  },
  dashboard: {
    title: '仪表盘',
    capabilities: ['project.read'],
  },
  kanban: {
    title: '看板',
    capabilities: ['project.kanban.view'],
  },
  knowledgeBase: {
    title: '知识库',
    capabilities: ['project.read'],
  },
  skills: {
    title: 'Skills',
    capabilities: ['project.read'],
  },
  mcp: {
    title: 'MCP',
    capabilities: ['project.read'],
  },
  automations: {
    title: '自动化',
    capabilities: ['project.read'],
  },
  git: {
    title: 'Git',
    capabilities: ['project.read'],
  },
  businessLineInvite: {
    title: '业务线邀请',
    capabilities: [],
  },
  businessLines: {
    title: '业务线',
    capabilities: [],
  },
  projects: {
    title: '项目列表',
    capabilities: [],
  },
  projectWorkflows: {
    title: '项目工作流',
    capabilities: ['project.workflow.view'],
  },
  projectDetail: {
    title: '项目',
    capabilities: ['project.read'],
  },
  projectWorkflowsById: {
    title: '项目工作流',
    capabilities: ['project.workflow.view'],
  },
  tasks: {
    title: '任务',
    capabilities: ['project.task.read'],
  },
  taskDetail: {
    title: '任务详情',
    capabilities: ['project.task.read'],
  },
  users: {
    title: '用户管理',
    capabilities: [],
  },
  settings: {
    title: '设置',
    capabilities: [],
  },
} as const satisfies Record<string, RouteAccessConfig>

export type RouteAccessKey = keyof typeof ROUTE_ACCESS_CONFIG

export type ProjectMenuAccessItem = {
  id: 'dashboard' | 'workflow' | 'tasks' | 'knowledge' | 'kanban' | 'automations' | 'skills' | 'mcp' | 'git'
  label: string
  to: string
  capabilities: readonly AccessCapabilityCode[]
}

export const PROJECT_MENU_ACCESS_CONFIG = [
  { id: 'dashboard', label: '仪表盘', to: '/dashboard', capabilities: ['project.read'] },
  { id: 'tasks', label: '任务', to: '/tasks', capabilities: ['project.task.read'] },
  { id: 'knowledge', label: '知识库', to: '/knowledge-base', capabilities: ['project.read'] },
  { id: 'kanban', label: '看板', to: '/kanban', capabilities: ['project.kanban.view'] },
  { id: 'automations', label: '自动化', to: '/automations', capabilities: ['project.read'] },
  { id: 'workflow', label: '工作流', to: '/projects/workflows', capabilities: ['project.workflow.view'] },
  { id: 'skills', label: 'Skills', to: '/skills', capabilities: ['project.read'] },
  { id: 'mcp', label: 'MCP', to: '/mcp', capabilities: ['project.read'] },
  { id: 'git', label: 'Git', to: '/git', capabilities: ['project.read'] },
] as const satisfies readonly ProjectMenuAccessItem[]

export type ProjectMenuId = (typeof PROJECT_MENU_ACCESS_CONFIG)[number]['id']

export type ButtonAccessConfig = {
  label: string
  capabilities: readonly AccessCapabilityCode[]
}

export const BUTTON_ACCESS_CONFIG = {
  createBusinessLine: {
    label: '创建业务线',
    capabilities: ['businessLine.create'],
  },
  editBusinessLine: {
    label: '编辑业务线',
    capabilities: ['businessLine.update'],
  },
  deleteBusinessLine: {
    label: '删除业务线',
    capabilities: ['businessLine.delete'],
  },
  manageBusinessLineMembers: {
    label: '管理业务线成员',
    capabilities: ['businessLine.member.manage'],
  },
  createProjectItem: {
    label: '新建项目',
    capabilities: ['businessLine.project.create'],
  },
  editProjectItem: {
    label: '编辑项目条目',
    capabilities: ['businessLine.project.update'],
  },
  deleteProjectItem: {
    label: '删除项目条目',
    capabilities: ['businessLine.project.delete'],
  },
  manageProjectMembers: {
    label: '管理项目成员',
    capabilities: ['project.member.manage'],
  },
  editProjectConfig: {
    label: '编辑项目配置',
    capabilities: ['project.update'],
  },
  deleteProject: {
    label: '删除项目',
    capabilities: ['project.delete'],
  },
  createTask: {
    label: '创建任务',
    capabilities: ['project.task.create'],
  },
  editTask: {
    label: '编辑任务',
    capabilities: ['project.task.create'],
  },
  deleteTask: {
    label: '删除任务',
    capabilities: ['project.task.create'],
  },
  replyTask: {
    label: '补充任务信息',
    capabilities: ['project.task.create'],
  },
  executeTask: {
    label: '执行任务',
    capabilities: ['project.task.execute'],
  },
  cancelTask: {
    label: '取消任务',
    capabilities: ['project.task.cancel'],
  },
  manageWorkflow: {
    label: '管理工作流',
    capabilities: ['project.workflow.manage'],
  },
  createBusinessLineCustomRole: {
    label: '创建业务线自定义角色',
    capabilities: ['businessLine.member.manage'],
  },
  createProjectCustomRole: {
    label: '创建项目自定义角色',
    capabilities: ['project.member.manage'],
  },
} as const satisfies Record<string, ButtonAccessConfig>

export type ButtonAccessKey = keyof typeof BUTTON_ACCESS_CONFIG

const toCapabilityOption = ([code, definition]: [string, AccessCapabilityDefinition]): CapabilityOption => ({
  code,
  label: definition.label,
  description: definition.description,
})

export const getCapabilityLabel = (code: string) => {
  return ACCESS_CAPABILITY_CONFIG[code as AccessCapabilityCode]?.label ?? code
}

export const getCapabilityDescription = (code: string) => {
  return ACCESS_CAPABILITY_CONFIG[code as AccessCapabilityCode]?.description ?? ''
}

export const getCapabilityOptionsByScope = (scope: Exclude<AccessScope, 'global'>): CapabilityOption[] => {
  return Object.entries(ACCESS_CAPABILITY_CONFIG)
    .filter(([, definition]) => definition.scope === scope)
    .map(toCapabilityOption)
}

export const BUSINESS_LINE_CAPABILITY_OPTIONS = getCapabilityOptionsByScope('businessLine')
export const PROJECT_CAPABILITY_OPTIONS = getCapabilityOptionsByScope('project')

export const getPermissionNames = (capabilities: readonly string[]) => {
  return capabilities.map((capability) => getCapabilityLabel(capability))
}

export const hasSomeAccess = (
  requiredCapabilities: readonly string[] | undefined,
  hasCapability: (capability: string) => boolean,
) => {
  if (!requiredCapabilities || requiredCapabilities.length === 0) {
    return true
  }

  return requiredCapabilities.some((capability) => hasCapability(capability))
}

export const buildRouteAccessMeta = (
  key: RouteAccessKey,
  overrides: Omit<AppRouteMeta, 'title' | 'capabilities'> = {},
): AppRouteMeta => {
  const config = ROUTE_ACCESS_CONFIG[key]

  return {
    title: config.title,
    requiresAuth: true,
    ...overrides,
    ...(config.capabilities.length > 0 ? { capabilities: [...config.capabilities] } : {}),
  }
}

export const APP_ACCESS_CONFIG = {
  capabilities: ACCESS_CAPABILITY_CONFIG,
  routes: ROUTE_ACCESS_CONFIG,
  menus: PROJECT_MENU_ACCESS_CONFIG,
  buttons: BUTTON_ACCESS_CONFIG,
} as const
