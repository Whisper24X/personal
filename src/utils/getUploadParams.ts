import { getOssToken } from '@/service/oss.service'

const ENV_NODE = process.env.ENV || 'development'
const envMaps = {
  development: 'test',
  test: 'test',
  stage: 'stage',
  production: 'prod',
} as const

export const YcPcUpload_ENV = envMaps[ENV_NODE as keyof typeof envMaps]

const getUploadParams = () => {
  const fetchToken = async (): Promise<string> => {
    try {
      const res = await getOssToken()
      return res.data.token
    } catch (error) {
      console.error('获取上传凭证失败：', error)
      throw error
    }
  }

  return {
    fetchToken,
    uploadEnv: YcPcUpload_ENV,
  }
}

export default getUploadParams
