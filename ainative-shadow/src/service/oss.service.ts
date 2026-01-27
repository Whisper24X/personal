import request from './axios.interceptor'

const ENV = process.env.ENV || 'development'

const OSS_API_MAP = {
  development: 'https://device-test-api.yangcong345.com',
  test: 'https://device-test-api.yangcong345.com',
  stage: 'https://device-stage-api.yangcong345.com',
  production: 'https://device-api.yangcong345.com',
} as const

export interface OssTokenResponse {
  code: number
  msg: string
  debug: string
  data: {
    token: string
  }
}

/**
 * 获取OSS上传凭证
 */
export const getOssToken = (bucket = 'onionpad-cloud-control') => {
  return request.post<OssTokenResponse>(`/yc-oss/token`, undefined, {
    params: {
      bucket,
      expires: '1800',
      disabledRepeatInterceptor: true,
    },
    baseURL: OSS_API_MAP[ENV as keyof typeof OSS_API_MAP],
    responseType: 'json',
  })
}
