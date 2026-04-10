import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import FilePreviewCard from '@shared/components/file-browser/FilePreviewCard.vue'
import FilePreviewPanel from '@shared/components/file-browser/FilePreviewPanel.vue'

describe('FilePreviewCard', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('opens and closes the fullscreen preview dialog', async () => {
    const wrapper = mount(FilePreviewCard, {
      attachTo: document.body,
      props: {
        selectedPath: 'dist/index.html',
        preview: {
          path: 'dist/index.html',
          previewType: 'text',
          tooLarge: false,
          size: 128,
          mimeType: 'text/html',
          text: '<!doctype html><html><body><h1>Hello preview</h1></body></html>',
        },
      },
    })

    const fullscreenButton = wrapper.findAll('button').find((button) =>
      button.text().includes('全屏'),
    )

    expect(fullscreenButton).toBeTruthy()

    await fullscreenButton!.trigger('click')

    expect(document.body.querySelector('[role="dialog"][aria-label="文件全屏预览"]')).not.toBeNull()

    const dialog = document.body.querySelector('[role="dialog"][aria-label="文件全屏预览"]')
    const closeButton = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === '全屏',
    )

    expect(closeButton).toBeTruthy()

    closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('[role="dialog"][aria-label="文件全屏预览"]')).toBeNull()
  })

  it('disables preview tab for JSON and defaults to source mode', () => {
    const wrapper = mount(FilePreviewCard, {
      props: {
        selectedPath: 'config.json',
        preview: {
          path: 'config.json',
          previewType: 'text',
          tooLarge: false,
          size: 12,
          mimeType: 'application/json',
          text: '{}',
        },
      },
    })

    const previewBtn = wrapper.findAll('button').find((b) => b.text() === '预览')
    const sourceBtn = wrapper.findAll('button').find((b) => b.text() === '源码')

    expect(previewBtn?.attributes('disabled')).toBeDefined()
    expect(sourceBtn?.attributes('disabled')).toBeUndefined()

    const panel = wrapper.findComponent(FilePreviewPanel)
    expect(panel.props('mode')).toBe('source')
  })
})
