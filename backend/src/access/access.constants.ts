import { BusinessLineMemberRole } from '../business-lines/dto/business-line-member-role.enum';
import { ProjectMemberRole } from '../projects/dto/project-member-role.enum';

export type CapabilityCode = string;

export type DefaultScopedRoleTemplate<Role extends string> = {
  role: Role;
  name: string;
  description: string;
  capabilities: CapabilityCode[];
};

export const BUSINESS_LINE_CREATE_CAPABILITY = 'businessLine.create';

const OWNER_GRANULAR_CAPABILITIES: CapabilityCode[] = [
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
];

const ADMIN_GRANULAR_CAPABILITIES: CapabilityCode[] = [
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
];

export const BUSINESS_LINE_ROLE_CAPABILITIES: Record<
  BusinessLineMemberRole,
  CapabilityCode[]
> = {
  [BusinessLineMemberRole.owner]: [...OWNER_GRANULAR_CAPABILITIES],
  [BusinessLineMemberRole.admin]: [...ADMIN_GRANULAR_CAPABILITIES],
  [BusinessLineMemberRole.member]: [
    'businessLine.read',
    'businessLine.project.list.joined',
    'businessLine.skill.read',
    'businessLine.mcp.read',
  ],
};

const PROJECT_VIEWER_CAPABILITIES: CapabilityCode[] = [
  'project.dashboard.read',
  'project.task.read',
  'project.kanban.read',
  'project.knowledge.read',
  'project.workflow.read',
];

const PROJECT_DEVELOPER_CAPABILITIES: CapabilityCode[] = [
  ...PROJECT_VIEWER_CAPABILITIES,
  'project.automation.read',
];

const PROJECT_MAINTAINER_CAPABILITIES: CapabilityCode[] = [
  ...PROJECT_DEVELOPER_CAPABILITIES,
  'project.skill.read',
  'project.mcp.read',
];

const PROJECT_OWNER_CAPABILITIES: CapabilityCode[] = [
  ...PROJECT_MAINTAINER_CAPABILITIES,
  'project.git.read',
];

export const PROJECT_ROLE_CAPABILITIES: Record<
  ProjectMemberRole,
  CapabilityCode[]
> = {
  [ProjectMemberRole.owner]: [...PROJECT_OWNER_CAPABILITIES],
  [ProjectMemberRole.maintainer]: [...PROJECT_MAINTAINER_CAPABILITIES],
  [ProjectMemberRole.developer]: [...PROJECT_DEVELOPER_CAPABILITIES],
  [ProjectMemberRole.viewer]: [...PROJECT_VIEWER_CAPABILITIES],
};

export const ALL_BUSINESS_LINE_CAPABILITIES = Array.from(
  new Set(Object.values(BUSINESS_LINE_ROLE_CAPABILITIES).flat()),
);

export const ALL_PROJECT_CAPABILITIES = Array.from(
  new Set(Object.values(PROJECT_ROLE_CAPABILITIES).flat()),
);

const BUSINESS_LINE_CAPABILITY_DEPENDENCIES: Record<
  CapabilityCode,
  CapabilityCode[]
