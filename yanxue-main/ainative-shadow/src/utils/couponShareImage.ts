import html2canvas from 'html2canvas'

/**
 * 优惠券分享图配置
 */
export interface CouponShareImageConfig {
  couponId: string | number
  couponName: string
  amount: string
  threshold: string
  validTime: string
  miniProgramName?: string
  miniProgramIcon?: string
  width?: number
  height?: number
}

/**
 * 默认分享图配置
 */
export const DEFAULT_CONFIG = {
  width: 750,
  height: 1250,
  backgroundImage:
    'https://fp.yangcong345.com/middle/1.0.0/coupon-bg-923bd16d33e918ca5f61efa4607a99a8__w.png',
  miniProgramIcon:
    'https://fp.yangcong345.com/middle/1.0.0/yanxue-logo-30aaff28b0dc207e82f783c545e53056__w.png',
  miniProgramName: '洋葱星球研学家长服务',
}

/**
 * 使用html2canvas生成优惠券分享图
 * @param element 要转换的DOM元素
 * @returns Promise<string> 返回base64格式的DataURL
 */
export const generateCouponShareImage = async (
  element: HTMLElement,
): Promise<string> => {
  try {
    const canvas = await html2canvas(element, {
      useCORS: true, // 支持跨域图片
      allowTaint: false,
      backgroundColor: null,
      scale: 1, // 使用1倍缩放,因为DOM已经是750px宽度
      width: element.offsetWidth,
      height: element.offsetHeight,
      logging: false, // 关闭日志
    })

    return canvas.toDataURL('image/png', 1.0)
  } catch (error) {
    console.error('生成分享图失败:', error)
    throw new Error('生成分享图失败')
  }
}

/**
 * 下载优惠券分享图
 * @param element 要转换的DOM元素
 * @param filename 文件名
 */
export const downloadCouponShareImage = async (
  element: HTMLElement,
  filename: string = '优惠券分享图.png',
): Promise<void> => {
  try {
    const dataURL = await generateCouponShareImage(element)

    // 创建下载链接
    const link = document.createElement('a')
    link.download = filename
    link.href = dataURL
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('下载分享图失败:', error)
    throw new Error('下载分享图失败')
  }
}
