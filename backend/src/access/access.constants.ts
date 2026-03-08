import { BusinessLineMemberRole } from '../business-lines/dto/business-line-member-role.enum';
import { ProjectMemberRole } from '../projects/dto/project-member-role.enum';

export type CapabilityCode = string;

export type DefaultScopedRoleTemplate<Role extends string> = {
  code: Role;
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

export const BUSINESS_LINE_DEFAULT_ROLE_CODES = Object.values(
  BusinessLineMemberRole,
) as BusinessLineMemberRole[];

export const PROJECT_DEFAULT_ROLE_CODES = Object.values(
  ProjectMemberRole,
) as ProjectMemberRole[];

const businessLineDefaultRoleCodeSet = new Set(
  BUSINESS_LINE_DEFAULT_ROLE_CODES,
);
const projectDefaultRoleCodeSet = new Set(PROJECT_DEFAULT_ROLE_CODES);

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
    code: BusinessLineMemberRole.owner,
    name: 'owner',
    description: '拥有业务线全部能力',
    capabilities: [
      ...BUSINESS_LINE_ROLE_CAPABILITIES[BusinessLineMemberRole.owner],
    ],
  },
  {
    code: BusinessLineMemberRole.admin,
    name: 'admin',
    description: '可管理成员和项目条目，但不是 owner',
    capabilities: [
      ...BUSINESS_LINE_ROLE_CAPABILITIES[BusinessLineMemberRole.admin],
    ],
  },
  {
    code: BusinessLineMemberRole.member,
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
    code: ProjectMemberRole.owner,
    name: 'owner',
    description: '项目内全部能力',
    capabilities: [...PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.owner]],
  },
  {
    code: ProjectMemberRole.maintainer,
    name: 'maintainer',
    description: '可管理成员、配置和工作流，但不能删项目/授予 owner',
    capabilities: [...PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.maintainer]],
  },
  {
    code: ProjectMemberRole.developer,
    name: 'developer',
    description: '可执行开发任务和查看工作流',
    capabilities: [...PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.developer]],
  },
  {
    code: ProjectMemberRole.viewer,
    name: 'viewer',
    description: '只读访问',
    capabilities: [...PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.viewer]],
  },
];

export const isBusinessLineDefaultRoleCode = (
  code: string | null | undefined,
): code is BusinessLineMemberRole => {
  return (
    Boolean(code) &&
    businessLineDefaultRoleCodeSet.has(code as BusinessLineMemberRole)
  );
};

export const isProjectDefaultRoleCode = (
  code: string | null | undefined,
): code is ProjectMemberRole => {
  return (
    Boolean(code) && projectDefaultRoleCodeSet.has(code as ProjectMemberRole)
  );
};

export const getBusinessLineRoleCapabilities = (
  roleCode: string | null | undefined,
): CapabilityCode[] => {
  if (!isBusinessLineDefaultRoleCode(roleCode)) {
    return [];
  }

  return BUSINESS_LINE_ROLE_CAPABILITIES[roleCode] ?? [];
};

export const getProjectRoleCapabilities = (
  roleCode: string | null | undefined,
): CapabilityCode[] => {
  if (!isProjectDefaultRoleCode(roleCode)) {
    return [];
  }

  return PROJECT_ROLE_CAPABILITIES[roleCode] ?? [];
};

export const getBusinessLineDefaultRoleTemplate = (
  code: BusinessLineMemberRole,
): DefaultScopedRoleTemplate<BusinessLineMemberRole> => {
  return (
    BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES.find(
      (template) => template.code === code,
    ) ?? BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES[0]
  );
};

export const getProjectDefaultRoleTemplate = (
  code: ProjectMemberRole,
): DefaultScopedRoleTemplate<ProjectMemberRole> => {
  return (
    PROJECT_DEFAULT_ROLE_TEMPLATES.find((template) => template.code === code) ??
    PROJECT_DEFAULT_ROLE_TEMPLATES[0]
  );
};
