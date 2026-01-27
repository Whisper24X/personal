import Taro from "@tarojs/taro"
import { useUserStore } from "../store/userStore"

// 需要登录才能访问的页面
const authPages = [
  "/pages/user/profile/index",
  "/pages/order/index",
  "/pages/cart/index",
  "/pages/reservation/index",
  "/pages/reservation-new/index",
  "/pages/reservation-detail/index"
  // 添加其他需要登录的页面
]

// 不需要登录就能访问的页面
const publicPages = [
  "//pages/recommend/index/index",
  "/pages/user/login/index",
  "/pages/register/index",
  "/pages/study-room/detail"
  // 添加其他公开页面
]

// 检查页面是否需要登录
const checkNeedAuth = (url: string): boolean => {
  // 去掉可能存在的参数
  const path = url.split("?")[0]
  return authPages.some(page => path.startsWith(page))
}

// 路由守卫
export const routerGuard = (): void => {
  // 通用拦截器
  const routeInterceptor = function (chain) {
    const requestParams = chain.requestParams
    const { url } = requestParams
    const userStore = useUserStore()

    if (checkNeedAuth(url) && !userStore.isLoggedIn) {
      // 需要登录但未登录，跳转到登录页
      const pages = Taro.getCurrentPages()
      const currentPage = pages[pages.length - 1]
      if (currentPage && currentPage.route === "/pages/user/login/index") {
        return
      }
      console.log("navigateTo IN routerGuard /pages/user/login/index")
      Taro.navigateTo({
        url: "/pages/user/login/index"
      })
      return
    }

    return chain.proceed(requestParams)
  }

  // 添加拦截器
  Taro.addInterceptor(routeInterceptor)
}
