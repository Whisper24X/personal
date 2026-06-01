export type UserPermission = string

export type AppRouteMeta = {
  title: string
  layout?: 'default' | 'auth' | 'business-line' | 'workspace-page'
  contentMode?: 'container' | 'full'
  requiresAuth?: boolean
  permissions?: UserPermission[]
  capabilities?: string[]
  /** JWT 平台管理员（与后端 CurrentAccessDto.isAdmin 一致） */
  requiresPlatformAdmin?: boolean
  keepAlive?: boolean
}