> = {
  'businessLine.update': ['businessLine.read'],
  'businessLine.delete': ['businessLine.read'],
  'businessLine.project.list.all': ['businessLine.read'],
  'businessLine.project.list.joined': ['businessLine.read'],
  'businessLine.project.create': ['businessLine.read'],
  'businessLine.project.update': ['businessLine.read'],
  'businessLine.project.delete': ['businessLine.read'],
  'businessLine.member.read': ['businessLine.read'],
  'businessLine.member.invite': ['businessLine.read'],
  'businessLine.member.remove': ['businessLine.read'],
  'businessLine.member.updateRole': ['businessLine.read'],
  'businessLine.role.read': ['businessLine.read'],
  'businessLine.role.create': ['businessLine.read'],
  'businessLine.role.update': ['businessLine.read'],
  'businessLine.role.delete': ['businessLine.read'],
  'businessLine.projectRole.read': ['businessLine.read'],
  'businessLine.projectRole.create': ['businessLine.read'],
  'businessLine.projectRole.update': ['businessLine.read'],
  'businessLine.projectRole.delete': ['businessLine.read'],
  'businessLine.agentCli.read': ['businessLine.read'],
  'businessLine.agentCli.create': ['businessLine.read'],
  'businessLine.agentCli.update': ['businessLine.read'],
  'businessLine.agentCli.setDefault': ['businessLine.read'],
  'businessLine.agentCli.delete': ['businessLine.read'],
  'businessLine.workflow.read': ['businessLine.read'],
  'businessLine.workflow.create': ['businessLine.read'],
  'businessLine.workflow.update': ['businessLine.read'],
  'businessLine.workflow.delete': ['businessLine.read'],
  'businessLine.skill.read': ['businessLine.read'],
  'businessLine.skill.upload': ['businessLine.read'],
  'businessLine.skill.update': ['businessLine.read'],
  'businessLine.skill.delete': ['businessLine.read'],
  'businessLine.mcp.read': ['businessLine.read'],
  'businessLine.mcp.manage': ['businessLine.read'],
};

const PROJECT_CAPABILITY_DEPENDENCIES: Record<
  CapabilityCode,
  CapabilityCode[]
> = {
  'project.dashboard.read': [],
  'project.task.read': ['project.dashboard.read'],
  'project.kanban.read': ['project.dashboard.read'],
  'project.automation.read': ['project.dashboard.read'],
  'project.knowledge.read': ['project.dashboard.read'],
  'project.workflow.read': ['project.dashboard.read'],
  'project.skill.read': ['project.dashboard.read'],
  'project.mcp.read': ['project.dashboard.read'],
  'project.git.read': ['project.dashboard.read'],
  'project.read': ['project.dashboard.read'],
  'project.kanban.view': ['project.kanban.read'],
  'project.workflow.view': ['project.workflow.read'],
  'project.automation.view': ['project.automation.read'],
};

const expandCapabilities = (
  capabilities: CapabilityCode[],
  dependencyMap: Record<CapabilityCode, CapabilityCode[]>,
): CapabilityCode[] => {
  const resolved = new Set(capabilities);
  const queue = [...capabilities];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    for (const dependency of dependencyMap[current] ?? []) {
      if (resolved.has(dependency)) {
        continue;
      }

      resolved.add(dependency);
      queue.push(dependency);
    }
  }

  return Array.from(resolved).sort();
};

const normalizeCapabilitySignature = (capabilities: CapabilityCode[]) => {
  return JSON.stringify(Array.from(new Set(capabilities)).sort());
};

const hasSameCapabilitySet = (
  left: CapabilityCode[],
  right: CapabilityCode[],
): boolean => {
  return (
    normalizeCapabilitySignature(left) === normalizeCapabilitySignature(right)
  );
};

export const normalizeBusinessLineCapabilities = (
  capabilities: CapabilityCode[],
): CapabilityCode[] => {
  return expandCapabilities(
    capabilities,
    BUSINESS_LINE_CAPABILITY_DEPENDENCIES,
  );
};

export const normalizeProjectCapabilities = (
  capabilities: CapabilityCode[],
): CapabilityCode[] => {
  return expandCapabilities(capabilities, PROJECT_CAPABILITY_DEPENDENCIES);
};

export const BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES: Array<
  DefaultScopedRoleTemplate<BusinessLineMemberRole>
