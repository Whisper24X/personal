import type { AppearanceMode, BackgroundStyle, ThemeColor } from '@shared/utils/ui-preferences'

export const THEME_COLOR_OPTIONS: Array<{ value: ThemeColor; label: string }> = [
  { value: 'mono', label: '黑白' },
  { value: 'amber', label: '琥珀' },
  { value: 'ocean', label: '海蓝' },
  { value: 'forest', label: '森绿' },
  { value: 'rose', label: '玫红' },
  { value: 'violet', label: '紫晶' },
  { value: 'teal', label: '青碧' },
  { value: 'slate', label: '石墨' },
]

export const THEME_COLOR_SWATCH_CLASS: Record<ThemeColor, string> = {
  mono: 'bg-gradient-to-br from-neutral-950 to-neutral-100',
  amber: 'bg-amber-500',
  ocean: 'bg-sky-500',
  forest: 'bg-emerald-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  teal: 'bg-teal-500',
  slate: 'bg-slate-500',
}

export const APPEARANCE_OPTIONS: Array<{ value: AppearanceMode; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

export const BACKGROUND_STYLE_OPTIONS: Array<{ value: BackgroundStyle; label: string }> = [
  { value: 'grid', label: '网格光斑' },
  { value: 'plain', label: '纯色' },
  { value: 'glow', label: '柔光' },
]
