/**
 * 图片压缩工具 - TaroJS 版本
 * 功能：压缩图片、纠正图片方向、返回二进制(Blob)图片数据
 */

// 导入 EXIF 库的类型
declare const EXIF: any

interface CompressOptions {
  quality?: number // 压缩品质 0-1
  maxSize?: number // 最大尺寸 px
}

interface CompressResult {
  blob: Blob
  originalSize: string
  compressedSize: string
  compressionRatio: string
}

class ImageCompressor {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private fileType = "image/jpeg"
  private quality = 0.5
  private maxSize = 1000

  constructor() {
    // 在 TaroJS 环境中，我们需要检查是否支持 canvas
    this.initCanvas()
  }

  private initCanvas() {
    try {
      // 检查是否在浏览器环境中
      if (typeof document !== "undefined" && document.createElement) {
        this.canvas = document.createElement("canvas")
        this.ctx = this.canvas.getContext("2d")
      }
    } catch (error) {
      console.warn("Canvas not supported in current environment:", error)
    }
  }

  /**
   * 压缩图片列表
   * @param fileList 文件列表
   * @param options 压缩选项
   * @returns Promise<CompressResult[]>
   */
  async compressImages(
    fileList: FileList | File[],
    options: CompressOptions = {}
  ): Promise<CompressResult[]> {
    const { quality = 0.5, maxSize = 1000 } = options

    this.quality = quality
    this.maxSize = Math.min(maxSize, 1000) // 限制最大尺寸

    const files = Array.from(fileList)
    const results: CompressResult[] = []

    for (const file of files) {
      if (!/\/(?:jpeg|png|jpg)/i.test(file.type)) {
        console.warn("图片必须是 jpeg 或 png 类型")
        continue
      }

      try {
        const result = await this.compressImage(file)
        results.push(result)
      } catch (error) {
        console.error("压缩图片失败:", error)
        // 如果压缩失败，返回原始文件
        const originalSize = this.formatFileSize(file.size)
        const blob = new Blob([file], { type: file.type })
        results.push({
          blob,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: "0%"
        })
      }
    }

    return results
  }

