import { createAppRouter } from './core/create-router'
import { installRouterGuards } from './guards'

const router = createAppRouter()
installRouterGuards(router)

export default router
