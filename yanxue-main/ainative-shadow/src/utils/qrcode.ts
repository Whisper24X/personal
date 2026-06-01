import QRCode from 'qrcode'

/**
 * 二维码生成配置选项
 */
export interface QRCodeOptions {
  width?: number // 二维码宽度
  height?: number // 二维码高度
  margin?: number // 边距
  color?: {
    dark?: string // 前景色
    light?: string // 背景色
  }
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' // 纠错级别
}

/**
 * 默认二维码配置
 */
const DEFAULT_OPTIONS: QRCodeOptions = {
  width: 200,
  height: 200,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
  errorCorrectionLevel: 'M',
}

/**
 * 生成二维码并返回DataURL
 * @param text 要生成二维码的文本内容
 * @param options 二维码配置选项
 * @returns Promise<string> 返回base64格式的DataURL
 */
export const generateQRCodeDataURL = async (
  text: string,
  options: QRCodeOptions = {},
): Promise<string> => {
  try {
    const config = { ...DEFAULT_OPTIONS, ...options }

    const dataURL = await QRCode.toDataURL(text, {
      width: config.width,
      margin: config.margin,
      color: config.color,
      errorCorrectionLevel: config.errorCorrectionLevel,
    })

    return dataURL
  } catch (error) {
    console.error('生成二维码失败:', error)
    throw new Error('生成二维码失败')
  }
}

/**
 * 生成二维码并返回Canvas元素
 * @param text 要生成二维码的文本内容
 * @param options 二维码配置选项
 * @returns Promise<HTMLCanvasElement> 返回Canvas元素
 */
export const generateQRCodeCanvas = async (
  text: string,
  options: QRCodeOptions = {},
): Promise<HTMLCanvasElement> => {
  try {
    const config = { ...DEFAULT_OPTIONS, ...options }

    const canvas = await QRCode.toCanvas(text, {
      width: config.width,
      margin: config.margin,
      color: config.color,
      errorCorrectionLevel: config.errorCorrectionLevel,
    })

    return canvas
  } catch (error) {
    console.error('生成二维码失败:', error)
    throw new Error('生成二维码失败')
  }
}

/**
 * 生成二维码并返回SVG字符串
 * @param text 要生成二维码的文本内容
 * @param options 二维码配置选项
 * @returns Promise<string> 返回SVG字符串
 */
export const generateQRCodeSVG = async (
  text: string,
  options: QRCodeOptions = {},
): Promise<string> => {
  try {
    const config = { ...DEFAULT_OPTIONS, ...options }

    const svg = await QRCode.toString(text, {
      type: 'svg',
      width: config.width,
      margin: config.margin,
      color: config.color,
      errorCorrectionLevel: config.errorCorrectionLevel,
    })

    return svg
  } catch (error) {
    console.error('生成二维码失败:', error)
    throw new Error('生成二维码失败')
  }
}

/**
 * 生成小程序跳转二维码
 * @param couponId 优惠券ID
 * @param miniProgramPath 小程序页面路径，默认为优惠券详情页
 * @param options 二维码配置选项
 * @returns Promise<string> 返回base64格式的DataURL
 */
export const generateMiniProgramQRCode = async (
  couponId: string | number,
  miniProgramPath: string = '/pages/coupon/detail',
  options: QRCodeOptions = {},
): Promise<string> => {
  // 构建小程序跳转链接
  const miniProgramUrl = `pages/coupon/detail?id=${couponId}`

  // 生成二维码
  return generateQRCodeDataURL(miniProgramUrl, options)
}

/**
 * 生成优惠券分享二维码
 * @param couponId 优惠券ID
 * @param couponName 优惠券名称
 * @param options 二维码配置选项
 * @returns Promise<string> 返回base64格式的DataURL
 */
export const generateCouponShareQRCode = async (
  couponId: string | number,
  couponName: string,
  options: QRCodeOptions = {},
): Promise<string> => {
  // 构建分享链接，包含优惠券ID和名称
  const shareUrl = `https://your-domain.com/coupon/share?id=${couponId}&name=${encodeURIComponent(
    couponName,
  )}`

  // 生成二维码
  return generateQRCodeDataURL(shareUrl, options)
}

/**
 * 下载二维码图片
 * @param dataURL base64格式的DataURL
 * @param filename 文件名，默认为 'qrcode.png'
 */
export const downloadQRCode = (
  dataURL: string,
  filename: string = 'qrcode.png',
): void => {
  try {
    const link = document.createElement('a')
    link.href = dataURL
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('下载二维码失败:', error)
    throw new Error('下载二维码失败')
  }
}

/**
 * 将Canvas转换为Blob
 * @param canvas Canvas元素
 * @param type 图片类型，默认为 'image/png'
 * @param quality 图片质量，0-1之间
 * @returns Promise<Blob> 返回Blob对象
 */
export const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string = 'image/png',
  quality: number = 1,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Canvas转换Blob失败'))
        }
      },
      type,
      quality,
    )
  })
}

/**
 * 将DataURL转换为Blob
 * @param dataURL base64格式的DataURL
 * @returns Blob对象
 */
export const dataURLToBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }

  return new Blob([u8arr], { type: mime })
}
