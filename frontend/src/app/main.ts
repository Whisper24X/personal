import '@shared/assets/styles/main.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { createAppStore, useUserStore } from './stores'
import { installDirectives } from './directives'
import { applyStoredUiPreferences } from '@shared/utils/ui-preferences'
import {
  AUTH_SESSION_EVENT,
  type AuthSessionDetail,
} from '@shared/utils/auth-session-bridge'

applyStoredUiPreferences()

const app = createApp(App)

app.use(createAppStore())
app.use(router)

const userStore = useUserStore()
window.addEventListener(AUTH_SESSION_EVENT, (ev: Event) => {
  const e = ev as CustomEvent<AuthSessionDetail>
  const detail = e.detail
  if (detail.kind === 'clear') {
    userStore.setToken(null)
    userStore.setProfile(null)
  } else if (detail.kind === 'token') {
    userStore.setToken(detail.token)
  }
})

installDirectives(app)

void router.isReady().then(() => {
  app.mount('#app')
})
