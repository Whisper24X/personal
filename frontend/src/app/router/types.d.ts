import 'vue-router'
import type { AppRouteMeta } from '@/types/router/meta'

declare module 'vue-router' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RouteMeta extends AppRouteMeta {}
}
