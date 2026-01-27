import { defineStore } from "pinia"
import { ref } from "vue"

// 通用选择状态管理
export const useSelectedStore = defineStore(
  "selected",
  () => {
    const selected = ref<number>(0)
    // 存储当前选中项的信息
    const selectedItem = ref<any>(null)

    const setSelected = (value: number) => {
      selected.value = value
    }

    // 设置当前选中项的信息
    const setSelectedItem = (item: any) => {
      selectedItem.value = item
    }

    // 重置选择状态
    const resetSelected = () => {
      selected.value = 0
      selectedItem.value = null
    }

    return {
      selected,
      setSelected,
      selectedItem,
      setSelectedItem,
      resetSelected
    }
  },
  {
    persist: true // 开启持久化存储
  }
)