> = [
  {
    role: BusinessLineMemberRole.owner,
    name: 'owner',
    description: '拥有业务线全部能力',
    capabilities: [
      ...BUSINESS_LINE_ROLE_CAPABILITIES[BusinessLineMemberRole.owner],
    ],
  },
  {
    role: BusinessLineMemberRole.admin,
    name: 'admin',
    description: '可管理成员和项目条目，但不是 owner',
    capabilities: [
      ...BUSINESS_LINE_ROLE_CAPABILITIES[BusinessLineMemberRole.admin],
    ],
  },
  {
    role: BusinessLineMemberRole.member,
    name: 'member',
    description: '仅查看业务线和自己加入的项目',
    capabilities: [
      ...BUSINESS_LINE_ROLE_CAPABILITIES[BusinessLineMemberRole.member],
    ],
  },
];

export const PROJECT_DEFAULT_ROLE_TEMPLATES: Array<
  DefaultScopedRoleTemplate<ProjectMemberRole>
> = [
  {
    role: ProjectMemberRole.owner,
    name: 'owner',
    description: '全部 9 个管理项可用',
    capabilities: [...PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.owner]],
  },
  {
    role: ProjectMemberRole.maintainer,
    name: 'maintainer',
    description: '仪表盘、任务、看板、知识库、工作流、自动化、Skills、MCP',
    capabilities: [...PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.maintainer]],
  },
  {
    role: ProjectMemberRole.developer,
    name: 'developer',
    description: '仪表盘、任务、看板、知识库、工作流、自动化',
    capabilities: [...PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.developer]],
  },
  {
    role: ProjectMemberRole.viewer,
    name: 'viewer',
    description: '仪表盘、任务、看板、知识库、工作流',
    capabilities: [...PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.viewer]],
  },
];

export const isDefaultTemplateRoleName = (
  name: string | null | undefined,
  templateName: string,
): boolean => {
  const normalizedName = name?.trim().toLowerCase();
  if (!normalizedName) {
    return false;
  }

  return (
    normalizedName === templateName ||
    normalizedName === `${templateName}-default` ||
    normalizedName.startsWith(`${templateName}-default-`)
  );
};

export const matchesBusinessLineDefaultRoleTemplate = (
  role: Pick<DefaultScopedRoleTemplate<string>, 'name' | 'capabilities'>,
  templateRole?: BusinessLineMemberRole,
): boolean => {
  const templates = templateRole
    ? BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES.filter(
        (template) => template.role === templateRole,
      )
    : BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES;

  const normalizedRoleCapabilities = normalizeBusinessLineCapabilities(
    role.capabilities,
  );

  return templates.some((template) => {
    return (
      hasSameCapabilitySet(normalizedRoleCapabilities, template.capabilities) &&
      isDefaultTemplateRoleName(role.name, template.name)
    );
  });
};

export const matchesProjectDefaultRoleTemplate = (
  role: Pick<DefaultScopedRoleTemplate<string>, 'name' | 'capabilities'>,
  templateRole?: ProjectMemberRole,
): boolean => {
  const templates = templateRole
    ? PROJECT_DEFAULT_ROLE_TEMPLATES.filter(
        (template) => template.role === templateRole,
      )
    : PROJECT_DEFAULT_ROLE_TEMPLATES;

  const normalizedRoleCapabilities = normalizeProjectCapabilities(
    role.capabilities,
  );

  return templates.some((template) => {
    return (
      hasSameCapabilitySet(normalizedRoleCapabilities, template.capabilities) &&
      isDefaultTemplateRoleName(role.name, template.name)
    );
  });
};

export const hasBusinessLineTemplateCapabilities = (
  capabilities: CapabilityCode[],
  role: BusinessLineMemberRole,
): boolean => {
  const template = BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES.find(
    (item) => item.role === role,
  );

  if (!template) {
    return false;
  }

  return hasSameCapabilitySet(
    normalizeBusinessLineCapabilities(capabilities),
    template.capabilities,
  );
};

export const hasProjectTemplateCapabilities = (
  capabilities: CapabilityCode[],
  role: ProjectMemberRole,
): boolean => {
  const template = PROJECT_DEFAULT_ROLE_TEMPLATES.find(
    (item) => item.role === role,
  );

  if (!template) {
    return false;
  }

  return hasSameCapabilitySet(
    normalizeProjectCapabilities(capabilities),
    template.capabilities,
  );
};

