/**
 * 图片格式转换工具
 * 用于在 Taro 环境下进行图片格式转换
 */

import Taro from "@tarojs/taro"

export interface ConvertOptions {
  quality?: number // 转换质量，0-100
  width?: number // 目标宽度
  height?: number // 目标高度
  format?: "jpg" | "png" | "webp" // 目标格式
}

export interface ConvertResult {
  tempFilePath: string
  size: number
  width: number
  height: number
}

/**
 * 将图片转换为指定格式
 * @param tempFilePath 临时文件路径
 * @param options 转换选项
 * @returns 转换结果
 */
export async function convertImageFormat(
  tempFilePath: string,
  options: ConvertOptions = {}
): Promise<ConvertResult> {
  const { quality = 85, width, height } = options

  try {
    // 使用 Taro.compressImage 进行图片压缩和格式转换
    const compressResult = await Taro.compressImage({
      src: tempFilePath,
      quality: quality / 100, // Taro 的 quality 是 0-1 之间的值
      ...(width && height && { width, height })
    })

    // 获取转换后的文件信息
    const fileInfo = await Taro.getFileInfo({
      filePath: compressResult.tempFilePath
    })

    return {
      tempFilePath: compressResult.tempFilePath,
      size: (fileInfo as any).size || 0,
      width: (fileInfo as any).width || 0,
      height: (fileInfo as any).height || 0
    }
  } catch (error) {
    console.error("图片格式转换失败:", error)
    throw new Error(`图片格式转换失败: ${error.message || error}`)
  }
}

/**
 * 批量转换图片格式
 * @param tempFilePaths 临时文件路径数组
 * @param options 转换选项
 * @returns 转换结果数组
 */
export async function convertImageFormats(
  tempFilePaths: string[],
  options: ConvertOptions = {}
): Promise<ConvertResult[]> {
  const results: ConvertResult[] = []

  for (const tempFilePath of tempFilePaths) {
    try {
      const result = await convertImageFormat(tempFilePath, options)
      results.push(result)
    } catch (error) {
      console.error(`转换文件失败 ${tempFilePath}:`, error)
      // 如果转换失败，使用原文件
      const fileInfo = await Taro.getFileInfo({ filePath: tempFilePath })
      results.push({
        tempFilePath,
        size: (fileInfo as any).size || 0,
        width: (fileInfo as any).width || 0,
        height: (fileInfo as any).height || 0
      })
    }
  }

  return results
}

/**
 * 根据目标格式获取文件扩展名
 * @param format 目标格式
 * @returns 文件扩展名
 */
export function getFileExtension(format: string): string {
  const formatMap: Record<string, string> = {
    jpg: "jpg",
    jpeg: "jpg",
    png: "png",
    webp: "webp",
    gif: "gif",
    bmp: "bmp"
  }

  return formatMap[format.toLowerCase()] || "jpg"
}

/**
 * 根据目标格式获取 MIME 类型
 * @param format 目标格式
 * @returns MIME 类型
 */
export function getMimeType(format: string): string {
  const mimeTypeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp"
  }

  return mimeTypeMap[format.toLowerCase()] || "image/jpeg"
}

/**
 * 检查是否需要格式转换
 * @param originalFormat 原始格式
 * @param targetFormat 目标格式
 * @returns 是否需要转换
 */
export function needsConversion(originalFormat: string, targetFormat: string): boolean {
  return originalFormat.toLowerCase() !== targetFormat.toLowerCase()
}
