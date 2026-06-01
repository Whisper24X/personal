import { ElNotification } from 'element-plus'
import router from '@/routers'
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { filterRepeatHttp } from '@guanghe-pub/axios-interceptors'

import { useUserStore } from '@/store/modules/userStore'
import { getToken } from '@/utils/token'
import Logger from '@/utils/logger'

const logger = new Logger({
  level: 'info',
  showTimestamp: true,
  logToConsole: true,
  logToStorage: false,
  logToServer: false,
  context: { module: 'axios.interceptor' },
})

logger.info('BASE_API_URL:', process.env.BASE_API_URL)

class AxiosClass {
  axios: AxiosInstance
  constructor(option: AxiosRequestConfig) {
    const config: AxiosRequestConfig = {
      baseURL: process.env.BASE_API_URL,
      timeout: 10000,
      ...option,
    }
    this.axios = axios.create(config)
    filterRepeatHttp(this.axios)

    this.requestInterceptors()
    this.responseInterceptors()
  }

  /**
   * 请求拦截器
   */
  private requestInterceptors() {
    this.axios.interceptors.request.use(
      (config: any) => {
        const authorization = getToken()
        if (authorization) {
          if (config.headers) {
            config.headers.Authorization = `Bearer ${authorization}`
          }
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      },
    )
  }

  /**
   * 响应拦截器
   */
  private responseInterceptors() {
    this.axios.interceptors.response.use(
      (res) => {
        // 对响应数据做些事
        logger.info('response:', res.data)
        return res.data
      },
      (error) => {
        console.error('response error:', error)
        // 请求被取消、重复请求被拦截等场景下可能没有 response，避免解构报错
        const isCanceled =
          axios.isCancel(error) ||
          (error as { __CANCEL__?: boolean })?.__CANCEL__ === true ||
          (error as { name?: string })?.name === 'CanceledError' ||
          (error as { code?: string })?.code === 'ERR_CANCELED'
        if (isCanceled) {
          return Promise.reject(error)
        }
        const skipErrorHandler = error?.response?.config?.skipErrorHandler
        const errMsg =
          error.response?.data?.message ?? error.message ?? '请求失败'
        if (!skipErrorHandler) {
          ElNotification({
            title: '亲亲😙，出错了',
            dangerouslyUseHTMLString: true,
            message: errMsg,
            type: 'error',
          })
        }

        if (error.response?.data?.code === 401) {
          const userStore = useUserStore()
          userStore.reset()
          console.log('401 reset over')

          router.replace({
            name: 'Login',
          })
        }
        return Promise.reject(error.response ?? error)
      },
    )
  }

  async request(config: AxiosRequestConfig | any) {
    const res = await this.axios.request(config)
    return res
  }

  async get<R, P = {}>(
    url: string,
    param?: P,
    option?: AxiosRequestConfig | any,
  ): Promise<R> {
    return this.axios.get(url, {
      params: param,
      ...option,
    })
  }

  async delete<R, P = {}>(
    url: string,
    param?: P,
    option?: AxiosRequestConfig | any,
  ): Promise<R> {
    return this.axios.delete(url, {
      params: param,
      ...option,
    })
  }

  async post<R, P = {}>(
    url: string,
    param?: P,
    option?: AxiosRequestConfig | any,
  ): Promise<R> {
    return this.axios.post(url, param, option)
  }

  async put<R, P = {}>(
    url: string,
    param: P,
    option?: AxiosRequestConfig | any,
  ): Promise<R> {
    return this.axios.put(url, param, option)
  }
}

export default new AxiosClass({})
