import { createApp } from 'vue'
import '@/styles/index.scss'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import Logger from '@/utils/logger'
import { setupStore } from './store'
import { installDirectives } from './directives/index'
import router from './routers'
import App from './App.vue'

function installLogger(app: any) {
  const logger = new Logger({
    level: 'info',
    showTimestamp: true,
    logToConsole: true,
    logToStorage: false,
    logToServer: false,
    context: { appName: 'APP' },
  })
  // 把 logger 实例添加到全局实例上
  app.config.globalProperties.$logger = logger

  // 还可以根据需要设置额外的上下文，例如用户信息
  app.provide('logger', logger)
}

const app = createApp(App)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component as any)
}
setupStore(app)
installDirectives(app)
installLogger(app)

app.use(ElementPlus, {
  locale: zhCn,
})
app.use(router)
app.mount('#root')
