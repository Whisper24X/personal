import { authRoutes } from './auth'
import { commonRoutes } from './common'
import { systemRoutes } from './system'

export const appRoutes = [...authRoutes, ...systemRoutes, ...commonRoutes]
