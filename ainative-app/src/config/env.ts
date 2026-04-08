// 环境配置

type EnvType = "local" | "development" | "test" | "stage" | "production"
// API基础地址配置
const API_BASE_URL = {
  // 本地联调入口，仅 H5 模式使用
  local: "http://localhost:8080/api",
  // 开发/测试环境：小程序连接公网测试服，不连本地联调地址
  development: "https://trip-api-test.yangcong345.com",
  test: "https://trip-api-test.yangcong345.com",
  stage: "https://trip-api-stage.yangcong345.com",
  production: "https://trip-api.yangcong345.com"
}
// H5
const H5_BASE_URL = {
  local: "http://localhost:8080/app",
  development: "https://inpersonhub-test.yangcong345.com",
  test: "https://inpersonhub-test.yangcong345.com",
  stage: "https://inpersonhub-stage.yangcong345.com",
  production: "https://inpersonhub.yangcong345.com"
}

// 导出当前环境
// 使用全局定义的环境变量
export const CURRENT_ENV = __ENV_TYPE as EnvType

// API基础地址 - 使用全局变量
export const BASE_API = API_BASE_URL[CURRENT_ENV]

// H5基础地址 - 使用全局变量
export const BASE_H5 = H5_BASE_URL[CURRENT_ENV]

// 是否为本地联调环境
export const IS_LOCAL = CURRENT_ENV === "local"

// 是否为开发环境
export const IS_DEV = CURRENT_ENV === "development"

// 是否为测试环境
export const IS_TEST = CURRENT_ENV === "test"

// 是否为预发布环境
export const IS_STAGE = CURRENT_ENV === "stage"

// 是否为生产环境
export const IS_PROD = CURRENT_ENV === "production"

// 其他环境相关配置可以在这里添加
export const CONFIG = {
  // 请求超时时间
  REQUEST_TIMEOUT: 10000,
  // 是否开启调试
  DEBUG: IS_DEV || IS_TEST,
  // 版本号
  VERSION: "1.0.0"
}
