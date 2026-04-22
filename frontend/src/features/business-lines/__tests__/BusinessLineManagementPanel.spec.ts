import { config, flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import BusinessLineManagementPanel from '@features/business-lines/BusinessLineManagementPanel.vue'
import AgentToolConfigModal from '@features/business-lines/modals/AgentToolConfigModal.vue'
import McpJsonImportModal from '@features/business-lines/modals/McpJsonImportModal.vue'

const {
  authApi,
  businessLinesApi,
  projectsApi,
  usersApi,
  workflowApi,
  fetchAllPages,
  routerPush,
  success,
  error,
} = vi.hoisted(() => ({
  authApi: {
    access: vi.fn(),
  },
  businessLinesApi: {
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateDefaultAgentCliTool: vi.fn(),
    remove: vi.fn(),
    listCustomRoles: vi.fn(),
    listProjectCustomRoles: vi.fn(),
    listMembers: vi.fn(),
    addMember: vi.fn(),
    createInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    getMemberProjectRoles: vi.fn(),
    updateMember: vi.fn(),
    removeMember: vi.fn(),
    listAgentToolConfigs: vi.fn(),
    listLocalSkills: vi.fn(),
    uploadLocalSkill: vi.fn(),
    listLocalMcps: vi.fn(),
    importLocalMcps: vi.fn(),
    getLocalMcpConfig: vi.fn(),
    createAgentToolConfig: vi.fn(),
    updateAgentToolConfig: vi.fn(),
    removeAgentToolConfig: vi.fn(),
  },
  projectsApi: {
    list: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listMembers: vi.fn(),
    addMember: vi.fn(),
    updateMember: vi.fn(),
    removeMember: vi.fn(),
  },
  usersApi: {
    list: vi.fn(),
  },
  workflowApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  fetchAllPages: vi.fn(),
  routerPush: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  authApi,
}))

vi.mock('@/api/business-lines', () => ({
  businessLinesApi,
}))

vi.mock('@/api/projects', () => ({
  projectsApi,
}))

vi.mock('@/api/users', () => ({
  usersApi,
}))

vi.mock('@/api/workflow', () => ({
  workflowApi,
}))

vi.mock('@app/composables/useMessage', () => ({
  useMessage: () => ({
    success,
    error,
  }),
}))

vi.mock('@shared/utils/pagination', () => ({
  fetchAllPages,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}))

config.global.stubs = {
  ...config.global.stubs,
  RouterLink: RouterLinkStub,
}

const selectOption = async (
  wrapper: ReturnType<typeof mount>,
  ariaLabel: string,
  optionLabel: string,
) => {
  await wrapper.find(`button[aria-label="${ariaLabel}"]`).trigger('click')
  await flushPromises()

  const bodyOption = Array.from(document.body.querySelectorAll('button[role="option"]')).find(
    (button) => button.textContent?.includes(optionLabel),
  ) as HTMLButtonElement | undefined

  if (bodyOption) {
    bodyOption.click()
    await flushPromises()
    return
  }

  const fallbackOption = wrapper
    .findAll('button')
    .find((button) => button.attributes('role') === 'option' && button.text().includes(optionLabel))

  if (!fallbackOption) {
    throw new Error(`Option ${optionLabel} not found`)
  }

  await fallbackOption.trigger('click')
  await flushPromises()
}

const buildProps = (canCreateBusinessLine = true) => ({
  canCreateBusinessLine,
  activeBusinessLineId: 'line-1',
  selectedProjectId: '',
  lines: [
    {
      id: 'line-1',
      name: 'Retail',
      description: 'Retail team',
      owner: '-',
      projectCount: 1,
    },
  ],
  projects: [],
})

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())

  authApi.access.mockResolvedValue({
    user: {
      id: 'user-1',
      username: 'tester',
      nickname: 'Tester',
      avatar: null,
    },
    currentContext: {
      businessLineId: 'line-1',
      businessRole: 'owner',
      projectRole: null,
    },
    capabilities: [
      'businessLine.read',
      'businessLine.update',
      'businessLine.role.read',
      'businessLine.role.create',
      'businessLine.role.update',
      'businessLine.role.delete',
      'businessLine.projectRole.read',
      'businessLine.projectRole.create',
      'businessLine.projectRole.update',
      'businessLine.projectRole.delete',
      'businessLine.member.read',
      'businessLine.member.invite',
      'businessLine.member.remove',
      'businessLine.member.updateRole',
      'businessLine.project.list.all',
      'businessLine.project.create',
      'businessLine.project.update',
      'businessLine.project.delete',
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
    visibility: {
      visibleBusinessLineIds: ['line-1'],
      visibleProjectIds: ['project-1'],
    },
  })

  businessLinesApi.detail.mockResolvedValue({
    id: 'line-1',
    name: 'Retail',
    description: 'Retail team',
    defaultAgentCliToolId: null,
  })

  businessLinesApi.listCustomRoles.mockResolvedValue([
    {
      id: 'line-role-1',
      businessLineId: 'line-1',
      name: '成员',
      description: '默认成员角色',
      capabilities: ['businessLine.read'],
      createdAt: '2026-03-08T00:00:00.000Z',
      updatedAt: '2026-03-08T00:00:00.000Z',
    },
  ])
  businessLinesApi.listProjectCustomRoles.mockResolvedValue([
    {
      id: 'project-role-1',
      businessLineId: 'line-1',
      name: '开发者',
      description: '项目默认开发角色',
      capabilities: ['project.dashboard.read'],
      createdAt: '2026-03-08T00:00:00.000Z',
      updatedAt: '2026-03-08T00:00:00.000Z',
    },
  ])

  businessLinesApi.listMembers.mockResolvedValue([])
  businessLinesApi.getMemberProjectRoles.mockResolvedValue({
    projectRoles: {
      'project-1': 'project-role-1',
    },
  })
  businessLinesApi.listAgentToolConfigs.mockResolvedValue([])
  businessLinesApi.listLocalSkills.mockResolvedValue([])
  businessLinesApi.listLocalMcps.mockResolvedValue([])
  businessLinesApi.importLocalMcps.mockResolvedValue({
    importedCount: 1,
    overwrittenCount: 0,
  })
  businessLinesApi.getLocalMcpConfig.mockResolvedValue({
    name: 'filesystem',
    sourcePath: '/Users/fuzhifei/.ainative/data/line-1/mcp/mcp.json',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    },
  })
  workflowApi.list.mockResolvedValue({
    data: [],
    hasNextPage: false,
  })

  projectsApi.list.mockResolvedValue({
    data: [
      {
        id: 'project-1',
        businessLineId: 'line-1',
        name: 'Guard Backend',
        description: 'Main service',
        gitUrl: 'git@gitlab.example.com:group/guard-backend.git',
        defaultBranch: 'main',
      },
    ],
    hasNextPage: false,
  })

  projectsApi.detail.mockResolvedValue({
    id: 'project-1',
    businessLineId: 'line-1',
    name: 'Guard Backend',
    description: 'Main service',
    gitUrl: 'git@gitlab.example.com:group/guard-backend.git',
    defaultBranch: 'main',
    configJson: {
      agentAdapter: 'codex',
      agentRunner: {
        timeoutSeconds: 600,
      },
    },
  })

  projectsApi.create.mockResolvedValue({
    id: 'project-2',
    businessLineId: 'line-1',
    name: 'Guard Console',
    description: 'Console',
    gitUrl: 'git@gitlab.example.com:group/guard-console.git',
    defaultBranch: 'main',
  })
  projectsApi.update.mockResolvedValue({
    id: 'project-1',
    businessLineId: 'line-1',
    name: 'Guard Backend',
    description: 'Main service',
    gitUrl: 'git@gitlab.example.com:group/guard-backend.git',
    defaultBranch: 'main',
    configJson: null,
  })

  usersApi.list.mockResolvedValue({
    data: [],
    hasNextPage: false,
  })

  fetchAllPages.mockImplementation(
    async (fetchPage: (page: number, limit: number) => Promise<{ data: unknown[] }>) => {
      const response = await fetchPage(1, 50)
      return response.data
    },
  )
})

