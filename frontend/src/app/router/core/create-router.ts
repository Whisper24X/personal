import { createRouter, createWebHistory } from 'vue-router'
import { staticRoutes } from '@app/router/modules/static-routes'

export const createAppRouter = () => {
  return createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: staticRoutes,
  })
}
