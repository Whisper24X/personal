import { config, flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import BusinessLineManagementPanel from '@/components/business/settings/BusinessLineManagementPanel.vue'
import AgentToolConfigModal from '@/components/business/settings/modals/AgentToolConfigModal.vue'
import McpJsonImportModal from '@/components/business/settings/modals/McpJsonImportModal.vue'

const { authApi, businessLinesApi, projectsApi, usersApi, workflowApi, fetchAllPages, routerPush } = vi.hoisted(() => ({
  authApi: {
    access: vi.fn(),
  },
  businessLinesApi: {
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

vi.mock('@/utils/pagination', () => ({
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
      'businessLine.update',
      'businessLine.member.read',
      'businessLine.member.invite',
      'businessLine.member.remove',
      'businessLine.member.updateRole',
      'businessLine.project.create',
      'businessLine.project.update',
      'businessLine.project.delete',
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

  it('renders left-right layout with 7 tabs by default', async () => {
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

  it('disables create business line button when user has no permission', async () => {
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

    expect(createLineButton).toBeDefined()
    expect((createLineButton!.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('当前账号暂无创建业务线权限')
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

    const workflowForm = wrapper.find('[aria-labelledby="business-line-workflow-create-modal-title"] form')
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

    const approvalCheckbox = wrapper.find(
      '[aria-labelledby="business-line-workflow-create-modal-title"] input[type="checkbox"]',
    )
    expect(approvalCheckbox.exists()).toBe(true)
    expect((approvalCheckbox.element as HTMLInputElement).checked).toBe(true)

    const nameInput = wrapper.find('input[placeholder="例如：业务线默认代码修复流"]')
    expect(nameInput.exists()).toBe(true)
    await nameInput.setValue('业务线默认流')

    const workflowForm = wrapper.find('[aria-labelledby="business-line-workflow-create-modal-title"] form')
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

    const mcpTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'MCP')
    expect(mcpTab).toBeDefined()
    await mcpTab!.trigger('click')
    await flushPromises()

    const importButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '添加')
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

    const mcpTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'MCP')
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

    const mcpTab = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'MCP')
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