describe('BusinessLineManagementPanel', () => {
  it('shows a close icon in page mode and returns to home', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    const backButton = wrapper.find('button[aria-label="返回主页面"]')

    expect(backButton.exists()).toBe(true)
    await backButton.trigger('click')

    expect(routerPush).toHaveBeenCalledWith({ name: 'home' })
  })

  it('renders left-right layout with all business line tabs by default', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('业务线')
    expect(wrapper.text()).toContain('项目')
    expect(wrapper.text()).toContain('成员')
    expect(wrapper.text()).toContain('权限')
    expect(wrapper.text()).toContain('Agent CLI')
    expect(wrapper.text()).toContain('工作流')
    expect(wrapper.text()).toContain('Skills')
    expect(wrapper.text()).toContain('MCP')
    expect(wrapper.text()).toContain('设置')
    expect(wrapper.text()).toContain('创建业务线')

    const agentCliTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Agent CLI')

    expect(agentCliTab).toBeDefined()
    await agentCliTab!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Claude Code')
    expect(wrapper.text()).toContain('Codex')
    expect(wrapper.text()).toContain('Gemini CLI')
    expect(wrapper.text()).toContain('Cursor Agent')
    expect(wrapper.text()).toContain('Opencode')
  })

  it('refreshes project tab when switching back to a cached empty business line', async () => {
    projectsApi.list.mockImplementation(async ({ businessLineId }: { businessLineId: string }) => ({
      data: businessLineId === 'line-1'
        ? [
            {
              id: 'project-1',
              businessLineId: 'line-1',
              name: 'Guard Backend',
              description: 'Main service',
              gitUrl: 'git@gitlab.example.com:group/guard-backend.git',
              defaultBranch: 'main',
            },
          ]
        : [],
      hasNextPage: false,
    }))

    businessLinesApi.detail.mockImplementation(async (businessLineId: string) => ({
      id: businessLineId,
      name: businessLineId === 'line-1' ? 'Retail' : 'Empty Line',
      description: businessLineId === 'line-1' ? 'Retail team' : 'No projects here',
      defaultAgentCliToolId: null,
    }))

    authApi.access.mockImplementation(async ({ businessLineId }: { businessLineId?: string } = {}) => ({
      user: {
        id: 'user-1',
        username: 'tester',
        nickname: 'Tester',
        avatar: null,
      },
      currentContext: {
        businessLineId: businessLineId ?? 'line-1',
        businessRole: 'owner',
        projectRole: null,
      },
      capabilities: [
        'businessLine.read',
        'businessLine.project.list.all',
      ],
      visibility: {
        visibleBusinessLineIds: ['line-1', 'line-2'],
        visibleProjectIds: ['project-1'],
      },
    }))

    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: {
        canCreateBusinessLine: true,
        activeBusinessLineId: 'line-1',
        selectedProjectId: '',
        lines: [
          {
            id: 'line-1',
            name: 'Retail',
            description: 'Retail team',
            owner: '-',
            projectCount: 1,
          },
          {
            id: 'line-2',
            name: 'Empty Line',
            description: 'No projects here',
            owner: '-',
            projectCount: 0,
          },
        ],
        projects: [],
      },
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('Guard Backend')

    const retailButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Retail') && button.text().includes('项目 1'))
    const emptyLineButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Empty Line') && button.text().includes('项目 0'))

    expect(retailButton).toBeDefined()
    expect(emptyLineButton).toBeDefined()

    await emptyLineButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Guard Backend')
    expect(wrapper.text()).toContain('当前业务线暂无项目。')

    await retailButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Guard Backend')

    await emptyLineButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Guard Backend')
    expect(wrapper.text()).toContain('当前业务线暂无项目。')
  })

  it('hides create business line button when user has no permission', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(false),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    const createLineButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '创建业务线')

    expect(createLineButton).toBeUndefined()
    expect(wrapper.text()).not.toContain('创建业务线')
  })

  it('shows action-only project tab without loading project list when user cannot view it', async () => {
    authApi.access.mockResolvedValueOnce({
      user: {
        id: 'user-1',
        username: 'tester',
        nickname: 'Tester',
        avatar: null,
      },
      currentContext: {
        businessLineId: 'line-1',
        businessRole: 'owner',
        projectRole: null,
      },
      capabilities: ['businessLine.project.create'],
      visibility: {
        visibleBusinessLineIds: ['line-1'],
        visibleProjectIds: ['project-1'],
      },
    })

    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('项目')
    expect(wrapper.text()).not.toContain('成员')
    expect(wrapper.text()).toContain('暂无查看项目列表权限')
    expect(wrapper.text()).toContain('新建项目')
    expect(projectsApi.list).not.toHaveBeenCalled()
  })

  it('renders permission tab with nested role tabs', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })
    await flushPromises()

    const permissionTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '权限')

    expect(permissionTab).toBeDefined()
    await permissionTab!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('业务线角色')
    expect(wrapper.text()).toContain('项目角色')
    expect(wrapper.text()).not.toContain('项目角色库')

    const projectRoleTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '项目角色')

    expect(projectRoleTab).toBeDefined()
    await projectRoleTab!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('角色列表（1）')
    expect(wrapper.text()).toContain('开发者')
  })

  it('opens create project modal and submits project payload', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })
    await flushPromises()

    const newProjectButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '新建项目')

    expect(newProjectButton).toBeDefined()
    await newProjectButton!.trigger('click')
    await flushPromises()

    const projectFormModal = wrapper.findComponent({ name: 'ProjectFormModal' })
    projectFormModal.vm.$emit('submit', {
      name: 'Guard Console',
      description: 'Console app',
      gitUrl: 'git@gitlab.example.com:group/guard-console.git',
      defaultBranch: 'main',
    })
    await flushPromises()

    expect(projectsApi.create).toHaveBeenCalledWith({
      businessLineId: 'line-1',
      name: 'Guard Console',
      description: 'Console app',
      gitUrl: 'git@gitlab.example.com:group/guard-console.git',
      defaultBranch: 'main',
    })
    expect(wrapper.emitted('request-refresh')).toBeTruthy()
  })

  it('shows backend error when updating project default branch fails', async () => {
    projectsApi.update.mockRejectedValueOnce(new Error('无法切换到 release 分支'))

    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })
    await flushPromises()

    const editProjectButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '编辑基础信息')

    expect(editProjectButton).toBeDefined()
    await editProjectButton!.trigger('click')
    await flushPromises()

    const projectFormModal = wrapper.findComponent({ name: 'ProjectFormModal' })
    projectFormModal.vm.$emit('submit', {
      name: 'Guard Backend',
      description: 'Main service',
      gitUrl: 'git@gitlab.example.com:group/guard-backend.git',
      defaultBranch: 'release',
    })
    await flushPromises()

    expect(projectsApi.update).toHaveBeenCalledWith('project-1', {
      name: 'Guard Backend',
      description: 'Main service',
      gitUrl: 'git@gitlab.example.com:group/guard-backend.git',
      defaultBranch: 'release',
    })
    expect(error).toHaveBeenCalledWith('无法切换到 release 分支')
    expect(wrapper.findComponent({ name: 'ProjectFormModal' }).props('open')).toBe(true)
  })

  it('opens runtime settings modal from the projects tab and saves configJson overrides', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })
    await flushPromises()

    const runtimeSettingsButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '容器设置')

    expect(runtimeSettingsButton).toBeDefined()
    await runtimeSettingsButton!.trigger('click')
    await flushPromises()

    const runtimeSettingsModal = wrapper.findComponent({
      name: 'ProjectRuntimeSettingsModal',
    })
    expect(runtimeSettingsModal.exists()).toBe(true)

    runtimeSettingsModal.vm.$emit('submit', {
      containerRuntime: {
        env: {
          NODE_ENV: 'development',
        },
      },
    })
    await flushPromises()

    expect(projectsApi.update).toHaveBeenCalledWith('project-1', {
      name: 'Guard Backend',
      description: 'Main service',
      gitUrl: 'git@gitlab.example.com:group/guard-backend.git',
      defaultBranch: 'main',
      configJson: {
        containerRuntime: {
          env: {
            NODE_ENV: 'development',
          },
        },
      },
    })
    expect(wrapper.findComponent({ name: 'ProjectRuntimeSettingsModal' }).props('open')).toBe(false)
    expect(wrapper.emitted('request-refresh')).toBeTruthy()
  })

  it('shows clearer project action labels and runtime summary on project cards', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('容器设置：当前使用默认容器配置')
    expect(wrapper.text()).toContain('容器设置')
    expect(wrapper.text()).toContain('编辑基础信息')
  })

  it('emits select-project when choosing a project as current', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })
    await flushPromises()

    const projectCard = wrapper.find('[data-project-id="project-1"]')
    expect(projectCard.exists()).toBe(true)
    await projectCard.trigger('click')

    expect(wrapper.emitted('select-project')).toEqual([['project-1']])
  })

  it('opens workflow edit modal and updates template', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    workflowApi.list.mockResolvedValueOnce({
      data: [
        {
          id: 'workflow-1',
          name: '业务线默认流',
          description: '默认模板',
          scope: 'business_line',
          businessLineId: 'line-1',
          isActive: true,
          nodesJson: [
            {
              nodeOrder: 1,
              name: 'step-1',
              type: 'agent',
              requiresApproval: false,
              input: {
                prompt: '初始提示词',
                agentCliId: 'codex',
                agentCliConfigId: 'cfg-1',
              },
            },
          ],
        },
      ],
      hasNextPage: false,
    })
    businessLinesApi.listAgentToolConfigs.mockResolvedValue([
      {
        id: 'cfg-1',
        toolId: 'codex',
        name: '默认 Codex',
        description: '',
        isDefault: true,
        configJson: {},
      },
    ])

    await flushPromises()

    const workflowTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '工作流')
    expect(workflowTab).toBeDefined()
    await workflowTab!.trigger('click')
    await flushPromises()

    const editButton = wrapper.find('[data-testid="workflow-edit-workflow-1"]')
    expect(editButton.exists()).toBe(true)
    await editButton.trigger('click')
    await flushPromises()

    const nameInput = wrapper.find('input[placeholder="例如：业务线默认代码修复流"]')
    expect(nameInput.exists()).toBe(true)
    await nameInput.setValue('业务线默认流-更新')

    const workflowForm = wrapper.find(
      '[aria-labelledby="business-line-workflow-create-modal-title"] form',
    )
    expect(workflowForm.exists()).toBe(true)
    await workflowForm.trigger('submit')
    await flushPromises()

    expect(workflowApi.update).toHaveBeenCalledWith('workflow-1', {
      name: '业务线默认流-更新',
      description: '默认模板',
      nodes: [
        {
          nodeOrder: 1,
          name: 'step-1',
          type: 'agent',
          maxLoops: 1,
          requiresApproval: false,
          requiresArtifact: false,
          input: {
            prompt: '初始提示词',
            agentCliId: 'codex',
            agentCliConfigId: 'cfg-1',
          },
        },
      ],
    })
    expect(workflowApi.create).not.toHaveBeenCalled()
  })

  it('creates workflow template with approval enabled by default', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    businessLinesApi.listAgentToolConfigs.mockResolvedValue([
      {
        id: 'cfg-1',
        toolId: 'codex',
        name: '默认 Codex',
        description: '',
        isDefault: true,
        configJson: {},
      },
    ])

    await flushPromises()

    const workflowTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '工作流')
    expect(workflowTab).toBeDefined()
    await workflowTab!.trigger('click')
    await flushPromises()

    const createButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '创建模板')
    expect(createButton).toBeDefined()
    await createButton!.trigger('click')
    await flushPromises()

    const approvalCheckbox = wrapper
      .findAll('label')
      .find((label) => label.text().includes('审批'))
      ?.find('input[type="checkbox"]')
    expect(approvalCheckbox?.exists()).toBe(true)
    expect((approvalCheckbox!.element as HTMLInputElement).checked).toBe(true)

    const nameInput = wrapper.find('input[placeholder="例如：业务线默认代码修复流"]')
    expect(nameInput.exists()).toBe(true)
    await nameInput.setValue('业务线默认流')

    const workflowForm = wrapper.find(
      '[aria-labelledby="business-line-workflow-create-modal-title"] form',
    )
    expect(workflowForm.exists()).toBe(true)
    await workflowForm.trigger('submit')
    await flushPromises()

    expect(workflowApi.create).toHaveBeenCalledWith({
      name: '业务线默认流',
      description: undefined,
      scope: 'business_line',
      businessLineId: 'line-1',
      isActive: true,
      nodes: [
        {
          nodeOrder: 1,
          name: 'step-1',
          type: 'agent',
          maxLoops: 1,
          requiresApproval: true,
          requiresArtifact: false,
          input: {
            agentCliId: 'codex',
            agentCliConfigId: 'cfg-1',
          },
        },
      ],
    })
  })

  it('submits loop config when enabled for a node', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    businessLinesApi.listAgentToolConfigs.mockResolvedValue([
      {
        id: 'cfg-1',
        toolId: 'codex',
        name: '默认 Codex',
        description: '',
        isDefault: true,
        configJson: {},
      },
    ])

    await flushPromises()

    const workflowTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '工作流')
    expect(workflowTab).toBeDefined()
    await workflowTab!.trigger('click')
    await flushPromises()

    const createButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '创建模板')
    expect(createButton).toBeDefined()
    await createButton!.trigger('click')
    await flushPromises()

    const loopToggle = wrapper
      .findAll('label')
      .find((label) => label.text().includes('循环'))
      ?.find('input[type="checkbox"]')
    expect(loopToggle?.exists()).toBe(true)
    await loopToggle!.setValue(true)

    const markerFileNameInput = wrapper.find(
      'input[placeholder="例如：taskResult（会读取 docs/code/taskResult.md）"]',
    )
    expect(markerFileNameInput.exists()).toBe(true)
    await markerFileNameInput.setValue('taskResult')

    const maxLoopsInput = wrapper.find('input[type="number"]')
    expect(maxLoopsInput.exists()).toBe(true)
    await maxLoopsInput.setValue('3')

    const nameInput = wrapper.find('input[placeholder="例如：业务线默认代码修复流"]')
    expect(nameInput.exists()).toBe(true)
    await nameInput.setValue('带 marker 的模板')

    const workflowForm = wrapper.find(
      '[aria-labelledby="business-line-workflow-create-modal-title"] form',
    )
    expect(workflowForm.exists()).toBe(true)
    await workflowForm.trigger('submit')
    await flushPromises()

    expect(workflowApi.create).toHaveBeenCalledWith({
      name: '带 marker 的模板',
      description: undefined,
      scope: 'business_line',
      businessLineId: 'line-1',
      isActive: true,
      nodes: [
        {
          nodeOrder: 1,
          name: 'step-1',
          type: 'agent',
          maxLoops: 3,
          requiresApproval: true,
          requiresArtifact: false,
          input: {
            agentCliId: 'codex',
            agentCliConfigId: 'cfg-1',
            loopEnabled: true,
            maxLoops: 3,
            earlyExitMarkerEnabled: true,
            earlyExitMarkerFileName: 'taskResult',
          },
        },
      ],
    })
  })

  it('submits requiresArtifact when artifact checkbox is enabled', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    businessLinesApi.listAgentToolConfigs.mockResolvedValue([
      {
        id: 'cfg-1',
        toolId: 'codex',
        name: '默认 Codex',
        description: '',
        isDefault: true,
        configJson: {},
      },
    ])

    await flushPromises()

    const workflowTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '工作流')
    expect(workflowTab).toBeDefined()
    await workflowTab!.trigger('click')
    await flushPromises()

    const createButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '创建模板')
    expect(createButton).toBeDefined()
    await createButton!.trigger('click')
    await flushPromises()

    const artifactToggle = wrapper
      .findAll('label')
      .find((label) => label.text().includes('产物'))
      ?.find('input[type="checkbox"]')
    expect(artifactToggle?.exists()).toBe(true)
    await artifactToggle!.setValue(true)

    const nameInput = wrapper.find('input[placeholder="例如：业务线默认代码修复流"]')
    expect(nameInput.exists()).toBe(true)
    await nameInput.setValue('带产物门禁的模板')

    const workflowForm = wrapper.find(
      '[aria-labelledby="business-line-workflow-create-modal-title"] form',
    )
    expect(workflowForm.exists()).toBe(true)
    await workflowForm.trigger('submit')
    await flushPromises()

    expect(workflowApi.create).toHaveBeenCalledWith({
      name: '带产物门禁的模板',
      description: undefined,
      scope: 'business_line',
      businessLineId: 'line-1',
      isActive: true,
      nodes: [
        {
          nodeOrder: 1,
          name: 'step-1',
          type: 'agent',
          maxLoops: 1,
          requiresApproval: true,
          requiresArtifact: true,
          input: {
            agentCliId: 'codex',
            agentCliConfigId: 'cfg-1',
          },
        },
      ],
    })
  })

  it('imports local mcps from json payload', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })
    await flushPromises()

    const mcpTab = wrapper.findAll('button').find((button) => button.text().trim() === 'MCP')
    expect(mcpTab).toBeDefined()
    await mcpTab!.trigger('click')
    await flushPromises()

    const importButton = wrapper.findAll('button').find((button) => button.text().trim() === '添加')
    expect(importButton).toBeDefined()
    await importButton!.trigger('click')
    await flushPromises()

    wrapper.findComponent(McpJsonImportModal).vm.$emit('submit', {
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        },
      },
    })
    await flushPromises()

    expect(businessLinesApi.importLocalMcps).toHaveBeenCalledWith('line-1', {
      payload: {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      },
    })
    expect(businessLinesApi.listLocalMcps).toHaveBeenCalledWith('line-1')
  })

  it('loads mcp json preview when clicking mcp item', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    businessLinesApi.listLocalMcps.mockResolvedValueOnce([
      {
        id: 'mcp-1',
        name: 'filesystem',
        version: 'local',
        toolsCount: 0,
        enabled: true,
        metadataJson: {
          sourcePath: '/Users/fuzhifei/.ainative/data/line-1/mcp/mcp.json',
        },
      },
    ])

    await flushPromises()

    const mcpTab = wrapper.findAll('button').find((button) => button.text().trim() === 'MCP')
    expect(mcpTab).toBeDefined()
    await mcpTab!.trigger('click')
    await flushPromises()

    const mcpCard = wrapper.find('[data-mcp-id="mcp-1"]')
    expect(mcpCard.exists()).toBe(true)
    await mcpCard.trigger('click')
    await flushPromises()

    expect(businessLinesApi.getLocalMcpConfig).toHaveBeenCalledWith('line-1', {
      name: 'filesystem',
      sourcePath: '/Users/fuzhifei/.ainative/data/line-1/mcp/mcp.json',
    })
    expect(wrapper.text()).toContain('MCP JSON')
    expect(wrapper.text()).toContain('filesystem')
  })

  it('prefills create agent cli config with default name and default flag when none exist', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    businessLinesApi.listAgentToolConfigs.mockResolvedValueOnce([])

    await flushPromises()

    const agentCliTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Agent CLI')
    expect(agentCliTab).toBeDefined()
    await agentCliTab!.trigger('click')
    await flushPromises()

    const createButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '新建配置')
    expect(createButton).toBeDefined()
    await createButton!.trigger('click')
    await flushPromises()

    const agentToolConfigModal = wrapper.findComponent(AgentToolConfigModal)
    expect(agentToolConfigModal.props('initialName')).toBe('default')
    expect(agentToolConfigModal.props('initialIsDefault')).toBe(true)
  })

  it('keeps create agent cli config blank and non-default when default config already exists', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    businessLinesApi.listAgentToolConfigs.mockResolvedValueOnce([
      {
        id: 'cfg-1',
        businessLineId: 'line-1',
        toolId: 'cursor-agent',
        name: 'Default',
        description: '',
        configJson: {},
        isDefault: true,
        createdAt: '2026-03-08T00:00:00.000Z',
        updatedAt: '2026-03-08T00:00:00.000Z',
      },
    ])

    await flushPromises()

    const agentCliTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Agent CLI')
    expect(agentCliTab).toBeDefined()
    await agentCliTab!.trigger('click')
    await flushPromises()

    const createButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '新建配置')
    expect(createButton).toBeDefined()
    await createButton!.trigger('click')
    await flushPromises()

    const agentToolConfigModal = wrapper.findComponent(AgentToolConfigModal)
    expect(agentToolConfigModal.props('initialName')).toBe('')
    expect(agentToolConfigModal.props('initialIsDefault')).toBe(false)
  })

  it('saves the business line default agent cli tool from the agent cli tab', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    businessLinesApi.listAgentToolConfigs.mockResolvedValueOnce([
      {
        id: 'cfg-cursor',
        businessLineId: 'line-1',
        toolId: 'cursor-agent',
        name: 'Cursor Default',
        description: '',
        configJson: {},
        isDefault: true,
        createdAt: '2026-03-08T00:00:00.000Z',
        updatedAt: '2026-03-08T00:00:00.000Z',
      },
      {
        id: 'cfg-codex',
        businessLineId: 'line-1',
        toolId: 'codex',
        name: 'Codex Default',
        description: '',
        configJson: {},
        isDefault: true,
        createdAt: '2026-03-08T00:00:00.000Z',
        updatedAt: '2026-03-08T00:00:00.000Z',
      },
    ])
    businessLinesApi.updateDefaultAgentCliTool.mockResolvedValue({
      id: 'line-1',
      name: 'Retail',
      description: 'Retail team',
      defaultAgentCliToolId: 'codex',
    })

    await flushPromises()

    const agentCliTab = wrapper.findAll('button').find((button) => button.text().trim() === 'Agent CLI')
    expect(agentCliTab).toBeDefined()
    await agentCliTab!.trigger('click')
    await flushPromises()

    await selectOption(wrapper, '默认 Agent CLI', 'Codex')

    const saveButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '保存')
    expect(saveButton).toBeDefined()
    await saveButton!.trigger('click')
    await flushPromises()

    expect(businessLinesApi.updateDefaultAgentCliTool).toHaveBeenCalledWith('line-1', {
      defaultAgentCliToolId: 'codex',
    })
    expect(success).toHaveBeenCalledWith('业务线默认 Agent CLI 已更新')
  })

  it('clears the business line default agent cli tool from the agent cli tab', async () => {
    const pinia = createPinia()
    businessLinesApi.detail.mockResolvedValue({
      id: 'line-1',
      name: 'Retail',
      description: 'Retail team',
      defaultAgentCliToolId: 'codex',
    })

    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    businessLinesApi.listAgentToolConfigs.mockResolvedValueOnce([
      {
        id: 'cfg-codex',
        businessLineId: 'line-1',
        toolId: 'codex',
        name: 'Codex Default',
        description: '',
        configJson: {},
        isDefault: true,
        createdAt: '2026-03-08T00:00:00.000Z',
        updatedAt: '2026-03-08T00:00:00.000Z',
      },
    ])
    businessLinesApi.updateDefaultAgentCliTool.mockResolvedValue({
      id: 'line-1',
      name: 'Retail',
      description: 'Retail team',
      defaultAgentCliToolId: null,
    })

    await flushPromises()

    const agentCliTab = wrapper.findAll('button').find((button) => button.text().trim() === 'Agent CLI')
    expect(agentCliTab).toBeDefined()
    await agentCliTab!.trigger('click')
    await flushPromises()
    await flushPromises()

    const clearButton = wrapper.findAll('button').find((button) => button.text().trim() === '清空')
    expect(clearButton).toBeDefined()
    expect(clearButton?.attributes('disabled')).toBeUndefined()
    await clearButton!.trigger('click')
    await flushPromises()

    expect(businessLinesApi.updateDefaultAgentCliTool).toHaveBeenCalledWith('line-1', {
      defaultAgentCliToolId: null,
    })
    expect(success).toHaveBeenCalledWith('业务线默认 Agent CLI 已清空')
  })

  it('renders the default agent cli tool card as read-only without set default permission', async () => {
    authApi.access.mockResolvedValueOnce({
      user: {
        id: 'user-1',
        username: 'tester',
        nickname: 'Tester',
        avatar: null,
      },
      currentContext: {
        businessLineId: 'line-1',
        businessRole: 'owner',
        projectRole: null,
      },
      capabilities: [
        'businessLine.read',
        'businessLine.agentCli.read',
      ],
      visibility: {
        visibleBusinessLineIds: ['line-1'],
        visibleProjectIds: ['project-1'],
      },
    })

    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    businessLinesApi.listAgentToolConfigs.mockResolvedValueOnce([
      {
        id: 'cfg-codex',
        businessLineId: 'line-1',
        toolId: 'codex',
        name: 'Codex Default',
        description: '',
        configJson: {},
        isDefault: true,
        createdAt: '2026-03-08T00:00:00.000Z',
        updatedAt: '2026-03-08T00:00:00.000Z',
      },
    ])

    await flushPromises()

    const agentCliTab = wrapper.findAll('button').find((button) => button.text().trim() === 'Agent CLI')
    expect(agentCliTab).toBeDefined()
    await agentCliTab!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('当前账号仅有查看权限，无法修改默认 Agent CLI。')
    expect(wrapper.text()).not.toContain('保存')
  })

  it('edits and saves mcp json from preview modal', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineManagementPanel, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    businessLinesApi.listLocalMcps.mockResolvedValueOnce([
      {
        id: 'mcp-1',
        name: 'filesystem',
        version: 'local',
        toolsCount: 0,
        enabled: true,
        metadataJson: {
          sourcePath: '/Users/fuzhifei/.ainative/data/line-1/mcp/mcp.json',
        },
      },
    ])

    await flushPromises()

    const mcpTab = wrapper.findAll('button').find((button) => button.text().trim() === 'MCP')
    expect(mcpTab).toBeDefined()
    await mcpTab!.trigger('click')
    await flushPromises()

    const mcpCard = wrapper.find('[data-mcp-id="mcp-1"]')
    expect(mcpCard.exists()).toBe(true)
    await mcpCard.trigger('click')
    await flushPromises()

    const textarea = wrapper.find('[data-testid="mcp-json-preview-textarea"]')
    expect(textarea.exists()).toBe(true)
    await textarea.setValue(
      JSON.stringify(
        {
          mcpServers: {
            filesystem: {
              command: 'node',
              args: ['server.js'],
            },
          },
        },
        null,
        2,
      ),
    )

    const saveButton = wrapper.find('[data-testid="mcp-json-preview-save"]')
    expect(saveButton.exists()).toBe(true)
    await saveButton.trigger('click')
    await flushPromises()

    expect(businessLinesApi.importLocalMcps).toHaveBeenCalledWith('line-1', {
      payload: {
        mcpServers: {
          filesystem: {
            command: 'node',
            args: ['server.js'],
          },
        },
      },
    })
    expect(businessLinesApi.listLocalMcps).toHaveBeenCalledWith('line-1')
    expect(wrapper.find('[data-testid="mcp-json-preview-textarea"]').exists()).toBe(false)
  })
})
