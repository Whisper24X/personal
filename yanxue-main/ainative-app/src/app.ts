import { createApp } from "vue"
import { createPinia } from "pinia"
import { routerGuard } from "./utils/routerGuard"
import EnvIndicator from "./components/EnvIndicator.vue"
import { useTabBarStore } from "./store/tabBarStore"
import { useUserStore } from "./store/userStore"
import { useConfigStore } from "./store/configStore"
import Taro from "@tarojs/taro"
import { initAnalytics, vTrack, vTrackView } from "./utils/analytics"
import { IS_LOCAL, IS_PROD } from "./config/env"
import "@tarojs/components/global.css"

// 动态注入字体（失败时静默忽略，避免未配置 downloadFile 合法域名时报错阻断）
const fontMaps = {
  AlibabaPuHuiTi_2_55_Regular: "https://fp.yangcong345.com/AlibabaPuHuiTi-2-55-Regular.otf",
  AlibabaPuHuiTi_2_105_Heavy: "https://fp.yangcong345.com/AlibabaPuHuiTi-2-105-Heavy.otf"
}
Object.keys(fontMaps).forEach(font => {
  Taro.loadFontFace({
    global: true,
    family: font,
    source: `url("${fontMaps[font]}")`
  }).catch(() => {
    // 字体加载失败时使用系统默认字体，不影响功能
  })
})

import "./app.less"

// 初始化 PageSpy - 仅在非生产环境且微信小程序环境下启用（H5 无 wx 会报错，需动态导入避免模块加载时访问 wx）
if (!IS_PROD && process.env.TARO_ENV !== "h5") {
  import("@huolala-tech/page-spy-wechat").then(({ default: PageSpy }) => {
    const pageSpy = new PageSpy({
      api: "pagespy.yc345.tv",
      project: "trip-miniprogram"
    })
    console.log("PageSpy 初始化完成", pageSpy.getDebugLink())
  })
}
console.log("IS_PROD---------->", IS_PROD)
console.log("ENV_TYPE---------->", __ENV_TYPE)
// 初始化路由守卫
routerGuard()

const App = createApp({
  onShow(options) {
    console.log("App onShow", options)

    // 处理扫码场景 - 优惠券领取
    if (options) {
      const query = options.query || {}
      const couponId = query.couponId || ""

      if (couponId) {
        console.log("检测到扫码进入，优惠券ID:", couponId)
        // 跳转到优惠券商品页面，自动领取
        setTimeout(() => {
          Taro.redirectTo({
            url: `/pages/coupon/products/index?couponId=${couponId}&fromScan=true`
          })
        }, 100)
      }
    }
  },
  onLaunch(options) {
    console.log("App onLaunch", options)

    // 处理扫码场景 - 优惠券领取
    if (options) {
      const query = options.query || {}
      const couponId = query.couponId || ""

      if (couponId) {
        console.log("启动时检测到扫码进入，优惠券ID:", couponId)
      }
    }
  }
  // 入口组件不需要实现 render 方法，即使实现了也会被 taro 所覆盖
})

// 创建并使用Pinia
const pinia = createPinia()
App.use(pinia)

// 注册全局组件
App.component("EnvIndicator", EnvIndicator)

// 注册全局埋点指令
App.directive("track", vTrack)
App.directive("trackView", vTrackView)

// 初始化数据采集分析
initAnalytics({
  enabled: true,
  enableInDev: true,
  debug: process.env.NODE_ENV === "development",
  getUserInfo: () => {
    try {
      const userStore = useUserStore()
      if (userStore.isLoggedIn && userStore.userInfo) {
        return {
          userId: userStore.userInfo.id || userStore.userInfo.userId,
          nickname: userStore.userInfo.nickname || userStore.userInfo.name
        }
      }
    } catch (error) {
      console.warn("获取用户信息失败:", error)
    }
    return null
  }
})

// 初始化后注册页面显示事件，用于更新TabBar状态
setTimeout(() => {
  const tabBarStore = useTabBarStore()
  const userStore = useUserStore()
  const configStore = useConfigStore()

  // H5 本地联调：注入固定 dev token，便于 H5 无法微信登录时访问所有页面
  if (IS_LOCAL && process.env.TARO_ENV === "h5" && !userStore.token) {
    userStore.setToken("h5-dev-local-token")
    console.log("[H5 本地联调] 已注入 dev token，可访问需登录页面")
  }

  Taro.eventCenter.on("PAGE_SHOW", () => {
    console.log("页面显示，更新TabBar状态")
    tabBarStore.updateTabByCurrentPage()
  })

  // 初始化全局配置
  configStore.initAllConfigs().catch(error => {
    console.error("初始化全局配置失败:", error)
  })

  // 如果已登录，可以在这里执行初始化逻辑
  if (userStore.isLoggedIn) {
    console.log("用户已登录")
  }
}, 0)

export default App
