import { ref } from 'vue'
import { defineStore } from 'pinia'
import { STORAGE_KEYS } from '@shared/types/common/storage'

export type ThemeMode = 'light' | 'dark'

export const useSettingStore = defineStore('setting', () => {
  const theme = ref<ThemeMode>((localStorage.getItem(STORAGE_KEYS.theme) as ThemeMode | null) ?? 'light')

  const setTheme = (nextTheme: ThemeMode) => {
    theme.value = nextTheme
    localStorage.setItem(STORAGE_KEYS.theme, nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  }

  return {
    theme,
    setTheme,
  }
})
