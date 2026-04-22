import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/api/auth'
import { sessionIsLoggedIn, syncSessionTokenFromStorage } from '../auth-session'
import type { AccessContextParams, CurrentAccessResponse } from '@shared/types/common/access'

const normalizeContext = (context?: AccessContextParams): AccessContextParams => {
  const businessLineId = context?.businessLineId?.trim() || undefined
  const projectId = context?.projectId?.trim() || undefined

  return {
    ...(businessLineId ? { businessLineId } : {}),
    ...(projectId ? { projectId } : {}),
  }
}

const buildContextKey = (context?: AccessContextParams) => {
  return JSON.stringify(normalizeContext(context))
}

export const useAccessStore = defineStore('access', () => {
  syncSessionTokenFromStorage()

  const currentAccess = ref<CurrentAccessResponse | null>(null)
  const loading = ref(false)
  const lastContextKey = ref('')

  const capabilities = computed(() => {
    if (!sessionIsLoggedIn.value) {
      return [] as string[]
    }

    return currentAccess.value?.capabilities ?? []
  })

  const currentBusinessRole = computed(() => {
    return currentAccess.value?.currentContext.businessRole ?? null
  })

  const currentProjectRole = computed(() => {
    return currentAccess.value?.currentContext.projectRole ?? null
  })

  const setAccess = (
    nextAccess: CurrentAccessResponse | null,
    context?: AccessContextParams,
  ) => {
    currentAccess.value = nextAccess
    lastContextKey.value = nextAccess
      ? buildContextKey(context ?? nextAccess.currentContext)
      : ''
  }

  const clear = () => {
    currentAccess.value = null
    loading.value = false
    lastContextKey.value = ''
  }

  const loadContext = async (
    context?: AccessContextParams,
    options?: { force?: boolean },
  ) => {
    if (!sessionIsLoggedIn.value) {
      clear()
      return null
    }

    const normalizedContext = normalizeContext(context)
    const contextKey = buildContextKey(normalizedContext)

    if (!options?.force && currentAccess.value && lastContextKey.value === contextKey) {
      return currentAccess.value
    }

    loading.value = true

    try {
      const response = await authApi.access(normalizedContext)
      setAccess(response, normalizedContext)
      return response
    } finally {
      loading.value = false
    }
  }

  const hasCapability = (capability: string) => {
    return capabilities.value.includes(capability)
  }

  const hasAnyCapability = (nextCapabilities: string[]) => {
    return nextCapabilities.some((capability) => hasCapability(capability))
  }

  const isPlatformAdmin = computed(() => currentAccess.value?.isAdmin ?? false)

  return {
    currentAccess,
    loading,
    capabilities,
    currentBusinessRole,
    currentProjectRole,
    isPlatformAdmin,
    setAccess,
    clear,
    loadContext,
    hasCapability,
    hasAnyCapability,
  }
})
