import { computed, ref } from 'vue'

type ChartDatum = {
  label: string
  value: number
}

export const useChart = (initialData: ChartDatum[] = []) => {
  const data = ref<ChartDatum[]>(initialData)

  const total = computed(() => data.value.reduce((sum, item) => sum + item.value, 0))

  const setData = (nextData: ChartDatum[]) => {
    data.value = nextData
  }

  return {
    data,
    total,
    setData,
  }
}
