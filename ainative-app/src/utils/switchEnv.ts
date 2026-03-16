import Taro from "@tarojs/taro"
import { CURRENT_ENV, IS_DEV, IS_LOCAL } from "../config/env"

// 环境列表
const ENV_LIST = [
  { label: "本地联调(沙箱)", value: "local" },
  { label: "开发环境", value: "development" },
  { label: "测试环境", value: "test" },
  { label: "预发布环境", value: "stage" },
  { label: "生产环境", value: "production" }
]

// 切换环境（注：API 地址由构建时 mode 决定，运行时切换需重新编译）
export const switchEnv = () => {
  // 仅在开发/本地模式下可用
  if (!IS_DEV && !IS_LOCAL) {
    console.log("仅在开发模式下可切换环境")
    return
  }

  Taro.showActionSheet({
    itemList: ENV_LIST.map(item => `${item.label}${item.value === CURRENT_ENV ? "(当前)" : ""}`),
    success: res => {
      const selectedEnv = ENV_LIST[res.tapIndex].value

      // 保存选择的环境
      Taro.setStorageSync("SELECTED_ENV", selectedEnv)

      // 重启应用
      Taro.showModal({
        title: "提示",
        content: `已切换到${ENV_LIST[res.tapIndex].label}，需要重启应用才能生效`,
        showCancel: false,
        success: () => {
          // 在真机上无法自动重启，只能提示用户手动重启
          Taro.reLaunch({
            url: "/pages/user/login/index"
          })
        }
      })
    }
  })
}
