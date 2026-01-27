import { getApiUrl, getUrlParamsByObject, httpRequest, genFileName } from "../utils/index"
import type { UploadFile } from "../index"

/**
 * 获取bucket中文件名称为filename值的文件详情
 * @param {string} env
 * @param {string} key
 * @param {function} getToken
 */
async function getFileDetail(env: string, key: string, getToken: () => Promise<string>) {
  try {
    const token = await getToken()
    if (!token || typeof token !== "string") {
      return Promise.reject("getToken返回值不是一个可用的token")
    }
    const httpConfig = {
      method: "get",
      url: getApiUrl(env, "getFileApi") + getUrlParamsByObject({ key }),
      headers: { Authorization: token }
    }
    const res = await httpRequest(httpConfig)
    if (res?.data) {
      return res?.data
    }
  } catch (e) {
    return Promise.reject(e)
  }
}

/**
 * 获取bucket中文件名称为filename值的文件url
 * ⚠️注意：暂时只考虑公共bucket，私有bucket需要传expires，暂时先不考虑，后期优化再支持
 * @param {string} env
 * @param {string} key
 * @param {function} getToken
 */
async function getFileUrl(env: string, key: string, getToken: () => Promise<string>) {
  try {
    const token = await getToken()
    if (!token || typeof token !== "string") {
      return Promise.reject("getToken返回值不是一个可用的token")
    }
    const httpConfig = {
      method: "get",
      url: getApiUrl(env, "getFileUrlApi") + getUrlParamsByObject({ key }),
      headers: { Authorization: token }
    }
    const res = await httpRequest(httpConfig)
    if (res?.data) {
      return res?.data?.url
    }
  } catch (e) {
    return Promise.reject(e)
  }
}

/**
 * 判断文件是否存在于存储桶中，如果存在则获取文件的url地址，并返回带有url地址和name属性的file对象
 * @param {string} env
 * @param {number} fileNameType
 * @param {string} filePath
 * @param {object} file
 * @param {function} getToken
 * @returns
 */
export default async function getFileFromOss(
  env: string,
  fileNameType: number,
  filePath: string,
  file: UploadFile,
  getToken: () => Promise<string>
): Promise<UploadFile | null> {
  if (typeof getToken !== "function") {
    return Promise.reject("getToken is not function")
  }
  try {
    let name = ""
    if (fileNameType === 5) {
      name = file.name
    } else {
      name = await genFileName(fileNameType, { name: file.name })
    }
    const key = `${filePath ? filePath.replace(/(\/)?$/, "/") : filePath}${name}`
    // 根据计算出来的文件名称，查询存储桶中是否存在这个文件
    const fileInfo = await getFileDetail(env, key, getToken)
    if (fileInfo?.contentLength) {
      // 获取文件的url
      const url = await getFileUrl(env, key, getToken)
      if (url) {
        return {
          ...file,
          size: fileInfo.contentLength,
          name,
          filePath,
          status: "success",
          percentage: 100,
          url
        }
      }
    }
    return null
  } catch (e) {
    return Promise.reject(e)
  }
}
