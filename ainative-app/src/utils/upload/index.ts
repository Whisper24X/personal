import Taro from "@tarojs/taro"
import {
  getApiUrl,
  genFileName,
  needCompress,
  clone,
  detectFileTypeFromPath,
  isSupportedImageFormat,
  convertImageFormats,
  getFileExtension,
  getMimeType
} from "./utils/index"
import limitLoad from "./uploadBase/http.pipe"

// 上传文件类型定义
export interface UploadFile {
  uid: string
  name: string
  size: number
  type: string
  status: "ready" | "uploading" | "success" | "fail" | "delete"
  percentage: number
  url: string
  filePath: string
  originFileName: string
  tempFilePath?: string
  abort?: () => void
}

// 压缩选项
export interface CompressOptions {
  width?: number
  height?: number
  quality?: number
  base64?: boolean
}

// 格式转换选项
export interface ConvertOptions {
  enableConvert?: boolean // 是否启用格式转换
  targetFormat?: "jpg" | "png" | "webp" // 目标格式
  convertQuality?: number // 转换质量，0-100
  convertWidth?: number // 转换后宽度
  convertHeight?: number // 转换后高度
}

// 上传配置选项
export interface UploadOptions {
  env: "test" | "stage" | "prod"
  getToken: () => Promise<string>
  filePath?: string
  fileNameType?: 1 | 2 | 3 | 4 | 5
  compress?: CompressOptions
  convert?: ConvertOptions
  fileUploadEndHandler?: (res: any, file: UploadFile, files: UploadFile[]) => void
  fileUploadProgressHandler?: (e: any, file: UploadFile, files: UploadFile[]) => void
  fileUploadErrorHandler?: (e: any, file: UploadFile, files: UploadFile[]) => void
  uploadFinish?: () => void
}

// 文件选择配置选项
export interface ChooseFileOptions {
  autoFilePaths?: string[] | null
  count?: number
  sizeType?: ("original" | "compressed")[]
  sourceType?: ("album" | "camera")[]
  limit?: number
  size?: number
  fileUploadLimit?: number
  exceedLimitHandler?: (files: UploadFile[]) => void
  exceedSizeHandler?: (file: UploadFile, files: UploadFile[]) => void
  beforeUploadBatchHandler?: (files: UploadFile[]) => void
  beforeUploadFileHandler?: (file: UploadFile, files: UploadFile[]) => Promise<any>
  fileUploadEndHandler?: (res: any, file: UploadFile, files: UploadFile[]) => void
  fileUploadProgressHandler?: (e: any, file: UploadFile, files: UploadFile[]) => void
  fileUploadErrorHandler?: (e: any, file: UploadFile, files: UploadFile[]) => void
  fileListSelectHandler?: (files: UploadFile[]) => Promise<any>
}

/**
 * 生成唯一ID
 */
