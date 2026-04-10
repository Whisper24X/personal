import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CustomRoleModal from '@features/access/CustomRoleModal.vue'
import {
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
  it('renders selected capability summary and supports bulk selection', async () => {
    const wrapper = mountModal(['businessLine.read', 'businessLine.project.create'])

    expect(wrapper.text()).toContain(`已选 2 / ${totalCapabilityCount}`)

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
})
