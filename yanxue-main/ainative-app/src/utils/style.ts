import Taro from "@tarojs/taro"

// 使用新的API替代已废弃的getSystemInfoSync
const deviceInfo = Taro.getDeviceInfo()
const windowInfo = Taro.getWindowInfo()

// 是否为 iOS 设备
export const isIOS = deviceInfo.platform === "ios"

// 是否为 Android 设备
export const isAndroid = deviceInfo.platform === "android"

// 是否为 iPhone X 或以上机型（有安全区域）
export const isIPhoneX = /iPhone X|iPhone 11|iPhone 12|iPhone 13|iPhone 14|iPhone 15/i.test(
  deviceInfo.model
)

// 获取状态栏高度
export const statusBarHeight = windowInfo.statusBarHeight || 0

// 获取导航栏高度
export const navBarHeight = 44

//获取顶部区域高度
export const topAreaHeight = statusBarHeight + navBarHeight

// 获取安全区域
export const safeArea = windowInfo.safeArea || {
  bottom: windowInfo.screenHeight,
  height: windowInfo.screenHeight,
  left: 0,
  right: windowInfo.screenWidth,
  top: 0,
  width: windowInfo.screenWidth
}

// 底部安全区域高度
export const safeAreaBottom = windowInfo.screenHeight - safeArea.bottom

// 将 px 转换为 rpx
export function pxToRpx(px: number): number {
  return px * (750 / windowInfo.windowWidth)
}

// 将 rpx 转换为 px
export function rpxToPx(rpx: number): number {
  return rpx / (750 / windowInfo.windowWidth)
}

// 获取设备宽度
export function getDeviceWidth(): number {
  return windowInfo.windowWidth
}

// 获取适配后的样式
export function getAdaptiveStyle(options: {
  width?: number | string
  height?: number | string
  top?: number | string
  bottom?: number | string
  left?: number | string
  right?: number | string
}): Record<string, string> {
  const style: Record<string, string> = {}

  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (typeof value === "number") {
        style[key] = `${value}rpx`
      } else {
        style[key] = value
      }
    }
  })

  return style
}
