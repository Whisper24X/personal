import type { BusinessLineCustomRole } from '@/api/business-lines'
import type { ProjectCustomRole } from '@/types/api/projects'
export {
  BUSINESS_LINE_CAPABILITY_OPTIONS,
  PROJECT_CAPABILITY_OPTIONS,
  BUSINESS_LINE_CAPABILITY_TREE,
  PROJECT_CAPABILITY_TREE,
  flattenCapabilityTree,
} from './access-control'

export type {
  CapabilityOption,
  CapabilityTreeNode,
  CapabilityTreeLeaf,
  CapabilityTreeGroup,
} from './access-control'

export { isCapabilityTreeLeaf } from './access-control'

export type RoleAssignmentOption = {
  key: string
  label: string
  description: string
  roleId: string
  source: 'default' | 'custom'
}

type DefaultRoleTemplate<Role extends string> = {
  role: Role
  name: string
  capabilities: string[]
}

const BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES = [
  {
    role: 'owner',
    name: 'owner',
    capabilities: [
      'businessLine.read',
      'businessLine.update',
      'businessLine.delete',
      'businessLine.project.list.all',
      'businessLine.project.create',
      'businessLine.project.update',
      'businessLine.project.delete',
      'businessLine.member.read',
      'businessLine.member.invite',
      'businessLine.member.remove',
      'businessLine.member.updateRole',
      'businessLine.role.read',
      'businessLine.role.create',
      'businessLine.role.update',
      'businessLine.role.delete',
      'businessLine.projectRole.read',
      'businessLine.projectRole.create',
      'businessLine.projectRole.update',
      'businessLine.projectRole.delete',
      'businessLine.agentCli.read',
      'businessLine.agentCli.create',
      'businessLine.agentCli.update',
      'businessLine.agentCli.setDefault',
      'businessLine.agentCli.delete',
      'businessLine.workflow.read',
      'businessLine.workflow.create',
      'businessLine.workflow.update',
      'businessLine.workflow.delete',
      'businessLine.skill.read',
      'businessLine.skill.upload',
      'businessLine.skill.update',
      'businessLine.skill.delete',
      'businessLine.mcp.read',
      'businessLine.mcp.manage',
    ],
  },
  {
    role: 'admin',
    name: 'admin',
    capabilities: [
      'businessLine.read',
      'businessLine.project.list.all',
      'businessLine.project.create',
      'businessLine.project.update',
      'businessLine.project.delete',
      'businessLine.member.read',
      'businessLine.member.invite',
      'businessLine.member.remove',
      'businessLine.member.updateRole',
      'businessLine.role.read',
      'businessLine.role.create',
      'businessLine.role.update',
      'businessLine.role.delete',
      'businessLine.projectRole.read',
      'businessLine.projectRole.create',
      'businessLine.projectRole.update',
      'businessLine.projectRole.delete',
      'businessLine.agentCli.read',
      'businessLine.agentCli.create',
      'businessLine.agentCli.update',
      'businessLine.agentCli.setDefault',
      'businessLine.agentCli.delete',
      'businessLine.workflow.read',
      'businessLine.workflow.create',
      'businessLine.workflow.update',
      'businessLine.workflow.delete',
      'businessLine.skill.read',
      'businessLine.skill.upload',
      'businessLine.skill.update',
      'businessLine.skill.delete',
      'businessLine.mcp.read',
      'businessLine.mcp.manage',
    ],
  },
  {
    role: 'member',
    name: 'member',
    capabilities: [
      'businessLine.read',
      'businessLine.project.list.joined',
      'businessLine.skill.read',
      'businessLine.mcp.read',
    ],
  },
] as const satisfies DefaultRoleTemplate<'owner' | 'admin' | 'member'>[]

