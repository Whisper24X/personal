import { computed, ref } from 'vue'
import { STORAGE_KEYS } from '@shared/types/common/storage'

/**
 * Reactive auth token shared by user and access stores to avoid a static
 * user ↔ access import cycle (see deps:circular:strict).
 */
export const sessionToken = ref<string | null>(localStorage.getItem(STORAGE_KEYS.authToken))

export const sessionIsLoggedIn = computed(() => Boolean(sessionToken.value))

export function setSessionToken(next: string | null) {
  sessionToken.value = next
  if (next) {
    localStorage.setItem(STORAGE_KEYS.authToken, next)
  } else {
    localStorage.removeItem(STORAGE_KEYS.authToken)
  }
}

/** Call when creating the user store (or tests) so session matches current localStorage. */
export function syncSessionTokenFromStorage() {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.authToken) : null
  setSessionToken(raw)
}
