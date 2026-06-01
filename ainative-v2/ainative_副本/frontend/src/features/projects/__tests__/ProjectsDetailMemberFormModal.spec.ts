import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectsDetailMemberFormModal from '@features/projects/projects-detail/ProjectsDetailMemberFormModal.vue'
import AppSelect from '@shared/components/select'

const { projectDetailCtx } = vi.hoisted(() => ({
  projectDetailCtx: {} as Record<string, unknown>,
}))

vi.mock('@features/projects/use-projects-detail-page-inject', () => ({
  useProjectsDetailPageInject: () => projectDetailCtx,
}))

describe('ProjectsDetailMemberFormModal', () => {
  beforeEach(() => {
    Object.assign(projectDetailCtx, {
      memberFormModalOpen: true,
      closeMemberFormModal: vi.fn(),
      createMember: vi.fn(),
      creatingMember: false,
      users: [],
      newMemberForm: {
        userId: '',
        roleKey: 'role:developer',
      },
      projectRoleSelectOptions: [
        { label: '开发者', value: 'role:developer' },
        { label: '测试', value: 'role:qa' },
      ],
    })
  })

  it('renders project role options as a flat list', () => {
    const wrapper = mount(ProjectsDetailMemberFormModal, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    const roleSelect = wrapper.findComponent(AppSelect)

    expect(roleSelect.exists()).toBe(true)
    expect(roleSelect.props('options')).toEqual([
      { label: '开发者', value: 'role:developer' },
      { label: '测试', value: 'role:qa' },
    ])
  })
})
