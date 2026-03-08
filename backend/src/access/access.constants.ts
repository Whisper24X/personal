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

export const BUSINESS_LINE_ROLE_CAPABILITIES: Record<
  BusinessLineMemberRole,
  CapabilityCode[]
> = {
  [BusinessLineMemberRole.owner]: [
    'businessLine.read',
    'businessLine.update',
    'businessLine.delete',
    'businessLine.member.manage',
    'businessLine.project.list.all',
    'businessLine.project.create',
    'businessLine.project.update',
    'businessLine.project.delete',
  ],
  [BusinessLineMemberRole.admin]: [
    'businessLine.read',
    'businessLine.member.manage',
    'businessLine.project.list.all',
    'businessLine.project.create',
    'businessLine.project.update',
    'businessLine.project.delete',
  ],
  [BusinessLineMemberRole.member]: [
    'businessLine.read',
    'businessLine.project.list.joined',
  ],
};

export const PROJECT_ROLE_CAPABILITIES: Record<
  ProjectMemberRole,
  CapabilityCode[]
> = {
  [ProjectMemberRole.owner]: [
    'project.read',
    'project.update',
    'project.delete',
    'project.member.manage',
    'project.task.read',
    'project.task.create',
    'project.task.execute',
    'project.task.cancel',
    'project.kanban.view',
    'project.workflow.view',
    'project.workflow.manage',
    'project.artifact.read',
  ],
  [ProjectMemberRole.maintainer]: [
    'project.read',
    'project.update',
    'project.member.manage',
    'project.task.read',
    'project.task.create',
    'project.task.execute',
    'project.task.cancel',
    'project.kanban.view',
    'project.workflow.view',
    'project.workflow.manage',
    'project.artifact.read',
  ],
  [ProjectMemberRole.developer]: [
    'project.read',
    'project.task.read',
    'project.task.create',
    'project.task.execute',
    'project.kanban.view',
    'project.workflow.view',
    'project.artifact.read',
  ],
  [ProjectMemberRole.viewer]: [
    'project.read',
    'project.task.read',
    'project.kanban.view',
    'project.workflow.view',
    'project.artifact.read',
  ],
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
  'businessLine.member.manage': ['businessLine.read'],
  'businessLine.project.list.all': ['businessLine.read'],
  'businessLine.project.create': ['businessLine.read'],
  'businessLine.project.update': ['businessLine.read'],
  'businessLine.project.delete': ['businessLine.read'],
};

const PROJECT_CAPABILITY_DEPENDENCIES: Record<
  CapabilityCode,
  CapabilityCode[]
> = {
  'project.update': ['project.read'],
  'project.delete': ['project.read'],
  'project.member.manage': ['project.read'],
  'project.task.read': ['project.read'],
  'project.task.create': ['project.read', 'project.task.read'],
  'project.task.execute': ['project.read', 'project.task.read'],
  'project.task.cancel': ['project.read', 'project.task.read'],
  'project.kanban.view': ['project.read'],
  'project.workflow.view': ['project.read'],
  'project.workflow.manage': ['project.read', 'project.workflow.view'],
  'project.artifact.read': ['project.read'],
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
    description: '项目内全部能力',
    capabilities: [...PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.owner]],
  },
  {
    role: ProjectMemberRole.maintainer,
    name: 'maintainer',
    description: '可管理成员、配置和工作流，但不能删项目/授予 owner',
    capabilities: [...PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.maintainer]],
  },
  {
    role: ProjectMemberRole.developer,
    name: 'developer',
    description: '可执行开发任务和查看工作流',
    capabilities: [...PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.developer]],
  },
  {
    role: ProjectMemberRole.viewer,
    name: 'viewer',
    description: '只读访问',
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

export const canManageBusinessLineMembersByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => {
  return normalizeBusinessLineCapabilities(capabilities).includes(
    'businessLine.member.manage',
  );
};

export const isProjectOwnerCapabilities = (
  capabilities: CapabilityCode[],
): boolean => {
  return normalizeProjectCapabilities(capabilities).includes('project.delete');
};

export const canManageProjectMembersByCapabilities = (
  capabilities: CapabilityCode[],
): boolean => {
  return normalizeProjectCapabilities(capabilities).includes(
    'project.member.manage',
  );
};