export const genGuid = (): string => {
  return (
    new Date().getTime().toString(16) +
    "-" +
    (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
  )
}

/**
 * 单个文件上传
 */
export const uploadFile = async (file: UploadFile, options: UploadOptions): Promise<UploadFile> => {
  const {
    env,
    getToken,
    filePath = "",
    fileNameType = 2,
    compress,
    fileUploadProgressHandler = () => {}
  } = options

  if (/\s/.test(filePath) || /^\//.test(filePath) || !filePath) {
    throw new Error("filePath格式不正确")
  }

  return (async () => {
    const token = await getToken()

    if (!token || typeof token !== "string") {
      throw new Error("getToken返回值不是一个可用的token")
    }

    const url = getApiUrl(env, needCompress(compress) ? "uploadAndCompressApi" : "uploadApi")

    let name = ""
    if (fileNameType === 5) {
      name = file.name
    } else {
      name = await genFileName(fileNameType, { name: file.name })
    }

    return new Promise<UploadFile>((resolve, reject) => {
      const uploadTask = Taro.uploadFile({
        url,
        filePath: file.tempFilePath || "",
        name: "file",
        header: {
          "Content-Type": "multipart/form-data", // 此处需要设置为"multipart/form-data"格式
          Authorization: token
        },
        formData: {
          path: `${filePath ? filePath.replace(/(\/)?$/, "/") : filePath}${name}`,
          ...(needCompress(compress) &&
            compress && {
              ...(compress.width && { width: compress.width.toString() }),
              ...(compress.height && { height: compress.height.toString() }),
              ...(compress.quality && { quality: compress.quality.toString() }),
              ...(compress.base64 !== undefined && { base64: compress.base64.toString() })
            })
        },
        success: res => {
          if (res.statusCode !== 200) {
            console.error("上传失败:", res)
            reject(res)
            return
          }
          console.log("上传成功！")

          file.status = "success"
          try {
            const data = JSON.parse(res.data)
            const { domain, key, size, img } = data?.data || {}
            const path = key?.split("/")
            file.size = size || file.size
            file.name = path?.[path?.length - 1] || file.name
            file.url = `${domain}/${key}`
            if (img) {
              // 小程序环境下不支持base64，忽略此字段
            }
            resolve(file)
          } catch (e) {
            reject(e)
          }
        },
        fail: error => {
          console.error("上传失败:", error)
          file.status = "fail"
          reject(error)
        }
      })

      // 监听上传进度
      uploadTask.onProgressUpdate(res => {
        file.status = "uploading"
        file.percentage = res.progress
        fileUploadProgressHandler(res, file, [file])
      })

      // 将取消上传的方法保存到文件对象中
      file.abort = () => {
        uploadTask.abort()
      }
    })
  })()
}

/**
 * 选择并上传文件（Taro版本）
 */
export const chooseAndUploadFiles = async (
  options: ChooseFileOptions & UploadOptions
): Promise<UploadFile[]> => {
  const {
    autoFilePaths = null,
    count = 9,
    sizeType = ["compressed"],
    sourceType = ["album", "camera"],
    limit,
    size,
    exceedLimitHandler = () => {},
    exceedSizeHandler = () => {},
    beforeUploadBatchHandler = () => {},
    beforeUploadFileHandler = () => Promise.resolve(true),
    fileUploadEndHandler = () => {},
    fileUploadProgressHandler = () => {},
    fileUploadErrorHandler = () => {},
    fileListSelectHandler = () => Promise.resolve(true),
    ...uploadOptions
  } = options

  try {
    // 选择文件
    let chooseRes: any
    let processedFilePaths: string[]

    if (autoFilePaths) {
      chooseRes = { tempFilePaths: autoFilePaths }
      processedFilePaths = autoFilePaths
    } else {
      chooseRes = await Taro.chooseImage({
        count,
        sizeType,
        sourceType
      })
      processedFilePaths = chooseRes.tempFilePaths
    }

    // 打印原始文件的 mimeType（无论是否转换）
    console.log("=== 文件选择完成，开始处理 ===")
    for (let index = 0; index < chooseRes.tempFilePaths.length; index++) {
      const tempFilePath = chooseRes.tempFilePaths[index]
      const originalFileType = await detectFileTypeFromPath(tempFilePath)
      console.log(`原始文件 ${index + 1}: ${tempFilePath}`)
      console.log(`  原始 mimeType: ${originalFileType.mimeType}`)
      console.log(`  原始格式: ${originalFileType.ext}`)
    }

    if (uploadOptions.convert?.enableConvert && uploadOptions.convert.targetFormat) {
      try {
        console.log("开始格式转换...")

        const convertResults = await convertImageFormats(chooseRes.tempFilePaths, {
          quality: uploadOptions.convert.convertQuality || 85,
          width: uploadOptions.convert.convertWidth,
          height: uploadOptions.convert.convertHeight,
          format: uploadOptions.convert.targetFormat
        })
        processedFilePaths = convertResults.map(result => result.tempFilePath)

        // 打印转换后的 mimeType
        const targetMimeType = getMimeType(uploadOptions.convert.targetFormat)
        const targetExt = getFileExtension(uploadOptions.convert.targetFormat)
        console.log(`格式转换完成，目标格式: ${targetExt}, 目标 mimeType: ${targetMimeType}`)
      } catch (error) {
        console.warn("格式转换失败，使用原文件:", error)
        // 转换失败时使用原文件
      }
    } else {
      console.log("未启用格式转换，使用原始文件")
    }

    const files: UploadFile[] = []
    for (let index = 0; index < processedFilePaths.length; index++) {
      const tempFilePath = processedFilePaths[index]
      // 检测文件类型
      const originalFileType = await detectFileTypeFromPath(chooseRes.tempFilePaths[index])
      const fileType =
        uploadOptions.convert?.enableConvert && uploadOptions.convert.targetFormat
          ? {
              ext: getFileExtension(uploadOptions.convert.targetFormat),
              mimeType: getMimeType(uploadOptions.convert.targetFormat),
              isImage: true
            }
          : originalFileType

      const fileName = `image_${Date.now()}_${index}.${fileType.ext}`

      // 打印最终的文件信息
      console.log(`文件 ${index + 1} 处理完成:`)
      console.log(`  文件名: ${fileName}`)
      console.log(`  最终 mimeType: ${fileType.mimeType}`)
      console.log(`  最终格式: ${fileType.ext}`)
      console.log(`  文件路径: ${tempFilePath}`)

      files.push({
        uid: genGuid(),
        name: fileName,
        size: 0, // 小程序环境下无法直接获取文件大小
        type: fileType.mimeType,
        status: "ready",
        percentage: 0,
        url: "",
        filePath: uploadOptions.filePath || "",
        originFileName: fileName,
        tempFilePath
      })
    }

    // 验证文件格式
    const supportedFiles: UploadFile[] = []
    for (const file of files) {
      const isSupported = await isSupportedImageFormat(file.tempFilePath || "")
      if (isSupported) {
        supportedFiles.push(file)
      } else {
        console.warn(`不支持的文件格式: ${file.name}`)
      }
    }

    if (supportedFiles.length !== files.length) {
      console.warn(
        "发现不支持的文件格式:",
        files.filter(f => !supportedFiles.includes(f)).map(f => f.name)
      )
    }

    // 使用支持的文件列表
    files.splice(0, files.length, ...supportedFiles)

    // 触发文件选择钩子
    try {
      const res = await fileListSelectHandler(clone(files))
      if (res === false) {
        return Promise.reject("fileListSelectHandler rejected")
      }
    } catch (err) {
      console.error("fileListSelectHandler rejected: ", err)
      return Promise.reject("fileListSelectHandler rejected")
    }

    // 文件个数校验
    if (typeof limit === "number" && limit > 0 && files.length > limit) {
      console.error("文件个数超出限制")
      exceedLimitHandler(clone(files))
      return []
    }

    // 文件大小校验（小程序环境下简化处理）
    if (typeof size === "number" && size > 0) {
      // 小程序环境下无法精确获取文件大小，这里跳过校验
      console.warn("小程序环境下无法进行文件大小校验")
    }

    // 确认选择一批文件，校验通过后，开始上传前，调用此钩子
    beforeUploadBatchHandler(files)

    // 使用 limitLoad 控制并发上传数量
    await limitLoad(
      files,
      async file => {
        if (file.status === "ready") {
          try {
            // 开始上传文件前的钩子
            const res = await beforeUploadFileHandler(file, files)
            if (res === false) {
              file.status = "delete"
              file.url = ""
              fileUploadErrorHandler({ data: { url: "" } }, file, files)
              return
            }

            // 上传文件
            file.status = "uploading"
            file.percentage = 0
            console.log(`开始上传文件: ${file.name}`)
            console.log(`  上传 mimeType: ${file.type}`)
            console.log(`  上传格式: ${file.name.split(".").pop()}`)

            fileUploadProgressHandler({ loaded: 0, total: file.size || 0 }, file, files)
            const uploadedFile = await uploadFile(file, {
              ...uploadOptions,
              fileUploadProgressHandler
            })
            // 更新文件信息
            Object.assign(file, uploadedFile)

            console.log(`文件上传完成: ${file.name}`)
            console.log(`  最终 URL: ${file.url}`)
          } catch (err) {
            file.status = "fail"
            fileUploadErrorHandler(err, file, files)
            console.error("上传失败:", err)
          }
        }
      },
      uploadOptions.fileUploadLimit || 4
    )

    // 返回更新后的文件列表，过滤掉被删除的文件
    return files.filter(file => file.status !== "delete")
  } catch (e) {
    return Promise.reject(e)
  }
}

/**
 * 简化的文件上传接口（用于组件中直接调用）
 */
export const handleTaroFileUpload = async (options: {
  autoFilePaths?: string[] | null
  filePath?: string
  enableCompress?: boolean
  compressOptions?: CompressOptions
  enableConvert?: boolean
  convertOptions?: ConvertOptions
  count?: number
  sizeType?: ("original" | "compressed")[]
  sourceType?: ("album" | "camera")[]
  limit?: number
  size?: number
  env?: "test" | "stage" | "prod"
  getToken?: () => Promise<string>
}): Promise<UploadFile> => {
  const {
    autoFilePaths = null,
    filePath = "yanxue/feedback",
    enableCompress = true,
    compressOptions = { quality: 85 }, // 压缩质量，整数，取值范围：0-100
    enableConvert = false,
    convertOptions = { targetFormat: "jpg", convertQuality: 85 },
    count = 1,
    sizeType = ["compressed"],
    sourceType = ["album", "camera"],
    limit = 1,
    size = 2 * 1024 * 1024,
    env = "prod",
    getToken = async () => {
      // 默认的token获取方法，实际使用时需要替换
      throw new Error("请提供getToken方法")
    }
  } = options

  try {
    const files = await chooseAndUploadFiles({
      autoFilePaths,
      count,
      sizeType,
      sourceType,
      limit,
      size,
      filePath,
      compress: enableCompress ? compressOptions : undefined,
      convert: enableConvert ? convertOptions : undefined,
      env,
      getToken,
      fileUploadErrorHandler: error => {
        console.error("上传失败:", error)
        Taro.showToast({
          title: "上传失败",
          icon: "none"
        })
      }
    })

    if (files.length > 0) {
      return files[0]
    } else {
      throw new Error("没有选择文件")
    }
  } catch (error) {
    console.error("文件上传失败:", error)
    Taro.showToast({
      title: "文件上传失败",
      icon: "none"
    })
    throw error
  }
}

// 导出所有工具函数（从 utils/index.ts 重新导出）
export {
  getApiUrl,
  genFileName,
  needCompress,
  isNil,
  clone,
  fileHash,
  genFileNameOfType5
} from "./utils/index"
