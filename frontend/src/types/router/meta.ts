export type UserPermission = string

export type AppRouteMeta = {
  title: string
  layout?: 'default' | 'auth' | 'business-line' | 'workspace-page'
  contentMode?: 'container' | 'full'
  requiresAuth?: boolean
  permissions?: UserPermission[]
  capabilities?: string[]
  keepAlive?: boolean
}
