import { ref } from 'vue'
import { defineStore } from 'pinia'

export type WorktabItem = {
  key: string
  title: string
  path: string
}

export const useWorktabStore = defineStore('worktab', () => {
  const tabs = ref<WorktabItem[]>([])

  const upsertTab = (tab: WorktabItem) => {
    const existing = tabs.value.find((item) => item.key === tab.key)
    if (existing) {
      existing.title = tab.title
      existing.path = tab.path
      return
    }

    tabs.value.push(tab)
  }

  const removeTab = (key: string) => {
    tabs.value = tabs.value.filter((tab) => tab.key !== key)
  }

  return {
    tabs,
    upsertTab,
    removeTab,
  }
})
