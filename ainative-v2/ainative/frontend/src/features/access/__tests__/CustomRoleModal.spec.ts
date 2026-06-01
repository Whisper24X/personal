import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CustomRoleModal from '@features/access/CustomRoleModal.vue'
import {
  BUSINESS_LINE_CAPABILITY_DEPENDENCIES,
  BUSINESS_LINE_CAPABILITY_TREE,
  flattenCapabilityTree,
} from '@shared/constants/access'

const totalCapabilityCount = flattenCapabilityTree(BUSINESS_LINE_CAPABILITY_TREE).length

const mountModal = (initialCapabilities: string[] = []) =>
  mount(CustomRoleModal, {
    props: {
      open: true,
      mode: 'edit',
      scopeLabel: '业务线',
      submitting: false,
      capabilityTree: BUSINESS_LINE_CAPABILITY_TREE,
      capabilityDependencies: BUSINESS_LINE_CAPABILITY_DEPENDENCIES,
      foundationCapabilityCode: 'businessLine.read',
      initialName: '运营管理员',
      initialDescription: '负责业务线权限编排',
      initialCapabilities,
    },
    global: {
      stubs: {
        teleport: true,
      },
    },
  })

describe('CustomRoleModal', () => {
  it('excludes foundation capability from regular summary and supports bulk selection', async () => {
    const wrapper = mountModal(['businessLine.read', 'businessLine.project.create'])

    expect(wrapper.text()).toContain(`已选 1 / ${totalCapabilityCount}`)
    expect(wrapper.text()).not.toContain('基础访问能力')
    expect(wrapper.find('[data-capability-code="businessLine.read"]').exists()).toBe(false)

    const selectAllButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '全选')

    expect(selectAllButton).toBeDefined()
    await selectAllButton!.trigger('click')
    expect(wrapper.text()).toContain(`已选 ${totalCapabilityCount} / ${totalCapabilityCount}`)

    const clearButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '清空')

    expect(clearButton).toBeDefined()
    await clearButton!.trigger('click')
    expect(wrapper.text()).toContain(`已选 0 / ${totalCapabilityCount}`)

    wrapper.unmount()
  })

  it('locks foundation capability when dependent permissions are selected', async () => {
    const wrapper = mountModal([])

    const createProjectCheckbox = wrapper
      .get('[data-capability-code="businessLine.project.create"]')
      .find('input[type="checkbox"]')
    await createProjectCheckbox.setValue(true)

    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          name: '运营管理员',
          description: '负责业务线权限编排',
          capabilities: ['businessLine.project.create', 'businessLine.read'],
        },
      ],
    ])
  })

  it('keeps hidden foundation capability when editing an existing read-only role', async () => {
    const wrapper = mountModal(['businessLine.read'])

    expect(wrapper.text()).toContain(`已选 0 / ${totalCapabilityCount}`)
    expect(wrapper.text()).not.toContain('基础访问能力')
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          name: '运营管理员',
          description: '负责业务线权限编排',
          capabilities: ['businessLine.read'],
        },
      ],
    ])
  })
})
