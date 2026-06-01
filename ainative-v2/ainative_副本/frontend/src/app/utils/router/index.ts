import type { RouteLocationNormalizedLoaded } from 'vue-router'

export const routeTitle = (route: RouteLocationNormalizedLoaded) => {
  return (route.meta.title as string | undefined) ?? ''
}