const PROJECT_DEFAULT_ROLE_TEMPLATES = [
  {
    role: 'owner',
    name: 'owner',
    capabilities: [
      'project.read',
      'project.update',
      'project.delete',
      'project.member.manage',
      'project.task.read',
      'project.task.create',
      'project.task.execute',
      'project.task.cancel',
      'project.kanban.view',
      'project.automation.view',
      'project.automation.manage',
      'project.workflow.view',
      'project.workflow.manage',
      'project.artifact.read',
    ],
  },
  {
    role: 'maintainer',
    name: 'maintainer',
    capabilities: [
      'project.read',
      'project.update',
      'project.member.manage',
      'project.task.read',
      'project.task.create',
      'project.task.execute',
      'project.task.cancel',
      'project.kanban.view',
      'project.automation.view',
      'project.automation.manage',
      'project.workflow.view',
      'project.workflow.manage',
      'project.artifact.read',
    ],
  },
  {
    role: 'developer',
    name: 'developer',
    capabilities: [
      'project.read',
      'project.task.read',
      'project.task.create',
      'project.task.execute',
      'project.kanban.view',
      'project.automation.view',
      'project.workflow.view',
      'project.artifact.read',
    ],
  },
  {
    role: 'viewer',
    name: 'viewer',
    capabilities: [
      'project.read',
      'project.task.read',
      'project.kanban.view',
      'project.automation.view',
      'project.workflow.view',
      'project.artifact.read',
    ],
  },
] as const satisfies DefaultRoleTemplate<'owner' | 'maintainer' | 'developer' | 'viewer'>[]

const normalizeCapabilitySignature = (capabilities: string[]) => {
  return JSON.stringify(Array.from(new Set(capabilities)).sort())
}

const isDefaultTemplateRoleName = (name: string | null | undefined, templateName: string) => {
  const normalizedName = name?.trim().toLowerCase()
  if (!normalizedName) {
    return false
  }

  return (
    normalizedName === templateName ||
    normalizedName === `${templateName}-default` ||
    normalizedName.startsWith(`${templateName}-default-`)
  )
}

const matchesTemplate = <Role extends string>(
  role: Pick<DefaultRoleTemplate<Role>, 'name' | 'capabilities'>,
  templates: DefaultRoleTemplate<Role>[],
  targetRole?: Role,
) => {
  const normalizedCapabilities = normalizeCapabilitySignature(role.capabilities)
  const scopedTemplates = targetRole
    ? templates.filter((template) => template.role === targetRole)
    : templates

  return scopedTemplates.some((template) => {
    return (
      normalizeCapabilitySignature(template.capabilities) === normalizedCapabilities &&
      isDefaultTemplateRoleName(role.name, template.name)
    )
  })
}

const buildRoleDescription = (
  description: string | null | undefined,
  source: 'default' | 'custom',
) => {
  const normalized = description?.trim()
  if (normalized) {
    return normalized
  }

  return source === 'default' ? '默认角色' : '自定义角色'
}

export const isBusinessLineDefaultRole = (
  role: Pick<BusinessLineCustomRole, 'name' | 'capabilities'>,
  targetRole?: 'owner' | 'admin' | 'member',
) => {
  return matchesTemplate(role, [...BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES], targetRole)
}

export const isProjectDefaultRole = (
  role: Pick<ProjectCustomRole, 'name' | 'capabilities'>,
  targetRole?: 'owner' | 'maintainer' | 'developer' | 'viewer',
) => {
  return matchesTemplate(role, [...PROJECT_DEFAULT_ROLE_TEMPLATES], targetRole)
}

export const buildBusinessLineRoleAssignmentOptions = (
  roles: BusinessLineCustomRole[],
): RoleAssignmentOption[] => {
  return roles.map((role) => {
    const source = isBusinessLineDefaultRole(role) ? 'default' : 'custom'

    return {
      key: `role:${role.id}`,
      label: role.name,
      description: buildRoleDescription(role.description, source),
      roleId: role.id,
      source,
    }
  })
}

export const buildProjectRoleAssignmentOptions = (
  roles: ProjectCustomRole[],
): RoleAssignmentOption[] => {
  return roles.map((role) => {
    const source = isProjectDefaultRole(role) ? 'default' : 'custom'

    return {
      key: `role:${role.id}`,
      label: role.name,
      description: buildRoleDescription(role.description, source),
      roleId: role.id,
      source,
    }
  })
}

export const resolveRoleAssignmentKey = (
  roleId: string,
  roleOptions?: RoleAssignmentOption[],
) => {
  const matched = roleOptions?.find((item) => item.roleId === roleId) ?? null
  return matched?.key ?? `role:${roleId}`
}
