import { defineStore } from "pinia"
import { ref } from "vue"
import Taro from "@tarojs/taro"

export const useTabBarStore = defineStore("tabBar", () => {
  const currentTab = ref("home")

  function setCurrentTab(tab: string) {
    currentTab.value = tab
  }

  // 根据页面路径设置Tab
  function setTabByRoute(route: string) {
    if (route.includes("/pages/index/")) {
      setCurrentTab("home")
    } else if (route.includes("/pages/discover/")) {
      setCurrentTab("discover")
    } else if (route.includes("/pages/appointment/list/")) {
      setCurrentTab("appointment")
    } else if (route.includes("/pages/user/")) {
      setCurrentTab("user")
    }
  }

  // 更新当前页面的tab
  function updateTabByCurrentPage() {
    const pages = Taro.getCurrentPages()
    if (pages && pages.length > 0) {
      const currentPage = pages[pages.length - 1]
      const route = currentPage.route || currentPage.__route__
      if (route) {
        setTabByRoute(route)
      }
    }
  }

  return {
    currentTab,
    setCurrentTab,
    setTabByRoute,
    updateTabByCurrentPage
  }
})
