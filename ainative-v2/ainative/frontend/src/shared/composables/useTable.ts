import { computed, ref } from 'vue'

type TableOptions<T> = {
  apiFn: () => Promise<T[]>
  enableCache?: boolean
  cacheTime?: number
}

type CacheEntry<T> = {
  data: T[]
  expiresAt: number
}

export const useTable = <T>(options: TableOptions<T>) => {
  const rows = ref<T[]>([])
  const loading = ref(false)
  const cache = ref<CacheEntry<T> | null>(null)

  const hasData = computed(() => rows.value.length > 0)

  const readCache = () => {
    if (!options.enableCache || !cache.value) return null
    if (Date.now() > cache.value.expiresAt) return null
    return cache.value.data
  }

  const fetchData = async (force = false) => {
    if (!force) {
      const cached = readCache()
      if (cached) {
        rows.value = cached
        return
      }
    }

    loading.value = true
    try {
      const nextRows = await options.apiFn()
      rows.value = nextRows

      if (options.enableCache) {
        const cacheTime = options.cacheTime ?? 5 * 60 * 1000
        cache.value = {
          data: nextRows,
          expiresAt: Date.now() + cacheTime,
        }
      }
    } finally {
      loading.value = false
    }
  }

  return {
    rows,
    loading,
    hasData,
    fetchData,
  }
}