export const getBusinessLineDefaultRoleTemplate = (
  role: BusinessLineMemberRole,
): DefaultScopedRoleTemplate<BusinessLineMemberRole> => {
  return (
    BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES.find(
      (template) => template.role === role,
    ) ?? BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES[0]
  );
};

export const getProjectDefaultRoleTemplate = (
  role: ProjectMemberRole,
): DefaultScopedRoleTemplate<ProjectMemberRole> => {
  return (
    PROJECT_DEFAULT_ROLE_TEMPLATES.find((template) => template.role === role) ??
    PROJECT_DEFAULT_ROLE_TEMPLATES[0]
  );
};

export const isBusinessLineOwnerCapabilities = (
  capabilities: CapabilityCode[],
): boolean => {
  return normalizeBusinessLineCapabilities(capabilities).includes(
    'businessLine.delete',
  );
};

const hasCapability = (
  capabilities: CapabilityCode[],
  code: CapabilityCode,
): boolean => normalizeBusinessLineCapabilities(capabilities).includes(code);

export const canReadMembersByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.member.read');

export const canInviteMembersByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.member.invite');

export const canRemoveMembersByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.member.remove');

export const canUpdateMemberRoleByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.member.updateRole');

export const canReadBusinessLineRoleByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.role.read');

export const canCreateBusinessLineRoleByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.role.create');

export const canUpdateBusinessLineRoleByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.role.update');

export const canDeleteBusinessLineRoleByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.role.delete');

export const canReadProjectRoleByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.projectRole.read');

export const canCreateProjectRoleByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.projectRole.create');

export const canUpdateProjectRoleByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.projectRole.update');

export const canDeleteProjectRoleByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.projectRole.delete');

export const canReadAgentCliByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.agentCli.read');

export const canCreateAgentCliByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.agentCli.create');

export const canUpdateAgentCliByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.agentCli.update');

export const canSetDefaultAgentCliByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.agentCli.setDefault');

export const canDeleteAgentCliByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.agentCli.delete');

export const canReadWorkflowByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.workflow.read');

export const canCreateWorkflowByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.workflow.create');

export const canUpdateWorkflowByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.workflow.update');

export const canDeleteWorkflowByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.workflow.delete');

export const canManageBusinessLineWorkflowByCapabilities = (
  capabilities: CapabilityCode[],
): boolean =>
  canCreateWorkflowByCapabilities(capabilities) ||
  canUpdateWorkflowByCapabilities(capabilities) ||
  canDeleteWorkflowByCapabilities(capabilities);

export const canReadSkillsByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.skill.read');

export const canUploadSkillsByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.skill.upload');

export const canUpdateSkillsByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.skill.update');

export const canDeleteSkillsByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.skill.delete');

export const canReadMcpByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.mcp.read');

export const canManageMcpByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => hasCapability(capabilities, 'businessLine.mcp.manage');

export const canViewProjectRoleConfigByCapabilities = (
  capabilities: CapabilityCode[],
): boolean =>
  canReadProjectRoleByCapabilities(capabilities) ||
  canCreateProjectRoleByCapabilities(capabilities) ||
  canUpdateProjectRoleByCapabilities(capabilities) ||
  canDeleteProjectRoleByCapabilities(capabilities);

export const canManageProjectRoleConfigByCapabilities = (
  capabilities: CapabilityCode[],
): boolean =>
  canCreateProjectRoleByCapabilities(capabilities) ||
  canUpdateProjectRoleByCapabilities(capabilities) ||
  canDeleteProjectRoleByCapabilities(capabilities);

export const isProjectOwnerRoleName = (
  roleName: string | null | undefined,
): boolean => {
  return isDefaultTemplateRoleName(roleName, 'owner');
};
