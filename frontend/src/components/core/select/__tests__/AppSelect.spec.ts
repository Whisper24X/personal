import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import AppSelect from '@/components/core/select'
import type { SelectOptionEntry, SelectValue } from '@/components/core/select'

const originalInnerHeight = window.innerHeight

const openSelect = async (wrapper: ReturnType<typeof mount>) => {
  await wrapper.find('button[aria-haspopup="listbox"]').trigger('click')
}

const findOptionButton = (label: string) => {
  return Array.from(document.body.querySelectorAll('button[role="option"]')).find(
    (button) => button.textContent?.includes(label),
  ) as HTMLButtonElement | undefined
}

describe('AppSelect', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.innerHeight = originalInnerHeight
  })

  it('renders grouped options and keeps boolean/null values intact', async () => {
    const options: SelectOptionEntry[] = [
      {
        label: '默认值',
        options: [
          { label: 'Default', value: null },
          { label: 'Enabled', value: true },
          { label: 'Disabled', value: false },
        ],
      },
    ]

    const wrapper = mount(AppSelect, {
      attachTo: document.body,
      props: {
        modelValue: null,
        options,
        ariaLabel: '配置开关',
      },
    })

    expect(wrapper.text()).toContain('Default')

    await openSelect(wrapper)

    const enabledOption = findOptionButton('Enabled')
    expect(enabledOption).toBeDefined()

    enabledOption?.click()
    await wrapper.vm.$nextTick()

    const emittedValue = wrapper.emitted('update:modelValue')?.[0]?.[0] as SelectValue
    expect(emittedValue).toBe(true)
    expect(wrapper.emitted('change')?.[0]?.[0]).toBe(true)
  })

  it('supports keyboard navigation and closes on outside click', async () => {
    const wrapper = mount(AppSelect, {
      attachTo: document.body,
      props: {
        modelValue: 'all',
        ariaLabel: '分支筛选',
        options: [
          { label: '全部分支', value: 'all' },
          { label: '当前分支', value: 'current' },
          { label: '本地分支', value: 'local' },
        ],
      },
    })

    const trigger = wrapper.find('button[aria-haspopup="listbox"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' })

    const currentOption = findOptionButton('当前分支')
    expect(currentOption).toBeDefined()

    currentOption?.focus()
    currentOption?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe('current')

    await openSelect(wrapper)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
  })

  it('applies custom panel z-index to teleported menu', async () => {
    const wrapper = mount(AppSelect, {
      attachTo: document.body,
      props: {
        modelValue: 'all',
        ariaLabel: '项目选择',
        panelZIndex: 130,
        options: [
          { label: '全部项目', value: 'all' },
          { label: '当前项目', value: 'current' },
        ],
      },
    })

    await openSelect(wrapper)

    const listbox = document.body.querySelector('[role="listbox"]') as HTMLDivElement | null

    expect(listbox).not.toBeNull()
    expect(listbox?.style.zIndex).toBe('130')
  })

  it('supports forcing the teleported menu to open upward', async () => {
    window.innerHeight = 1000

    const wrapper = mount(AppSelect, {
      attachTo: document.body,
      props: {
        modelValue: 'all',
        ariaLabel: '配置选择',
        panelPlacement: 'top',
        options: [
          { label: '全部配置', value: 'all' },
          { label: '默认配置', value: 'default' },
        ],
      },
    })

    const trigger = wrapper.find('button[aria-haspopup="listbox"]').element as HTMLButtonElement
    trigger.getBoundingClientRect = () =>
      ({
        top: 400,
        bottom: 440,
        left: 120,
        right: 280,
        width: 160,
        height: 40,
        x: 120,
        y: 400,
        toJSON: () => ({}),
      }) as DOMRect

    await openSelect(wrapper)

    const listbox = document.body.querySelector('[role="listbox"]') as HTMLDivElement | null

    expect(listbox).not.toBeNull()
    expect(Number.parseFloat(listbox?.style.top ?? '0')).toBeLessThan(400)
  })
})
