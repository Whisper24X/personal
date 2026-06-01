/**
 * 文件类型检测工具
 * 用于根据文件内容读取真实的文件类型
 */

import Taro from "@tarojs/taro"

export interface FileTypeInfo {
  ext: string
  mimeType: string
  isImage: boolean
}

/**
 * 通过文件内容读取真实的 mimeType
 * @param filePath 文件路径
 * @returns 文件类型信息
 */
export async function detectFileTypeFromPath(filePath: string): Promise<FileTypeInfo> {
  try {
    // 使用 Taro.getFileInfo 获取文件信息
    const fileInfo = await Taro.getFileInfo({
      filePath: filePath
    })

    // 尝试从文件信息中获取 mimeType
    if ((fileInfo as any).mimeType) {
      const mimeType = (fileInfo as any).mimeType
      const ext = getExtensionFromMimeType(mimeType)
      return {
        ext,
        mimeType,
        isImage: mimeType.startsWith("image/")
      }
    }

    // 如果无法获取 mimeType，尝试通过文件头判断
    return await detectFileTypeByHeader(filePath)
  } catch (error) {
    console.warn("无法读取文件信息，使用路径推断:", error)
    // 如果读取失败，回退到路径推断
    return detectFileTypeFromPathFallback(filePath)
  }
}

/**
 * 通过文件头判断文件类型
 * @param filePath 文件路径
 * @returns 文件类型信息
 */
async function detectFileTypeByHeader(filePath: string): Promise<FileTypeInfo> {
  try {
    // 读取文件的前几个字节来判断文件类型
    const fileSystemManager = Taro.getFileSystemManager()
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      fileSystemManager.readFile({
        filePath,
        success: res => resolve(res.data as ArrayBuffer),
        fail: reject
      })
    })

    // 读取文件头字节
    const uint8Array = new Uint8Array(arrayBuffer)
    const header = Array.from(uint8Array.slice(0, 12))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")

    // 根据文件头判断文件类型
    const fileType = detectFileTypeByMagicNumber(header)
    return fileType
  } catch (error) {
    console.warn("无法读取文件头，使用路径推断:", error)
    return detectFileTypeFromPathFallback(filePath)
  }
}

/**
 * 根据文件头魔数判断文件类型
 * @param header 文件头十六进制字符串
 * @returns 文件类型信息
 */
function detectFileTypeByMagicNumber(header: string): FileTypeInfo {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (header.startsWith("89504e470d0a1a0a")) {
    return { ext: "png", mimeType: "image/png", isImage: true }
  }

  // JPEG: FF D8 FF
  if (header.startsWith("ffd8ff")) {
    return { ext: "jpg", mimeType: "image/jpeg", isImage: true }
  }

  // GIF: 47 49 46 38 (GIF8)
  if (header.startsWith("47494638")) {
    return { ext: "gif", mimeType: "image/gif", isImage: true }
  }

  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50 (RIFF....WEBP)
  if (header.startsWith("52494646") && header.includes("57454250")) {
    return { ext: "webp", mimeType: "image/webp", isImage: true }
  }

  // BMP: 42 4D (BM)
  if (header.startsWith("424d")) {
    return { ext: "bmp", mimeType: "image/bmp", isImage: true }
  }

  // TIFF: 49 49 2A 00 (little endian) or 4D 4D 00 2A (big endian)
  if (header.startsWith("49492a00") || header.startsWith("4d4d002a")) {
    return { ext: "tiff", mimeType: "image/tiff", isImage: true }
  }

  // SVG: 检查是否包含 SVG 标签
  if (header.includes("3c737667") || header.includes("3c534756")) {
    return { ext: "svg", mimeType: "image/svg+xml", isImage: true }
  }

  // 默认返回 jpg
  return { ext: "jpg", mimeType: "image/jpeg", isImage: true }
}

/**
 * 根据 mimeType 获取文件扩展名
 * @param mimeType MIME 类型
 * @returns 文件扩展名
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
    "image/tiff": "tiff",
    "image/tif": "tiff"
  }

  return mimeToExt[mimeType.toLowerCase()] || "jpg"
}

/**
 * 路径推断的备用方法
 * @param filePath 文件路径
 * @returns 文件类型信息
 */
function detectFileTypeFromPathFallback(filePath: string): FileTypeInfo {
  const path = filePath.toLowerCase()

  // 图片格式检测
  if (path.includes(".png") || path.includes("png")) {
    return { ext: "png", mimeType: "image/png", isImage: true }
  }

  if (path.includes(".gif") || path.includes("gif")) {
    return { ext: "gif", mimeType: "image/gif", isImage: true }
  }

  if (path.includes(".webp") || path.includes("webp")) {
    return { ext: "webp", mimeType: "image/webp", isImage: true }
  }

  if (path.includes(".bmp") || path.includes("bmp")) {
    return { ext: "bmp", mimeType: "image/bmp", isImage: true }
  }

  if (path.includes(".svg") || path.includes("svg")) {
    return { ext: "svg", mimeType: "image/svg+xml", isImage: true }
  }

  if (path.includes(".tiff") || path.includes("tiff") || path.includes(".tif")) {
    return { ext: "tiff", mimeType: "image/tiff", isImage: true }
  }

  // 默认返回 jpg
  return { ext: "jpg", mimeType: "image/jpeg", isImage: true }
}

/**
 * 验证文件是否为有效的图片格式
 * @param filePath 文件路径
 * @returns 是否为有效图片
 */
export async function isValidImageFile(filePath: string): Promise<boolean> {
  const fileType = await detectFileTypeFromPath(filePath)
  return fileType.isImage
}

/**
 * 获取支持的文件格式列表
 * @returns 支持的文件格式
 */
export function getSupportedImageFormats(): string[] {
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tiff"]
}

/**
 * 检查文件格式是否被支持
 * @param filePath 文件路径
 * @returns 是否支持该格式
 */
export async function isSupportedImageFormat(filePath: string): Promise<boolean> {
  const fileType = await detectFileTypeFromPath(filePath)
  const supportedFormats = getSupportedImageFormats()
  return supportedFormats.includes(fileType.ext)
}
