import './assets/styles/main.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { createAppStore } from './stores'
import { installDirectives } from './directives'
import { STORAGE_KEYS } from './types/common/storage'

const density = localStorage.getItem(STORAGE_KEYS.uiDensity)
if (density === 'compact' || density === 'comfortable') {
  document.documentElement.setAttribute('data-ui-density', density)
}

const app = createApp(App)

app.use(createAppStore())
app.use(router)
installDirectives(app)

app.mount('#app')
