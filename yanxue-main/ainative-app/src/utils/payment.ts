import Taro from "@tarojs/taro"

/**
 * 微信支付参数接口
 */
export interface WechatPaymentParams {
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

/**
 * 微信支付结果接口
 */
export interface PaymentResult {
  success: boolean
  errMsg?: string
  errorCode?: string
}

/**
 * 唤起微信支付
 * @param params 微信支付参数
 * @returns Promise<PaymentResult>
 */
export const requestWechatPayment = async (params: WechatPaymentParams): Promise<PaymentResult> => {
  try {
    await Taro.requestPayment({
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType as "MD5" | "HMAC-SHA256",
      paySign: params.paySign
    })

    return {
      success: true
    }
  } catch (error: any) {
    console.error("微信支付失败:", error)

    // 用户取消支付
    if (error.errMsg?.includes("requestPayment:fail cancel")) {
      return {
        success: false,
        errMsg: "用户取消支付",
        errorCode: "USER_CANCEL"
      }
    }

    // 支付失败
    return {
      success: false,
      errMsg: error.errMsg || "支付失败",
      errorCode: error.errno || "PAYMENT_FAILED"
    }
  }
}

/**
 * 轮询查询订单支付状态
 * @param orderId 订单ID
 * @param checkPaymentStatus 查询支付状态的函数
 * @param options 配置选项
 * @returns Promise<boolean> 是否支付成功
 */
export const pollPaymentStatus = async (
  orderId: string,
  checkPaymentStatus: (orderId: string) => Promise<boolean>,
  options?: {
    maxAttempts?: number // 最大轮询次数，默认30次
    interval?: number // 轮询间隔(ms)，默认1000ms
  }
): Promise<boolean> => {
  const { maxAttempts = 30, interval = 1000 } = options || {}

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const isPaid = await checkPaymentStatus(orderId)
      if (isPaid) {
        return true
      }
      // 等待指定时间后继续查询
      await new Promise(resolve => setTimeout(resolve, interval))
    } catch (error) {
      console.error("查询支付状态失败:", error)
      // 继续轮询
    }
  }

  return false
}

/**
 * 完整的支付流程
 * @param orderId 订单ID
 * @param createPayment 创建支付订单的函数
 * @param checkPaymentStatus 查询支付状态的函数
 * @returns Promise<PaymentResult>
 */
export const executePaymentFlow = async (
  orderId: string,
  createPayment: (orderId: string) => Promise<WechatPaymentParams>,
  checkPaymentStatus: (orderId: string) => Promise<boolean>
): Promise<PaymentResult> => {
  try {
    // 1. 创建微信支付订单，获取支付参数
    const paymentParams = await createPayment(orderId)

    // 2. 唤起微信支付
    const paymentResult = await requestWechatPayment(paymentParams)

    if (!paymentResult.success) {
      return paymentResult
    }

    // 3. 支付成功后，轮询查询支付状态（等待后端接收微信支付回调）
    const isPaid = await pollPaymentStatus(orderId, checkPaymentStatus, {
      maxAttempts: 30,
      interval: 1000
    })

    if (!isPaid) {
      return {
        success: false,
        errMsg: "支付状态确认超时，请稍后在订单列表中查看",
        errorCode: "STATUS_CHECK_TIMEOUT"
      }
    }

    return {
      success: true
    }
  } catch (error: any) {
    console.error("支付流程失败:", error)
    return {
      success: false,
      errMsg: error.message || "支付失败",
      errorCode: "PAYMENT_FLOW_ERROR"
    }
  }
}