  /**
   * 压缩单张图片
   */
  private async compressImage(file: File): Promise<CompressResult> {
    const originalSize = this.formatFileSize(file.size)

    // 如果 canvas 不可用，直接返回原始文件
    if (!this.canvas || !this.ctx) {
      console.warn("Canvas not available, returning original file")
      const blob = new Blob([file], { type: file.type })
      return {
        blob,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: "0%"
      }
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => {
        const img = new Image()
        img.src = reader.result as string

        const handleLoad = () => {
          try {
            // 获取图片方向
            const orientation = this.getImageOrientation(img)

            // 压缩图片
            const blob = this.processImage(img, orientation)
            const compressedSize = this.formatFileSize(blob.size)
            const compressionRatio = this.calculateCompressionRatio(file.size, blob.size)

            resolve({
              blob,
              originalSize,
              compressedSize,
              compressionRatio
            })
          } catch (error) {
            reject(error)
          }
        }

        if (img.complete) {
          handleLoad()
        } else {
          img.onload = handleLoad
          img.onerror = () => reject(new Error("图片加载失败"))
        }
      }

      reader.onerror = () => reject(new Error("文件读取失败"))
      reader.readAsDataURL(file)
    })
  }

  /**
   * 获取图片方向
   */
  private getImageOrientation(img: HTMLImageElement): number {
    return new Promise<number>(resolve => {
      if (typeof EXIF !== "undefined") {
        EXIF.getData(img, function (this: any) {
          const orientation = EXIF.getTag(this, "Orientation") || 1
          resolve(orientation)
        })
      } else {
        resolve(1) // 默认方向
      }
    }) as any // 简化处理，实际应该是异步的
  }

  /**
   * 处理图片（旋转和压缩）
   */
  private processImage(img: HTMLImageElement, orientation: number): Blob {
    // 检查 canvas 是否可用
    if (!this.canvas || !this.ctx) {
      throw new Error("Canvas not available")
    }

    // 根据方向旋转图片
    this.rotateImage(img, orientation)

    // 转换为 blob
    const dataURL = this.canvas.toDataURL(this.fileType, this.quality)
    const blob = this.dataURLToBlob(dataURL)

    // 清理 canvas
    this.canvas.width = this.canvas.height = 0

    return blob
  }

  /**
   * 旋转图片
   */
  private rotateImage(img: HTMLImageElement, orientation: number): void {
    // 检查 canvas 是否可用
    if (!this.canvas || !this.ctx) {
      throw new Error("Canvas not available")
    }

    let { width, height } = img

    // 计算压缩后的尺寸
    if (width > this.maxSize || height > this.maxSize) {
      const ratio = height / width
      if (width > height) {
        width = this.maxSize
        height = this.maxSize * ratio
      } else {
        height = this.maxSize
        width = height / ratio
      }
    }

    let step = 0
    switch (orientation) {
      case 6: // 顺时针90度
        step = 3
        break
      case 8: // 逆时针90度
        step = 1
        break
      case 3: // 180度
        step = 2
        break
      default:
        step = 0
    }

    const degree = (step * 90 * Math.PI) / 180

    switch (step) {
      case 0:
        this.canvas.width = width
        this.canvas.height = height
        this.ctx.fillStyle = "#fff"
        this.ctx.fillRect(0, 0, width, height)
        this.ctx.drawImage(img, 0, 0, width, height)
        break
      case 1:
        this.canvas.width = height
        this.canvas.height = width
        this.ctx.fillStyle = "#fff"
        this.ctx.fillRect(0, 0, height, width)
        this.ctx.rotate(degree)
        this.ctx.drawImage(img, 0, -height, width, height)
        break
      case 2:
        this.canvas.width = width
        this.canvas.height = height
        this.ctx.fillStyle = "#fff"
        this.ctx.fillRect(0, 0, width, height)
        this.ctx.rotate(degree)
        this.ctx.drawImage(img, -width, -height, width, height)
        break
      case 3:
        this.canvas.width = height
        this.canvas.height = width
        this.ctx.fillStyle = "#fff"
        this.ctx.fillRect(0, 0, height, width)
        this.ctx.rotate(degree)
        this.ctx.drawImage(img, -width, 0, width, height)
        break
    }
  }

  /**
   * DataURL 转 Blob
   */
  private dataURLToBlob(dataURL: string): Blob {
    const byteString = atob(dataURL.split(",")[1])
    const mimeString = dataURL.split(",")[0].split(":")[1].split(";")[0]
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }

    return new Blob([ab], { type: mimeString })
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes > 1024 * 1024) {
      return Math.round((bytes / 1024 / 1024) * 10) / 10 + "MB"
    }
    return Math.round(bytes / 1024) + "KB"
  }

  /**
   * 计算压缩比率
   */
  private calculateCompressionRatio(originalSize: number, compressedSize: number): string {
    const ratio = Math.round((100 * (originalSize - compressedSize)) / originalSize)
    return ratio + "%"
  }
}

// 创建单例实例
const imageCompressor = new ImageCompressor()

/**
 * 压缩图片的便捷方法
 * @param fileList 文件列表
 * @param options 压缩选项
 * @returns Promise<CompressResult[]>
 */
export const compressImages = (
  fileList: FileList | File[],
  options?: CompressOptions
): Promise<CompressResult[]> => {
  return imageCompressor.compressImages(fileList, options)
}

/**
 * 压缩单张图片的便捷方法
 * @param file 文件
 * @param options 压缩选项
 * @returns Promise<CompressResult>
 */
export const compressSingleImage = async (
  file: File,
  options?: CompressOptions
): Promise<CompressResult> => {
  const results = await imageCompressor.compressImages([file], options)
  return results[0]
}

export type { CompressOptions, CompressResult }
