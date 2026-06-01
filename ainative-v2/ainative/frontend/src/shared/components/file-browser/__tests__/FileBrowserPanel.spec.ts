import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FileBrowserPanel from '@shared/components/file-browser/FileBrowserPanel.vue'

describe('FileBrowserPanel', () => {
  it('auto expands a single root directory until files are visible', async () => {
    const loadTree = vi.fn(async (path: string) => {
      if (path === '.') {
        return {
          cwd: '.',
          entries: [{ name: 'frontend', path: 'frontend', isDir: true }],
        }
      }

      if (path === 'frontend') {
        return {
          cwd: 'frontend',
          entries: [{ name: 'index.vue', path: 'frontend/index.vue', isDir: false }],
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const wrapper = mount(FileBrowserPanel, {
      props: {
        sourceKey: 'task-1',
        loadTree,
        loadPreview: vi.fn(),
      },
      global: {
        stubs: {
          FilePreviewCard: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(loadTree).toHaveBeenNthCalledWith(1, '.')
    expect(loadTree).toHaveBeenNthCalledWith(2, 'frontend')
    expect(wrapper.text()).toContain('frontend')
    expect(wrapper.text()).toContain('index.vue')
  })
})
