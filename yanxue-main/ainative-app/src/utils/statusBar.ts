import Taro from "@tarojs/taro"
import { topAreaHeight, pxToRpx } from "@/utils/style"
// 获取状态栏高度
export const getStatusBarHeight = () => {
  try {
    const windowInfo = Taro.getWindowInfo()
    return windowInfo.statusBarHeight || 20
  } catch (e) {
    console.error("获取系统信息失败", e)
    return 20 // 默认高度
  }
}

// 获取导航栏高度
export const getNavBarHeight = () => {
  return pxToRpx(topAreaHeight)
}

// 获取底部安全区域高度
export const getSafeAreaBottomHeight = () => {
  try {
    // 使用Taro.getWindowInfo获取窗口信息
    const windowInfo = Taro.getWindowInfo()

    // 如果存在safeArea信息，计算底部安全区域高度
    if (windowInfo.safeArea) {
      // 底部安全区域高度 = 屏幕高度 - 安全区域底部位置
      return windowInfo.screenHeight - windowInfo.safeArea.bottom || 0
    }

    // 如果没有safeArea信息，尝试获取系统信息
    const systemInfo = Taro.getSystemInfoSync()
    if (systemInfo.safeArea) {
      return systemInfo.screenHeight - systemInfo.safeArea.bottom || 0
    }

    // 如果都没有，则根据机型判断
    // iOS且是全面屏设备
    if (
      systemInfo.model &&
      systemInfo.model.includes("iPhone") &&
      (systemInfo.model.includes("X") ||
        systemInfo.model.includes("11") ||
        systemInfo.model.includes("12") ||
        systemInfo.model.includes("13") ||
        systemInfo.model.includes("14") ||
        systemInfo.model.includes("15"))
    ) {
      return 34 // iPhone全面屏的底部安全区域一般为34px
    }

    return 0 // 默认值
  } catch (e) {
    console.error("获取底部安全区域高度失败", e)
    return 0 // 出错时返回默认值
  }
}

// 设置状态栏高度CSS变量
export const setStatusBarHeightVar = () => {
  const statusBarHeight = getStatusBarHeight()
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--status-bar-height", `${statusBarHeight}px`)
  }
  return statusBarHeight
}

// 设置底部安全区域高度CSS变量
export const setSafeAreaBottomVar = () => {
  const safeAreaBottom = getSafeAreaBottomHeight()
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--safe-area-bottom", `${safeAreaBottom}px`)
  }
  return safeAreaBottom
}
