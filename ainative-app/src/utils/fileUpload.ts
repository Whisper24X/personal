import Taro from "@tarojs/taro"
import { postOssToken } from "../api/upload"
import { handleTaroFileUpload, chooseAndUploadFiles, type UploadFile } from "./upload"
import { CURRENT_ENV } from "@/config/env"

// 上传参数配置
export const uploadParams = {
  env: CURRENT_ENV,
  getToken: async () => {
    try {
      const res = await postOssToken()
      return res?.data?.token
    } catch (error) {
      console.error("获取上传token失败", error)
      throw new Error("获取上传token失败")
    }
  }
}

// 文件上传配置接口
export interface FileUploadConfig {
  autoFilePaths?: string[] | null
  filePath?: string
  enableCompress?: boolean
  compressOptions?: {
    quality?: number // 压缩质量，必须是整数，取值范围：0-100
    maxSize?: number
    width?: number
    height?: number
  }
  count?: number
  sizeType?: ("original" | "compressed")[]
  sourceType?: ("album" | "camera")[]
  limit?: number
  size?: number
  bucket?: string
}

// 默认配置
const defaultConfig: FileUploadConfig = {
  autoFilePaths: null,
  filePath: "yanxue/feedback",
  enableCompress: false,
  compressOptions: {
    quality: 85, // 压缩质量，整数，取值范围：0-100
    maxSize: 1000,
    width: 800,
    height: 600
  },
  count: 1,
  sizeType: ["compressed"],
  sourceType: ["album", "camera"],
  limit: 9,
  size: 2 * 1024 * 1024, // 2MB
  bucket: "onionpad-cloud-control-large"
}

/**
 * 单文件上传工具方法
 * @param config 上传配置
 * @returns Promise<UploadFile>
 */
export const fileUpload = async (config: FileUploadConfig = {}): Promise<UploadFile> => {
  const finalConfig = { ...defaultConfig, ...config }

  try {
    // 如果指定了不同的bucket，需要重新获取token
    const getToken =
      config.bucket && config.bucket !== defaultConfig.bucket
        ? async () => {
            try {
              const res = await postOssToken(config.bucket)
              return res?.data?.data?.token
            } catch (error) {
              console.error("获取上传token失败", error)
              throw new Error("获取上传token失败")
            }
          }
        : uploadParams.getToken

    const file = await handleTaroFileUpload({
      autoFilePaths: finalConfig.autoFilePaths,
      filePath: finalConfig.filePath,
      enableCompress: finalConfig.enableCompress,
      compressOptions: finalConfig.compressOptions,
      count: finalConfig.count,
      sizeType: finalConfig.sizeType,
      sourceType: finalConfig.sourceType,
      limit: finalConfig.limit,
      size: finalConfig.size,
      env: uploadParams.env,
      getToken
    })

    return file
  } catch (error) {
    console.error("文件上传失败:", error)
    Taro.showToast({
      title: "文件上传失败",
      icon: "none"
    })
    throw error
  }
}

/**
 * 多文件上传工具方法
 * @param config 上传配置
 * @returns Promise<UploadFile[]>
 */
export const fileUploadMultiple = async (config: FileUploadConfig = {}): Promise<UploadFile[]> => {
  const finalConfig = { ...defaultConfig, ...config }

  try {
    // 如果指定了不同的bucket，需要重新获取token
    const getToken =
      config.bucket && config.bucket !== defaultConfig.bucket
        ? async () => {
            try {
              const res = await postOssToken(config.bucket)
              return res?.data?.data?.token
            } catch (error) {
              console.error("获取上传token失败", error)
              throw new Error("获取上传token失败")
            }
          }
        : uploadParams.getToken

    const files = await chooseAndUploadFiles({
      autoFilePaths: finalConfig.autoFilePaths,
      count: finalConfig.count,
      sizeType: finalConfig.sizeType,
      sourceType: finalConfig.sourceType,
      limit: finalConfig.limit,
      size: finalConfig.size,
      filePath: finalConfig.filePath,
      env: uploadParams.env,
      getToken,
      compress: finalConfig.enableCompress ? finalConfig.compressOptions : undefined,
      fileUploadProgressHandler: (_, file) => {
        console.log(`文件 ${file.name} 上传进度: ${file.percentage}%`)
      }
    })

    return files
  } catch (error) {
    console.error("批量文件上传失败:", error)
    Taro.showToast({
      title: "批量文件上传失败",
      icon: "none"
    })
    throw error
  }
}

/**
 * 图片上传工具方法（专门用于图片上传）
 * @param config 上传配置
 * @returns Promise<UploadFile>
 */
export const imageUpload = async (
  config: Omit<FileUploadConfig, "sourceType"> = {}
): Promise<UploadFile> => {
  return fileUpload({
    ...config,
    sourceType: ["album", "camera"],
    sizeType: ["compressed"],
    // 确保压缩选项中的 quality 是整数
    compressOptions: config.compressOptions
      ? {
          ...config.compressOptions,
          quality: config.compressOptions.quality ? Math.round(config.compressOptions.quality) : 85
        }
      : undefined
  })
}

/**
 * 头像上传工具方法
 * @param config 上传配置
 * @returns Promise<UploadFile>
 */
export const avatarUpload = async (
  config: Omit<FileUploadConfig, "filePath" | "compressOptions"> = {}
): Promise<UploadFile> => {
  return fileUpload({
    ...config,
    filePath: "yanxue/avatar",
    compressOptions: {
      quality: 90, // 压缩质量，整数，取值范围：0-100
      maxSize: 500,
      width: 200,
      height: 200
    },
    count: 1,
    limit: 1
  })
}

/**
 * 反馈图片上传工具方法
 * @param config 上传配置
 * @returns Promise<UploadFile[]>
 */
export const feedbackImageUpload = async (
  config: Omit<FileUploadConfig, "filePath"> = {}
): Promise<UploadFile[]> => {
  return fileUploadMultiple({
    ...config,
    filePath: "yanxue/feedback",
    compressOptions: {
      quality: 85, // 压缩质量，整数，取值范围：0-100
      maxSize: 1000,
      width: 800,
      height: 600
    }
  })
}

/**
 * 课程评价图片上传工具方法
 * @param config 上传配置
 * @returns Promise<UploadFile[]>
 */
export const courseEvaluationImageUpload = async (
  config: Omit<FileUploadConfig, "filePath"> = {}
): Promise<UploadFile[]> => {
  return fileUploadMultiple({
    ...config,
    filePath: "yanxue/user/evaluation",
    compressOptions: {
      quality: 85, // 压缩质量，整数，取值范围：0-100
      maxSize: 1000,
      width: 800,
      height: 600
    }
  })
}

// 导出类型
export type { UploadFile }

// 导出默认配置
export { defaultConfig }
