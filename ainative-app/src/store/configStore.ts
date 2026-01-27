import { defineStore } from "pinia"
import { getTripConfig } from "@/api/tripConfig"

interface ConfigState {
  isShowVideo: string
  defaultServiceQrCodeUrl: string
  isLoading: boolean
}

export const useConfigStore = defineStore("config", {
  state: (): ConfigState => ({
    isShowVideo: "false",
    defaultServiceQrCodeUrl: "",
    isLoading: false
  }),

  actions: {
    // 获取 isShowVideo 配置
    async fetchIsShowVideoConfig() {
      try {
        this.isLoading = true
        const response = await getTripConfig("reveiwConfig")
        const config = response.list[0].data.find((item: any) => item.name === "isShowVideo")
        if (config) {
          this.isShowVideo = config.value
        }
      } catch (error) {
        console.error("获取 isShowVideo 配置失败:", error)
      } finally {
        this.isLoading = false
      }
    },

    // 获取默认客服二维码
    async fetchDefaultServiceQrCode() {
      try {
        this.isLoading = true
        const response = await getTripConfig("travelDefaultServiceQrCodeConfigV2")
        const data = response.list[0].data[0]
        if (data?.defaultServiceQrCodeUrl) {
          this.defaultServiceQrCodeUrl = data.defaultServiceQrCodeUrl
        }
      } catch (error) {
        console.error("获取默认客服二维码失败:", error)
      } finally {
        this.isLoading = false
      }
    },

    // 初始化所有配置
    async initAllConfigs() {
      await Promise.all([this.fetchIsShowVideoConfig(), this.fetchDefaultServiceQrCode()])
    }
  },

  persist: true
})
