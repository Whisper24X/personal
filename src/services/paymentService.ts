import Taro from "@tarojs/taro"
import { createWechatPaymentOrder, getOrderPaymentStatus, getOrderGoodInfo } from "@/api/order"
import { createCourseAppointment } from "@/api/course"
import { executePaymentFlow, type WechatPaymentParams, type PaymentResult } from "@/utils/payment"
import { useUserStore } from "@/store/userStore"

/**
 * 获取用户的 userWxId (openId)
 */
const getUserWxId = async (): Promise<string> => {
  try {
    const userStore = useUserStore()
    const userWxId = userStore.userWxId

    if (userWxId) {
      return userWxId
    }

    // 如果没有 userWxId，提示用户重新登录
    throw new Error("用户信息获取失败")
  } catch (error) {
    console.error("获取userWxId失败:", error)
    throw error
  }
}

/**
 * 解析 jsSdkOptions 为微信支付参数
 * jsSdkOptions 是一个 JSON 字符串，包含了完整的微信支付参数
 */
const parseJsSdkOptions = (jsSdkOptions: string): WechatPaymentParams => {
  try {
    const params = JSON.parse(jsSdkOptions)
    return {
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign
    }
  } catch (error) {
    console.error("解析支付参数失败:", error)
    throw new Error("支付参数格式错误，请联系技术支持")
  }
}

/**
 * 支付订单
 * @param orderId 订单ID
 * @returns Promise<PaymentResult>
 */
export const payOrder = async (orderId: string): Promise<PaymentResult> => {
  try {
    // 获取用户 userWxId (openId)
    const openId = await getUserWxId()
    if (!orderId) {
      return {
        success: false,
        errMsg: "未找到订单信息，请重新下单",
        errorCode: "ORDER_NOT_FOUND"
      }
    }
    // 创建支付订单的函数
    const createPayment = async (orderId: string): Promise<WechatPaymentParams> => {
      const result = await createWechatPaymentOrder({ orderId, openId })

      // 解析 jsSdkOptions 为微信支付参数
      return parseJsSdkOptions(result.jsSdkOptions)
    }

    // 查询支付状态的函数
    const checkPaymentStatus = async (orderId: string): Promise<boolean> => {
      const result = await getOrderPaymentStatus(orderId)
      return result.isFinishPay
    }

    // 执行完整的支付流程
    const result = await executePaymentFlow(orderId, createPayment, checkPaymentStatus)

    return result
  } catch (error: any) {
    console.error("支付失败:", error)
    return {
      success: false,
      errMsg: error.message || "支付失败",
      errorCode: "PAY_ORDER_ERROR"
    }
  }
}

/**
 * 处理支付结果并跳转页面
 * @param result 支付结果
 * @param orderId 订单ID
 */
export const handlePaymentResult = async (result: PaymentResult, orderId: string) => {
  if (result.success) {
    // 支付成功，显示加载蒙层防止重复操作
    Taro.showLoading({
      title: "处理中...",
      mask: true // 显示透明蒙层，防止触摸穿透
    })

    // 支付成功，创建预约
    try {
      // 1. 获取订单信息，包含预约草稿
      const orderData = await getOrderGoodInfo(orderId)
      const courseAppointmentDraft = orderData.courseAppointmentDraft

      let appointmentId = ""

      if (courseAppointmentDraft && courseAppointmentDraft?.date) {
        // 2. 使用预约草稿创建预约
        const appointmentResult = await createCourseAppointment({
          orderId,
          categoryId: courseAppointmentDraft.categoryId,
          courseId: courseAppointmentDraft.courseId,
          date: courseAppointmentDraft.date,
          period: courseAppointmentDraft.period,
          studentName: courseAppointmentDraft.studentName,
          studentIdentityCard: courseAppointmentDraft.studentIdentityCard,
          studentSex: courseAppointmentDraft.studentSex,
          studentAge: courseAppointmentDraft.studentAge,
          parentName: courseAppointmentDraft.parentName,
          parentPhone: courseAppointmentDraft.parentPhone,
          parentAccompany: courseAppointmentDraft.parentAccompany,
          parentRemark: courseAppointmentDraft.parentRemark
        })
        console.log("预约创建成功")
        appointmentId = appointmentResult.id
      }

      // 3. 隐藏加载蒙层，显示成功提示
      Taro.hideLoading()
      Taro.showToast({
        title: "支付成功",
        icon: "success",
        duration: 2000,
        mask: true // 显示透明蒙层，防止触摸穿透
      })

      setTimeout(() => {
        Taro.redirectTo({
          url: `/pages/order/payment-success/index?orderId=${orderId}${appointmentId ? `&appointmentId=${appointmentId}` : ""}`
        })
      }, 2000)
    } catch (error: any) {
      console.error("创建预约失败:", error)
      // 即使预约创建失败，也跳转到支付成功页面
      Taro.hideLoading()
      Taro.showToast({
        title: "支付成功",
        icon: "success",
        duration: 2000,
        mask: true // 显示透明蒙层，防止触摸穿透
      })

      setTimeout(() => {
        Taro.redirectTo({
          url: `/pages/order/appointment-abnormal/index?orderId=${orderId}&from=order`
        })
      }, 2000)
    }
  } else {
    // 支付失败处理
    if (result.errorCode === "USER_CANCEL") {
      // 用户取消支付，跳转到待付款页面
      Taro.showToast({
        title: "已取消支付",
        icon: "none",
        duration: 2000,
        mask: true // 显示透明蒙层，防止触摸穿透
      })

      setTimeout(() => {
        Taro.redirectTo({
          url: `/pages/order/pending-payment/index?orderId=${orderId}`
        })
      }, 2000)
    } else if (result.errorCode === "STATUS_CHECK_TIMEOUT") {
      // 支付状态确认超时
      Taro.showModal({
        title: "提示",
        content: "支付状态确认超时，请稍后在订单列表中查看支付状态",
        showCancel: true,
        confirmText: "查看订单",
        cancelText: "留在此页",
        success: res => {
          if (res.confirm) {
            Taro.redirectTo({
              url: "/pages/order/list/index"
            })
          }
        }
      })
    } else {
      // 其他支付失败情况
      Taro.showModal({
        title: "支付失败",
        content: result.errMsg || "支付失败，请重试",
        showCancel: true,
        confirmText: "重新支付",
        cancelText: "取消",
        success: res => {
          if (res.confirm) {
            // 用户选择重新支付，可以重新调用支付方法
            payOrder(orderId)
          }
        }
      })
    }
  }
}
