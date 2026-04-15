import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type AppMenuItem = {
  key: string
  title: string
  path: string
}

export const useMenuStore = defineStore('menu', () => {
  const items = ref<AppMenuItem[]>([])

  const hasMenus = computed(() => items.value.length > 0)

  const setMenus = (nextItems: AppMenuItem[]) => {
    items.value = nextItems
  }

  return {
    items,
    hasMenus,
    setMenus,
  }
})
