import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import FilePreviewCard from '@/components/core/file-browser/FilePreviewCard.vue'

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

    const closeButton = Array.from(document.body.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('退出全屏'),
    )

    expect(closeButton).toBeTruthy()

    closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('[role="dialog"][aria-label="文件全屏预览"]')).toBeNull()
  })
})
