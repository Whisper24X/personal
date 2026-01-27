import { App } from "vue"
import { createPinia } from "pinia"

export const pinia = createPinia()

export const setupStore = (app: App<Element>) => {
  app.use(pinia)
}