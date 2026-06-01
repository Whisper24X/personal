import type { App } from 'vue'
import { authDirective } from './business/auth'

export const installDirectives = (app: App) => {
  app.directive('auth', authDirective)
}
