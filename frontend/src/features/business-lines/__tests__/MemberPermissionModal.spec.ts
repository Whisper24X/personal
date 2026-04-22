import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MemberPermissionModal from '@features/business-lines/modals/MemberPermissionModal.vue'
import AppSelect from '@shared/components/select'

describe('MemberPermissionModal', () => {
  it('renders business line role options as a flat list', () => {
    const wrapper = mount(MemberPermissionModal, {
      props: {
        open: true,
        mode: 'create',
        submitting: false,
        preparing: false,
        users: [],
        projects: [],
        roleOptions: [
          {
            key: 'role:owner',
            label: 'Owner',
            description: '角色',
            roleId: 'owner',
            source: 'default',
          },
          {
            key: 'role:ops-admin',
            label: '运营管理员',
            description: '角色',
            roleId: 'ops-admin',
            source: 'custom',
          },
        ],
        initialUserId: '',
        initialBusinessRole: 'owner',
        initialProjectRoles: {},
        showProjectRoles: false,
        projectRoleOptions: [],
      },
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    const businessRoleSelect = wrapper.findComponent(AppSelect)

    expect(businessRoleSelect.exists()).toBe(true)
    expect(businessRoleSelect.props('options')).toEqual([
      { label: 'Owner', value: 'role:owner' },
      { label: '运营管理员', value: 'role:ops-admin' },
    ])
  })

  it('pins project role select to the right with stable width classes', () => {
    const wrapper = mount(MemberPermissionModal, {
      props: {
        open: true,
        mode: 'edit',
        submitting: false,
        preparing: false,
        users: [],
        projects: [{ id: 'project-alpha', name: 'Alpha 项目' }],
        roleOptions: [
          {
            key: 'role:owner',
            label: 'Owner',
            description: '角色',
            roleId: 'owner',
            source: 'default',
          },
        ],
        initialUserId: 'user-1',
        initialBusinessRole: 'owner',
        initialProjectRoles: { 'project-alpha': 'owner' },
        showProjectRoles: true,
        projectRoleOptions: [
          { label: 'Owner', value: 'owner' },
          { label: 'Long Custom Project Role Name', value: 'custom-role' },
        ],
      },
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    const selects = wrapper.findAllComponents(AppSelect)
    const projectRoleSelect = selects[1]

    expect(projectRoleSelect?.exists()).toBe(true)
    expect(projectRoleSelect!.props('wrapperClass')).toContain('lg:ml-auto')
    expect(projectRoleSelect!.props('wrapperClass')).toContain('lg:w-52')
    expect(projectRoleSelect!.props('triggerClass')).toContain('w-full')
    expect(projectRoleSelect!.props('triggerLabelTruncate')).toBe(true)
  })
})
