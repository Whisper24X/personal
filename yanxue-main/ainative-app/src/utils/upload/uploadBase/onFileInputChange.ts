import Taro from "@tarojs/taro"
import { genGuid, clone, detectFileTypeFromPath } from "../utils/index"
import getFileFromOss from "./getFileFromOss"
import upload from "./upload"
import limitLoad from "./http.pipe"
import type { UploadFile, ChooseFileOptions, UploadOptions } from "../index"

/**
 * 文件选择和处理（Taro版本）
 */
export default async function onFileInputChange(
  options: ChooseFileOptions & UploadOptions
): Promise<UploadFile[]> {
  const {
    count = 9,
    sizeType = ["compressed"],
    sourceType = ["album", "camera"],
    limit,
    size,
    exceedLimitHandler = () => {},
    beforeUploadBatchHandler = () => {},
    beforeUploadFileHandler = () => Promise.resolve(true),
    fileUploadEndHandler = () => {},
    fileUploadProgressHandler = () => {},
    fileUploadErrorHandler = () => {},
    fileListSelectHandler = () => Promise.resolve(true),
    fileUploadLimit = 4,
    ...uploadOptions
  } = options

  try {
    // 选择文件
    const chooseRes = await Taro.chooseImage({
      count,
      sizeType,
      sourceType
    })

    const files: UploadFile[] = chooseRes.tempFilePaths.map((tempFilePath, index) => {
      // 检测文件类型
      const fileType = detectFileTypeFromPath(tempFilePath)
      const fileName = `image_${Date.now()}_${index}.${fileType.ext}`

      return {
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
      }
    })

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

    // 开始上传文件
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

            // 上传加速开始前，更新文件状态为上传中，并调用fileUploadProgressHandler钩子
            file.status = "uploading"
            file.percentage = 0
            fileUploadProgressHandler({ loaded: 0, total: file.size || 0 }, file, files)

            // 文件上传加速（检查是否已存在）
            const newFile = await getFileFromOss(
              uploadOptions.env,
              uploadOptions.fileNameType || 2,
              uploadOptions.filePath || "",
              file,
              uploadOptions.getToken
            )

            // 如果在加速后，用户点击删除按钮，删了上传队列中的文件，则需要中止后续逻辑，并抛出错误
            if (file.status === "delete") {
              fileUploadErrorHandler({ data: { url: newFile?.url || "" } }, file, files)
              return
            }

            if (newFile) {
              Object.assign(file, newFile)
              fileUploadEndHandler({ data: { url: newFile.url } }, file, files)
            } else {
              // 等待上传任务结束，一个上传任务结束后，上传队列才能进入下一个上传任务（上传失败和上传成功都算上传结束）
              await (async () => {
                // 调用上传方法
                const uploadedFile = await upload(file, {
                  ...uploadOptions,
                  fileUploadEndHandler,
                  fileUploadProgressHandler,
                  fileUploadErrorHandler,
                  uploadFinish: () => {}
                })
                Object.assign(file, uploadedFile)
              })()
            }
          } catch (err) {
            file.status = "fail"
            fileUploadErrorHandler(err, file, files)
          }
        }
      },
      fileUploadLimit
    )

    return files
  } catch (e) {
    return Promise.reject(e)
  }
}
