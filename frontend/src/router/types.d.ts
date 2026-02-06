import 'vue-router'
import type { AppRouteMeta } from '@/types/router/meta'

declare module 'vue-router' {
  interface RouteMeta extends AppRouteMeta {}
}
