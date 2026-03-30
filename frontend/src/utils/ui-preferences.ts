import { STORAGE_KEYS } from '@/types/common/storage'

export const APPEARANCE_MODES = ['light', 'dark'] as const
export type AppearanceMode = (typeof APPEARANCE_MODES)[number]

export const THEME_COLORS = ['mono', 'amber', 'ocean', 'forest', 'rose', 'violet', 'teal', 'slate'] as const
export type ThemeColor = (typeof THEME_COLORS)[number]

export const BACKGROUND_STYLES = ['grid', 'plain', 'glow'] as const
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number]

type UiPreferences = {
  appearanceMode: AppearanceMode
  themeColor: ThemeColor
  backgroundStyle: BackgroundStyle
}

const asKnownValue = <T extends readonly string[]>(
  value: string | null,
  values: T,
  fallback: T[number],
): T[number] => {
  if (value && values.includes(value)) {
    return value
  }

  return fallback
}

export const resolveAppearanceMode = (value: string | null) => {
  return asKnownValue(value, APPEARANCE_MODES, 'light')
}

export const resolveThemeColor = (value: string | null) => {
  return asKnownValue(value, THEME_COLORS, 'mono')
}

export const resolveBackgroundStyle = (value: string | null) => {
  return asKnownValue(value, BACKGROUND_STYLES, 'grid')
}

export const applyAppearanceMode = (appearanceMode: AppearanceMode) => {
  document.documentElement.classList.toggle('dark', appearanceMode === 'dark')
}

export const applyThemeColor = (themeColor: ThemeColor) => {
  document.documentElement.setAttribute('data-theme-color', themeColor)
}

export const applyBackgroundStyle = (backgroundStyle: BackgroundStyle) => {
  document.documentElement.setAttribute('data-background-style', backgroundStyle)
}

export const loadUiPreferencesFromStorage = (): UiPreferences => {
  return {
    appearanceMode: resolveAppearanceMode(localStorage.getItem(STORAGE_KEYS.theme)),
    themeColor: resolveThemeColor(localStorage.getItem(STORAGE_KEYS.themeColor)),
    backgroundStyle: resolveBackgroundStyle(localStorage.getItem(STORAGE_KEYS.backgroundStyle)),
  }
}

export const applyStoredUiPreferences = () => {
  const preferences = loadUiPreferencesFromStorage()
  applyAppearanceMode(preferences.appearanceMode)
  applyThemeColor(preferences.themeColor)
  applyBackgroundStyle(preferences.backgroundStyle)
}
