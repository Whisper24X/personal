import { getTripConfig } from "@/api/tripConfig"

// 发现页面数据类型定义
export interface DiscoverItem {
  id: string
  title: string
  description: string
  thumbnail: string
  type: "banner" | "strategies" | "vlogs" | "moments"
  url: string
}

export interface DiscoverConfig {
  key: string
  data: DiscoverItem[]
}

export interface DiscoverResponse {
  list: DiscoverConfig[]
}

// 获取发现页面配置数据
export const getDiscoverConfig = async (): Promise<DiscoverResponse> => {
  return getTripConfig("discover")
}

// 根据类型过滤数据
export const filterDiscoverData = (data: DiscoverItem[], type: DiscoverItem["type"]) => {
  return data.filter(item => item.type === type)
}

// 获取横幅数据
export const getBannerData = (data: DiscoverItem[]) => {
  return filterDiscoverData(data, "banner")
}

// 获取攻略数据
export const getStrategiesData = (data: DiscoverItem[]) => {
  return filterDiscoverData(data, "strategies")
}

// 获取VLOG数据
export const getVlogsData = (data: DiscoverItem[]) => {
  return filterDiscoverData(data, "vlogs")
}

// 获取瞬间数据
export const getMomentsData = (data: DiscoverItem[]) => {
  return filterDiscoverData(data, "moments")
}
