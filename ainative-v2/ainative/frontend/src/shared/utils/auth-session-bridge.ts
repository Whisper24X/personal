/** Dispatched when HTTP layer updates or clears auth in localStorage; app layer syncs Pinia (api must not import @app). */
export const AUTH_SESSION_EVENT = 'ainative:auth-session'

export type AuthSessionDetail =
  | { kind: 'clear' }
  | { kind: 'token'; token: string }

export function dispatchAuthSessionEvent(detail: AuthSessionDetail) {
  window.dispatchEvent(new CustomEvent<AuthSessionDetail>(AUTH_SESSION_EVENT, { detail }))
}
