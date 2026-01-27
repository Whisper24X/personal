import Taro from "@tarojs/taro"
import { getApiUrl, genFileName, needCompress } from "../utils/index"
import type { UploadFile, UploadOptions } from "../index"

/**
 * 单个文件上传（Taro版本）
 */
export default async function upload(
  file: UploadFile,
  options: UploadOptions
): Promise<() => void> {
  const {
    env,
    getToken,
    filePath = "",
    fileNameType = 2,
    compress,
    fileUploadEndHandler = () => {},
    fileUploadProgressHandler = () => {},
    fileUploadErrorHandler = () => {},
    uploadFinish = () => {}
  } = options

  if (/\s/.test(filePath) || /^\//.test(filePath) || !filePath) {
    throw new Error("filePath格式不正确")
  }

  try {
    const token = await getToken()

    if (!token || typeof token !== "string") {
      return Promise.reject("getToken返回值不是一个可用的token")
    }

    const url = getApiUrl(env, needCompress(compress) ? "uploadAndCompressApi" : "uploadApi")

    let name = ""
    if (fileNameType === 5) {
      name = file.name
    } else {
      name = await genFileName(fileNameType, { name: file.name })
    }

    const uploadTask = Taro.uploadFile({
      url,
      filePath: file.tempFilePath || "",
      name: "file",
      header: {
        Authorization: token
      },
      formData: {
        path: `${filePath ? filePath.replace(/(\/)?$/, "/") : filePath}${name}`,
        ...(needCompress(compress) && {
          ...(compress.width && { width: compress.width.toString() }),
          ...(compress.height && { height: compress.height.toString() }),
          ...(compress.quality && { quality: compress.quality.toString() }),
          ...(compress.base64 !== undefined && { base64: compress.base64.toString() })
        })
      },
      success: res => {
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
          fileUploadEndHandler(data, file, [file])
          uploadFinish()
        } catch (e) {
          fileUploadErrorHandler(res, file, [file])
          uploadFinish()
        }
      },
      fail: error => {
        console.error("上传失败:", error)
        file.status = "fail"
        fileUploadErrorHandler(error, file, [file])
        uploadFinish()
      }
    })

    // 监听上传进度
    uploadTask.onProgressUpdate(res => {
      file.status = "uploading"
      file.percentage = res.progress
      fileUploadProgressHandler(res, file, [file])
    })

    // 返回取消上传的方法
    return () => {
      uploadTask.abort()
    }
  } catch (e) {
    return Promise.reject(e)
  }
}
