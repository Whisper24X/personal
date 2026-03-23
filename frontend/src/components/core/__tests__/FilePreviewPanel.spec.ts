import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FilePreviewPanel from '@/components/core/file-browser/FilePreviewPanel.vue'

describe('FilePreviewPanel', () => {
  const htmlPreview = {
    path: 'dist/index.html',
    previewType: 'text' as const,
    tooLarge: false,
    size: 128,
    mimeType: 'text/html',
    text: '<!doctype html><html><body><h1>Hello preview</h1></body></html>',
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
})
