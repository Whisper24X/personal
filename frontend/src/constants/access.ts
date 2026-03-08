import type { BusinessLineCustomRole, BusinessLineMemberRole } from '@/api/business-lines'
import type { ProjectCustomRole, ProjectMemberRole } from '@/types/api/projects'
export { BUSINESS_LINE_CAPABILITY_OPTIONS, PROJECT_CAPABILITY_OPTIONS } from './access-control'

export type { CapabilityOption } from './access-control'

export type RoleAssignmentOption<Role extends string = string> = {
  key: string
  label: string
  description: string
  role: Role
  source: 'default' | 'custom'
}

const businessLineDefaultRoleCodeSet = new Set<BusinessLineMemberRole>(['owner', 'admin', 'member'])
const projectDefaultRoleCodeSet = new Set<ProjectMemberRole>([
  'owner',
  'maintainer',
  'developer',
  'viewer',
])

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

export const buildBusinessLineRoleAssignmentOptions = (
  roles: BusinessLineCustomRole[],
): RoleAssignmentOption<string>[] => {
  return roles.map((role) => {
    const source = businessLineDefaultRoleCodeSet.has(role.code as BusinessLineMemberRole)
      ? 'default'
      : 'custom'

    return {
      key: `role:${role.code}`,
      label: role.name,
      description: buildRoleDescription(role.description, source),
      role: role.code,
      source,
    }
  })
}

export const buildProjectRoleAssignmentOptions = (
  roles: ProjectCustomRole[],
): RoleAssignmentOption<string>[] => {
  return roles.map((role) => {
    const source = projectDefaultRoleCodeSet.has(role.code as ProjectMemberRole)
      ? 'default'
      : 'custom'

    return {
      key: `role:${role.code}`,
      label: role.name,
      description: buildRoleDescription(role.description, source),
      role: role.code,
      source,
    }
  })
}

export const resolveRoleAssignmentKey = <Role extends string>(
  role: Role,
  roleOptions?: RoleAssignmentOption<Role>[],
) => {
  const matched = roleOptions?.find((item) => item.role === role) ?? null
  return matched?.key ?? `role:${role}`
}
