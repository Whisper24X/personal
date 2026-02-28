import './assets/styles/main.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { createAppStore } from './stores'
import { installDirectives } from './directives'
import { applyStoredUiPreferences } from './utils/ui-preferences'

applyStoredUiPreferences()

const app = createApp(App)

app.use(createAppStore())
app.use(router)
installDirectives(app)

app.mount('#app')
