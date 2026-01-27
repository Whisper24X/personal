import Taro from "@tarojs/taro"
import config from "../config/index"

/**
 * 根据环境变量和接口名称获取接口地址
 * @param {string} env
 * @param {string} apiName
 * @returns
 */
export const getApiUrl = (env: string, apiName: string): string => {
  let url = config[env]?.[apiName] || ""
  if (!url) {
    throw new Error("环境变量参数或接口名称不正确，导致无法获取到接口地址～")
  }
  return url
}

/**
 * 将对象展开后组合成一个query字符串
 * @param {object} obj
 * @param {string} symbol
 */
export const getUrlParamsByObject = (obj: Record<string, any>, symbol: string = "?"): string => {
  if (Object.prototype.toString.call(obj).slice(8, -1) !== "Object") {
    return ""
  }
  let kvArray: string[] = []
  for (let name in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, name)) {
      kvArray.push(name + "=" + obj[name])
    }
  }
  return symbol + kvArray.join("&")
}

/**
 * 生成唯一guid
 * @returns
 */
export const genGuid = (): string => {
  return (
    new Date().getTime().toString(16) +
    "-" +
    (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
  )
}

/**
 * 计算文件hash值（小程序环境简化版）
 * @param {any} file
 * @returns
 */
export function fileHash(file: any): Promise<string> {
  return new Promise(resolve => {
    // 小程序环境下简化hash计算，使用文件名+时间戳+随机数
    const hash = `${file.name || "file"}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    resolve(hash)
  })
}

/**
 * 生成文件名称的方法
 * @param {number} fileNameType 1, 2, 3, 4 文件名称类型
 * @param {any} file 文件
 * */
export async function genFileName(fileNameType: number = 3, file: any): Promise<string> {
  let name = ""
  let dotIndex = ""
  let hash: string = ""

  if (fileNameType === 2 || fileNameType === 3 || fileNameType === 4) {
    hash = await fileHash(file)
  }

  switch (fileNameType) {
    case 1:
      name = file?.name || ""
      break
    case 2:
      dotIndex = file.name.lastIndexOf(".")
      name = `${file.name.slice(0, dotIndex)}-${hash}${file.name.slice(dotIndex)}`
      break
    case 3:
      name = hash
      break
    case 4:
      dotIndex = file.name.lastIndexOf(".")
      name = `${hash}${file.name.slice(dotIndex)}`
      break
  }
  return name
}

/**
 * 第五种文件名称生成方法
 * @param {string} originFileName 源文件名称
 * */
export function genFileNameOfType5(originFileName: string): string {
  const dotIndex = originFileName.lastIndexOf(".")
  return `${originFileName.slice(0, dotIndex)}-${Date.now().toString(36)}${originFileName.slice(dotIndex)}`
}

/**
 * 网络请求方法（Taro版本）
 * @param {object} config
 * @returns
 */
export function httpRequest(config: {
  method: string
  url: string
  headers?: Record<string, string>
  data?: any
  responseType?: "text" | "arraybuffer"
}): Promise<any> {
  return new Promise((resolve, reject) => {
    const { method, url, headers = {}, data, responseType = "text" } = config

    Taro.request({
      method: method as any,
      url,
      header: headers,
      data,
      responseType,
      success: res => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(res.data)
        }
      },
      fail: error => {
        reject(error)
      }
    })
  })
}

// 简单的一个浅拷贝方法
export function clone<T>(data: T): T {
  if (typeof data !== "object") return data
  if (Array.isArray(data)) {
    return data.map(d => ({ ...d })) as T
  } else {
    return { ...data } as T
  }
}

// 判断是否需要压缩
export function needCompress(compress?: any): boolean {
  if (typeof compress !== "object") return false
  return (compress.quality || 0) > 0
}

// 判断一个变量是否为无
export function isNil(val: any): boolean {
  return val === undefined || val === null
}

// 导出文件类型检测工具
export * from "./fileTypeDetector"

// 导出图片格式转换工具
export * from "./imageConverter"
