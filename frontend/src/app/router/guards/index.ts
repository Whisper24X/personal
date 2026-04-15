import type { Router } from 'vue-router'
import { authGuard } from './auth-guard'
import { permissionGuard } from './permission-guard'

export const installRouterGuards = (router: Router) => {
  router.beforeEach(authGuard)
  router.beforeEach(permissionGuard)
}
