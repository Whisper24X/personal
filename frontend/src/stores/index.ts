import { createPinia, type Pinia } from 'pinia'

export const createAppStore = (): Pinia => {
  return createPinia()
}

export * from './modules/user'
export * from './modules/menu'
export * from './modules/setting'
export * from './modules/worktab'
