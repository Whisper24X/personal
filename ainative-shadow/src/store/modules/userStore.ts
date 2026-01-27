import { defineStore } from 'pinia'
import { RouteRecordRaw, Router } from 'vue-router'
import {
  postLogin,
  postLogout,
  getUserInfo,
  getUserPermission,
  changePassword,
} from '@/service/user.service'
import { getToken, resetToken, setToken } from '@/utils/token'
import { getDeptDialog, resetDeptDialog, setDeptDialog } from '@/utils/deptDialog'
import { getShopsDialog, resetShopsDialog, setShopsDialog } from '@/utils/shopsDialog'
import type { ChangePasswordParams, LoginParams, UserInfo } from '@/types/login'
import type { PermissionRule } from '@/service/permission.service'
import { RuleType } from '@/service/permission.service'
import { asyncRoutes } from '@/routers/modules/index'
import {
  getRoutePaths,
  filterAsyncRoutes,
  getButtonPermissions,
  getFirstAvailableRoute,
} from '@/utils/permission'
import type { PermissionDept } from '@/types/login'
export const useUserStore = defineStore('userStore', {
  state: () => ({
    token: getToken() || '',
    info: (JSON.parse(localStorage.getItem('info') || '{}') ||
      null) as UserInfo | null,
    authInited: false,
    btns: [] as string[], // 按钮权限列表
    menus: [] as RouteRecordRaw[], // 菜单权限列表
    selectDepts: getDeptDialog() ? JSON.parse(getDeptDialog() || '[]') : [] as string[], // 选中的部门ID列表
    selectedShops: getShopsDialog() ? JSON.parse(getShopsDialog() || '[]') : [] as string[], // 选中的店铺ID列表
  }),
  actions: {
    async login(params: LoginParams) {
      const result = await postLogin(params)
      this.token = result?.token
      setToken(this.token)

      const { info } = await getUserInfo()
      this.info = info
      localStorage.setItem('info', JSON.stringify(info))
    },

    async logout() {
      await postLogout()
      this.reset()
    },

    // 获取用户信息和权限
    async getUserPermissions(router: Router) {
      try {
        this.authInited = true
        const { list: permissions } = await getUserPermission()

        // 处理权限信息
        this.handlePermissions(permissions, router)
      } catch (error) {
        this.authInited = false
        console.error('获取用户信息失败：', error)
      }
    },

    // 处理权限信息
    handlePermissions(permissions: PermissionRule[], router: Router) {
      // 清空现有权限
      this.btns = []
      this.menus = []

      // 处理按钮权限
      this.btns = getButtonPermissions(permissions)

      // 处理菜单权限
      const menuPermissions = permissions.filter(
        (item) =>
          item.type === RuleType.菜单目录 || item.type === RuleType.菜单项,
      )

      // 过滤有权限的路由
      this.menus = filterAsyncRoutes(asyncRoutes || [], menuPermissions)

      // 动态添加路由
      this.menus.forEach((route) => {
        if (!router.hasRoute(route.name!)) {
          router.addRoute('Layout', route)
        }
      })

      // 添加404路由
      router.addRoute({
        path: '/:pathMatch(.*)*',
        redirect: '/404',
      })
      //////////
    },

    /**
     * 检查路由是否需要添加到菜单中
     * @param routePath 路由path
     * @returns 是否需要添加到菜单中
     */
    getRouteByPath(routePath: string): boolean {
      const allPaths = getRoutePaths(asyncRoutes || [])
      const menuPaths = getRoutePaths(this.menus)
      console.group('getRouteByPath')
      console.log('allPaths', allPaths)
      console.log('menuPaths', menuPaths)
      console.log('routePath', routePath)
      console.log('allPaths.includes(routePath)', allPaths.includes(routePath))
      console.log(
        '!menuPaths.includes(routePath)',
        !menuPaths.includes(routePath),
      )
      console.groupEnd()
      return allPaths.includes(routePath) && !menuPaths.includes(routePath)
    },

    // 检查按钮权限
    hasButtonPermission(btnPath: string): boolean {
      return this.btns.includes(btnPath)
    },

    // 获取第一个可用路由
    getFirstAvailableRoute(): string {
      const path = getFirstAvailableRoute(this.menus)
      console.log('getFirstAvailableRoute', path)
      return path
    },

    reset() {
      this.info = null
      this.btns = []
      this.menus = []
      this.authInited = false
      this.token = ''
      resetToken()
      resetDeptDialog()
      resetShopsDialog()
      localStorage.removeItem('info')
      this.selectDepts = []
      this.selectedShops = []
      console.log('store reset over1')
    },

    async changePassword(params: ChangePasswordParams) {
      await changePassword(params)
      // 更新用户信息中的 isChangePwd 状态
      if (this.info) {
        this.info.isChangePwd = true
        localStorage.setItem('info', JSON.stringify(this.info))
      }
    },

    // 更新选中的部门列表
    updateSelectDepts(deptIds: string[], allDepts: PermissionDept[]) {
      console.log('updateSelectDepts', deptIds)
      this.selectDepts = deptIds
      setDeptDialog(JSON.stringify(deptIds))

      // 判断节点是否在选中列表中
      const isNodeSelected = (dept: PermissionDept): boolean => {
        return deptIds.includes(dept.id)
      }

      // 获取所有叶子节点并过滤
      const getFilteredLeafIds = (depts: PermissionDept[]): string[] => {
        const leafIds: string[] = []

        const traverse = (
          dept: PermissionDept,
          parentSelected: boolean = false,
        ) => {
          // 如果当前节点被选中,则它下面所有叶子节点都要被选中
          const isCurrentSelected = isNodeSelected(dept)
          const shouldInclude = isCurrentSelected || parentSelected

          if (!dept.children || dept.children.length === 0) {
            // 是叶子节点,且满足选中条件则添加
            if (shouldInclude) {
              leafIds.push(dept.id)
            }
          } else {
            // 不是叶子节点,继续遍历子节点
            // 如果当前节点被选中,则其下所有子节点都应该被选中
            dept.children.forEach((child) => {
              traverse(child, shouldInclude)
            })
          }
        }

        // 遍历所有部门
        depts.forEach((dept) => traverse(dept))

        return leafIds
      }

      // 更新选中的门店ID列表
      this.selectedShops = getFilteredLeafIds(allDepts)
      setShopsDialog(JSON.stringify(this.selectedShops))
    },
  },
})
