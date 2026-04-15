import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FilePreviewPanel from '@shared/components/file-browser/FilePreviewPanel.vue'

describe('FilePreviewPanel', () => {
  const htmlPreview = {
    path: 'dist/index.html',
    previewType: 'text' as const,
    tooLarge: false,
    size: 128,
    mimeType: 'text/html',
    text: '<!doctype html><html><body><h1>Hello preview</h1></body></html>',
  }
  const markdownPreview = {
    path: 'README.md',
    previewType: 'markdown' as const,
    tooLarge: false,
    size: 96,
    mimeType: 'text/markdown',
    text: '# Heading\n\nParagraph text',
  }

  it('renders html files with an iframe preview in preview mode', () => {
    const wrapper = mount(FilePreviewPanel, {
      props: {
        selectedPath: 'dist/index.html',
        preview: htmlPreview,
      },
    })

    const iframe = wrapper.find('iframe[title="HTML 文件预览"]')

    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('srcdoc')).toContain('<h1>Hello preview</h1>')
  })

  it('falls back to source view for html files when source mode is selected', () => {
    const wrapper = mount(FilePreviewPanel, {
      props: {
        selectedPath: 'dist/index.html',
        preview: htmlPreview,
        mode: 'source',
      },
    })

    expect(wrapper.find('iframe[title="HTML 文件预览"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('HTML')
    expect(wrapper.text()).toContain('Hello preview')
  })

  it('wraps markdown previews in a centered document container', async () => {
    const wrapper = mount(FilePreviewPanel, {
      props: {
        selectedPath: 'README.md',
        preview: markdownPreview,
      },
    })

    await flushPromises()
    await vi.dynamicImportSettled()
    await flushPromises()

    const documentContainer = wrapper.find('.mx-auto.w-full.max-w-4xl')

    expect(documentContainer.exists()).toBe(true)
    expect(wrapper.text()).toContain('Heading')
    expect(wrapper.text()).toContain('Paragraph text')
  })
})
