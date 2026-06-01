import { ref } from 'vue'
import {
  ElLoading,
  ElMessage,
  ElMessageBox,
  ElNotification,
} from 'element-plus'

/**
 * 下载文件
 * @returns  { handleDownloadPdf: Function }
 */
export function useDownloader(
  downloadPreciseStudyReport: (params: any) => Promise<any>,
) {
  const downloadLoading = ref({
    showDownloadLoading: false,
    node: null as any,
  })

  // 展示下载loading
  const showDownloadLoadingIndicator = () => {
    if (downloadLoading.value.showDownloadLoading) return
    downloadLoading.value.node = ElLoading.service({
      lock: true,
      text: '正在生成文件中，请稍后...',
      background: 'rgba(0, 0, 0, 0.7)',
    })
    downloadLoading.value.showDownloadLoading = true
  }

  // 下载文件
  const handleDownload = async (queryParams: any, fileKey = 'downloadUrl') => {
    const startTime = Date.now() // 记录开始时间
    showDownloadLoadingIndicator()

    const pollDownload = async () => {
      const currentTime = Date.now()
      const elapsedTime = (currentTime - startTime) / 1000 // 转换为秒

      if (elapsedTime > 120) {
        // 超过2分钟
        downloadLoading.value.showDownloadLoading = false
        downloadLoading.value.node.close()
        ElMessage({
          type: 'error',
          message: '生成文件超过2分钟，已超时。请稍后重试。',
        })
        return
      }
      try {
        const res = await downloadPreciseStudyReport(queryParams)
        if (res?.[fileKey]) {
          downloadLoading.value.showDownloadLoading = false
          downloadLoading.value.node.close()
          ElMessageBox.alert('点击下载按钮，下载文件', '文件已生成', {
            confirmButtonText: '下载',
            callback: (action: string) => {
              if (action === 'confirm') {
                window.open(res?.[fileKey], '_blank')
              }
            },
          })
        } else {
          setTimeout(pollDownload, 2000) // 每2秒轮询一次
        }
      } catch (error: any) {
        console.log('handleDownload error', error)
        if (error.data && error.data.code == 409) {
          //生成缓存中，轮训
          setTimeout(pollDownload, 2000) // 请求失败也每2秒轮询一次
        } else {
          //其他异常失败
          downloadLoading.value.showDownloadLoading = false
          downloadLoading.value.node.close()
          ElNotification({
            title: '亲亲😙，出错了',
            dangerouslyUseHTMLString: true,
            message: '发生异常，请检查后重试。',
            type: 'error',
          })
          return
        }
      }
    }
    await pollDownload()
  }

  return {
    handleDownload,
  }
}
