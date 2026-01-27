import type { RouteRecordRaw } from 'vue-router'
import type { PermissionRule } from '@/service/permission.service'
import { RuleType } from '@/service/permission.service'

import { useUserStore } from '@/store/modules/userStore'

/**
 * 通过递归获取路由列表中的path
 * @param routes 路由列表
 * @returns 路由path列表
 */
export function getRoutePaths(routes: RouteRecordRaw[]): string[] {
  const paths: string[] = []

  function getPaths(routes: RouteRecordRaw[], parentPath: string = '/') {
    routes.forEach((route) => {
      if (route.path) {
        const fullPath = route.path.startsWith('/')
          ? route.path
          : `${parentPath}/${route.path}`.replace(/\/+/g, '/')
        paths.push(fullPath)
      }
      if (route.children?.length) {
        getPaths(
          route.children,
          route.path.startsWith('/')
            ? route.path
            : `${parentPath}/${route.path}`.replace(/\/+/g, '/'),
        )
      }
    })
  }

  getPaths(routes)
  return paths
}

/**
 * 递归过滤路由
 */
export function filterAsyncRoutes(
  routes: RouteRecordRaw[],
  permissions: PermissionRule[],
  parentPath: string = '/',
): RouteRecordRaw[] {
  const res: RouteRecordRaw[] = []

  routes.forEach((route) => {
    const tmp = { ...route }
    // 构建完整的路由路径
    const fullPath = parentPath
      ? `${parentPath}/${tmp.path}`.replace(/\/+/g, '/') // 处理可能的多余斜杠
      : tmp.path

    // 检查是否有权限
    const hasPermission =
      route.meta?.ignoreAuth || checkPathPermission(fullPath, permissions)

    if (hasPermission) {
      // 如果有子路由，递归处理，传入当前完整路径作为父级路径
      if (tmp.children) {
        const children = filterAsyncRoutes(tmp.children, permissions, fullPath)
        // 只有当子路由不为空或当前路由本身就是叶子节点时才添加
        if (children.length > 0 || !tmp.children.length) {
          tmp.children = children
          res.push(tmp)
        }
      } else {
        res.push(tmp)
      }
    }
  })

  return res
}

/**
 * 检查单个路由是否有权限 - 递归检查权限树
 */
export function checkPathPermission(
  routePath: string,
  permissions: PermissionRule[],
): boolean {
  if (!routePath) return true

  // 确保路径以 / 开头
  const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`

  // 递归检查权限树
  const checkPermissionRecursive = (items: PermissionRule[]): boolean => {
    for (const permission of items) {
      // 检查当前节点
      if (permission.path === normalizedPath) {
        return true
      }
      // 递归检查子节点
      if (permission.children && permission.children.length > 0) {
        if (checkPermissionRecursive(permission.children)) {
          return true
        }
      }
    }
    return false
  }

  return checkPermissionRecursive(permissions)
}

/**
 * 获取第一个可用路由
 */
export function getFirstAvailableRoute(routes: RouteRecordRaw[]): string {
  // 递归查找第一个可用的叶子节点路由
  const findFirstLeafRoute = (routes: RouteRecordRaw[]): string => {
    for (const route of routes) {
      // 如果是叶子节点且有组件,返回完整路径
      if (!route.children?.length && route.component) {
        return route.path
      }
      // 如果有子节点,递归查找
      if (route.children?.length) {
        const childPath = findFirstLeafRoute(route.children)
        if (childPath) {
          // 拼接完整路径
          return route.path.endsWith('/')
            ? `${route.path}${childPath}`
            : `${route.path}/${childPath}`
        }
      }
    }
    return ''
  }

  const firstRoute = findFirstLeafRoute(routes)
  return firstRoute || '/404'
}

/**
 * 获取所有按钮权限
 */
export function getButtonPermissions(permissions: PermissionRule[]): string[] {
  const btns: string[] = []

  const traverse = (items: PermissionRule[]) => {
    items.forEach((item) => {
      if (item.type === RuleType.页面按钮) {
        btns.push(item.path)
      }
      if (item.children && item.children.length > 0) {
        traverse(item.children)
      }
    })
  }

  traverse(permissions)
  return btns
}

/**
 * 检查按钮权限
 */
export function checkButtonAuth(permissions: string | string[]): boolean {
  const userAuth = useUserStore().btns
  let arr: string[] = []
  if (!Array.isArray(permissions)) {
    arr = [permissions]
  } else {
    arr = permissions
  }
  return arr.some((item) => userAuth.includes(item))
}
