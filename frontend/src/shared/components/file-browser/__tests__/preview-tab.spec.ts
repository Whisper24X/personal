import { describe, expect, it } from 'vitest'
import {
  canShowPreviewTab,
  canShowSourceTab,
  isSourceOnlyTextPreview,
  resolveDefaultPreviewMode,
} from '../preview'
import type { FileBrowserPreview } from '../types'

const textPreview = (overrides: Partial<FileBrowserPreview>): FileBrowserPreview => ({
  path: 'x',
  previewType: 'text',
  tooLarge: false,
  size: 1,
  mimeType: 'text/plain',
  text: 'a',
  ...overrides,
})

describe('preview tab helpers', () => {
  it('marks JSON / YAML / XML text as source-only', () => {
    expect(
      isSourceOnlyTextPreview(textPreview({ mimeType: 'application/json' }), 'a.json'),
    ).toBe(true)
    expect(
      isSourceOnlyTextPreview(textPreview({ mimeType: 'text/yaml' }), 'a.yaml'),
    ).toBe(true)
    expect(
      isSourceOnlyTextPreview(textPreview({ mimeType: 'application/xml' }), 'a.xml'),
    ).toBe(true)
    expect(
      isSourceOnlyTextPreview(textPreview({ mimeType: 'text/plain' }), 'data.json'),
    ).toBe(true)
  })

  it('does not mark TypeScript or Markdown text as source-only', () => {
    expect(
      isSourceOnlyTextPreview(textPreview({ mimeType: 'text/typescript' }), 'a.ts'),
    ).toBe(false)
    expect(
      isSourceOnlyTextPreview(textPreview({ mimeType: 'text/markdown' }), 'a.md'),
    ).toBe(false)
  })

  it('does not mark HTML or XHTML as source-only', () => {
    expect(
      isSourceOnlyTextPreview(textPreview({ mimeType: 'text/html' }), 'a.html'),
    ).toBe(false)
    expect(
      isSourceOnlyTextPreview(textPreview({ mimeType: 'application/xhtml+xml' }), 'a.xhtml'),
    ).toBe(false)
  })

  it('hides preview tab for source-only files when loaded', () => {
    const p = textPreview({ mimeType: 'application/json', text: '{}' })
    expect(canShowPreviewTab(p, 'cfg.json', { loading: false })).toBe(false)
    expect(canShowSourceTab(p, { loading: false })).toBe(true)
    expect(resolveDefaultPreviewMode(p, 'cfg.json', { loading: false })).toBe('source')
  })

  it('disables both tabs while loading', () => {
    const p = textPreview({ mimeType: 'application/json', text: '{}' })
    expect(canShowPreviewTab(p, 'cfg.json', { loading: true })).toBe(false)
    expect(canShowSourceTab(p, { loading: true })).toBe(false)
  })
})
