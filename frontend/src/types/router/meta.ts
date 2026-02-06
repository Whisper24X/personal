export type UserPermission = string

export type AppRouteMeta = {
  title: string
  layout?: 'default' | 'auth'
  requiresAuth?: boolean
  permissions?: UserPermission[]
  keepAlive?: boolean
}
