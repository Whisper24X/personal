import { STORAGE_KEYS } from '@/types/common/storage'

export const UI_LOCALES = ['zh-CN', 'en-US'] as const
export type UiLocale = (typeof UI_LOCALES)[number]

export const APPEARANCE_MODES = ['light', 'dark'] as const
export type AppearanceMode = (typeof APPEARANCE_MODES)[number]

export const THEME_COLORS = ['amber', 'ocean', 'forest'] as const
export type ThemeColor = (typeof THEME_COLORS)[number]

export const BACKGROUND_STYLES = ['grid', 'plain', 'glow'] as const
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number]

type UiPreferences = {
  locale: UiLocale
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

export const resolveUiLocale = (value: string | null) => {
  return asKnownValue(value, UI_LOCALES, 'zh-CN')
}

export const resolveAppearanceMode = (value: string | null) => {
  return asKnownValue(value, APPEARANCE_MODES, 'light')
}

export const resolveThemeColor = (value: string | null) => {
  return asKnownValue(value, THEME_COLORS, 'amber')
}

export const resolveBackgroundStyle = (value: string | null) => {
  return asKnownValue(value, BACKGROUND_STYLES, 'grid')
}

export const applyUiLocale = (locale: UiLocale) => {
  document.documentElement.lang = locale
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
    locale: resolveUiLocale(localStorage.getItem(STORAGE_KEYS.locale)),
    appearanceMode: resolveAppearanceMode(localStorage.getItem(STORAGE_KEYS.theme)),
    themeColor: resolveThemeColor(localStorage.getItem(STORAGE_KEYS.themeColor)),
    backgroundStyle: resolveBackgroundStyle(localStorage.getItem(STORAGE_KEYS.backgroundStyle)),
  }
}

export const applyStoredUiPreferences = () => {
  const preferences = loadUiPreferencesFromStorage()
  applyUiLocale(preferences.locale)
  applyAppearanceMode(preferences.appearanceMode)
  applyThemeColor(preferences.themeColor)
  applyBackgroundStyle(preferences.backgroundStyle)
}
