/** 与 TaskPreviewPanel 中 localStorage 约定一致，供单测与组件共用 */
export const PREVIEW_VIEWPORT_STORAGE_KEY = 'ainative:taskPreviewViewport' as const

export const PREVIEW_FULL_VIEWPORT_ID = 'full' as const

export type PreviewViewportPreset = {
  id: string
  label: string
  width: number
  height: number
}

export const PREVIEW_VIEWPORT_PRESETS: readonly PreviewViewportPreset[] = [
  { id: 'ios-se', label: 'iPhone SE (375×667)', width: 375, height: 667 },
  { id: 'ios-14', label: 'iPhone 14 (390×844)', width: 390, height: 844 },
  { id: 'android', label: 'Android 常见 (360×800)', width: 360, height: 800 },
  { id: 'ios-plus', label: '大屏手机 (428×926)', width: 428, height: 926 },
] as const

export function getPreviewViewportPreset(id: string): PreviewViewportPreset | undefined {
  return PREVIEW_VIEWPORT_PRESETS.find((p) => p.id === id)
}

/**
 * 竖屏为基准尺寸；landscape 为 true 时交换宽、高，模拟横屏视口
 */
export function resolveFramePixelSize(
  preset: PreviewViewportPreset,
  landscape: boolean,
): { width: number; height: number } {
  if (landscape) {
    return { width: preset.height, height: preset.width }
  }
  return { width: preset.width, height: preset.height }
}

export function parsePreviewViewportFromStorage(
  raw: string | null,
): { viewportId: string; landscape: boolean } {
  const fallback = { viewportId: PREVIEW_FULL_VIEWPORT_ID, landscape: false }
  if (raw == null || raw === '') {
    return fallback
  }
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const viewportId = typeof o.viewportId === 'string' ? o.viewportId : PREVIEW_FULL_VIEWPORT_ID
    const landscape = typeof o.landscape === 'boolean' ? o.landscape : false
    if (viewportId !== PREVIEW_FULL_VIEWPORT_ID && !getPreviewViewportPreset(viewportId)) {
      return fallback
    }
    return { viewportId, landscape }
  } catch {
    return fallback
  }
}

export function getInitialPreviewViewportState(): { viewportId: string; landscape: boolean } {
  if (typeof localStorage === 'undefined') {
    return { viewportId: PREVIEW_FULL_VIEWPORT_ID, landscape: false }
  }
  return parsePreviewViewportFromStorage(localStorage.getItem(PREVIEW_VIEWPORT_STORAGE_KEY))
}
