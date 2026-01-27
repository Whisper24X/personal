<template>
  <tab-bar-layout
    tab-key="order-confirm"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{ title: '确认订单' }"
  >
    <Loading v-if="loading" :fullscreen="true" text="加载中..." />

    <view
      v-else
      class="order-confirm-content"
      :style="{
        height: `calc(100vh - ${getNavBarHeight()}rpx - 124rpx - env(safe-area-inset-bottom))`
      }"
    >
      <GoodInfo :good-info="goodInfo" />

      <InfoCard>
        <InfoRow label="商品总价">¥{{ centsToYuan(goodInfo?.price || 0) }}</InfoRow>
        <InfoRow label="优惠券">
          <view class="coupon-select" @tap="handleSelectCoupon">
            <view v-if="selectedCoupon" class="coupon-text">
              <text class="coupon-discount">-¥{{ selectedCoupon.discountAmount }}</text>
              <image
                class="arrow-icon"
                src="https://fp.yangcong345.com/middle/1.0.0/icon-right-a55af357bef0a85b0618e541ae4e35a5__w.png"
                mode="aspectFit"
              />
            </view>
            <view v-else class="coupon-text-disabled">
              <text>暂无可用</text>
            </view>
          </view>
        </InfoRow>
        <InfoRow label="订单备注">
          <view class="remark" @tap="remarkSheetVisible = true">
            <text>{{ remark || "备注信息（200字以内）" }}</text>
          </view>
        </InfoRow>
      </InfoCard>

      <InfoCard title="预约信息">
        <InfoRow v-if="selectedCourseName" label="预约课程">{{ selectedCourseName }}</InfoRow>
        <InfoRow label="预约时间">{{ displayDate }} {{ displayPeriod }}</InfoRow>
      </InfoCard>

      <InfoCard title="营员信息">
        <InfoRow label="姓名">{{ studentNameParam }}</InfoRow>
      </InfoCard>

      <InfoCard title="监护人信息">
        <InfoRow label="姓名">{{ guardianForm.parentName }}</InfoRow>
        <InfoRow label="手机号">{{ guardianForm.parentPhone }}</InfoRow>
      </InfoCard>

      <!-- 协议勾选 -->
      <AgreementCheckbox
        v-model:checked="agreementChecked"
        prefix="我已阅读并同意"
        :agreements="agreements"
      />

      <FixedBottomBar>
        <view class="button-group">
          <view class="total-price"
            >应付：<text class="total-price-value"
              ><text class="symbol">¥</text>{{ finalPrice }}</text
            ></view
          >
          <OIButton
            class="submit-btn"
            type="default"
            size="huge"
            round
            shadow
            theme="yellow"
            :disabled="submitting || !agreementChecked"
            @click="handleSubmit"
          >
            立即支付
          </OIButton>
        </view>
      </FixedBottomBar>
    </view>

    <OIModal
      v-model:visible="confirmModalVisible"
      title="确定提交订单吗？"
      content="温馨提示：以上信息用于推送研学合同，购买旅行保险等实名制服务，请确保此信息真实有效，洋葱研学将通过加密等方式保护此信息。"
      left-button-text="取消"
      right-button-text="确认提交"
      @left-button-click="handleConfirmModalLeftClick"
      @right-button-click="handleConfirmModalRightClick"
    />
    <CompleteInfoModal
      v-model:show="completeInfoModalVisible"
      :children="incompleteChildrenList"
      @confirm="handleCompleteInfoConfirm"
      @cancel="handleCompleteInfoCancel"
    />
    <OISheet
      :show="remarkSheetVisible"
      title="备注"
      :safe-area="true"
      @click-close="remarkSheetVisible = false"
    >
      <view class="remark-sheet__container">
        <textarea v-model="remark" placeholder="备注" maxlength="200" class="remark-textarea" />
        <view class="remark-count">{{ remark.length }}/200</view>
      </view>
      <view class="remark-actions">
        <OIButton
          class="btn"
          type="default"
          size="huge"
          round
          shadow
          theme="yellow"
          @click="remarkSheetVisible = false"
        >
          保存
        </OIButton>
      </view>
    </OISheet>
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue"
import Taro, { useRouter } from "@tarojs/taro"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import Loading from "@/components/Loading/index.vue"
import FixedBottomBar from "@/components/FixedBottomBar.vue"
import OIButton from "@/components/Ui/button/index.vue"
import OIModal from "@/components/Ui/modal/index.vue"
import OISheet from "@/components/Ui/sheet/index.vue"
import GoodInfo from "@/pages/order/components/GoodInfo.vue"
import InfoCard from "@/components/InfoCard/index.vue"
import InfoRow from "@/components/InfoRow/index.vue"
import AgreementCheckbox from "@/components/AgreementCheckbox/index.vue"
import CompleteInfoModal from "@/pages/order/components/CompleteInfoModal.vue"
import { getNavBarHeight } from "@/utils/statusBar"
import { getGoodInfo } from "@/api/good"
import { createMiniProgramOrder } from "@/api/order"
import { getMyCouponList } from "@/pages/coupon/service"
import type { CouponInfo } from "@/pages/coupon/service"
import { payOrder, handlePaymentResult } from "@/services/paymentService"
import { calculateDiscountedPrice } from "@/utils/priceCalculator"
import { centsToYuan } from "@/utils/formatPrice"
import { track, trackClick } from "@/utils/analytics"
import { createUserBindStudent } from "@/api/child"

const router = useRouter()
const goodId = router.params.goodId as string
const date = decodeURIComponent(router.params.date as string)
const period = decodeURIComponent(router.params.period as string)
const courseId = router.params.courseId ? decodeURIComponent(router.params.courseId as string) : ""
const parentNameParam = decodeURIComponent(router.params.parentName as string)
const parentPhoneParam = decodeURIComponent(router.params.parentPhone as string)
const parentSexParam = decodeURIComponent(router.params.parentSex as string)
const studentNameParam = decodeURIComponent(router.params.studentName as string)
const studentIdCardParam = decodeURIComponent(router.params.studentIdentityCard as string)
const studentSexParam = decodeURIComponent(router.params.studentSex as string)
const studentAgeParam = Number(router.params.studentAge || 0)
const studentIdParam = router.params.studentId as string

const loading = ref(true)
const submitting = ref(false)
const confirmModalVisible = ref(false)
const remarkSheetVisible = ref(false)
const remark = ref("")
const agreementChecked = ref(false)
const completeInfoModalVisible = ref(false)

const goodInfo = ref<any>(null)
const availableCoupons = ref<CouponInfo[]>([])
const selectedCoupon = ref<CouponInfo | null>(null)
const incompleteChildrenList = ref<any[]>([])

// 保存营员信息（用于补充身份证号）
const studentInfo = reactive({
  id: studentIdParam,
  name: studentNameParam,
  idCard: studentIdCardParam,
  sex: studentSexParam,
  age: studentAgeParam
})

// 协议列表
const agreements = computed(() => {
  // 优先使用后台返回的协议信息
  if (goodInfo.value?.purchaseAgreementLink) {
    return [
      {
        name: goodInfo.value.purchaseAgreementName || "《洋葱星球研学基地小程序付费协议》",
        url: goodInfo.value.purchaseAgreementLink
      }
    ]
  }
  // 如果后台没有返回,使用默认协议
  return [
    {
      name: "《洋葱星球研学基地小程序付费协议》",
      url: "/pages/user/agreement/index?type=payment"
    }
  ]
})

const guardianForm = reactive({
  parentName: parentNameParam || "",
  parentPhone: parentPhoneParam || "",
  parentSex: parentSexParam || ""
})

const displayDate = computed(() => date)
const displayPeriod = computed(() => period)

// 获取选中的课程名称
const selectedCourseName = computed(() => {
  if (!courseId || !goodInfo.value?.content?.goodCategories?.[0]?.courses) {
    return ""
  }

  const course = goodInfo.value.content.goodCategories[0].courses.find(
    (c: any) => c.courseId === courseId
  )
  return course?.courseName || ""
})

// 判断是否需要推送合同
const needPushContract = computed(() => {
  // 检查商品是否需要推送合同
  if (!goodInfo.value?.content?.goodCategories) {
    return false
  }

  // 遍历所有课程分类和课程，检查是否有需要推送合同的课程
  for (const category of goodInfo.value.content.goodCategories) {
    for (const course of category.courses) {
      if (course.isPushContractRequired) {
        return true
      }
    }
  }

  return false
})

// 计算最终价格
const finalPrice = computed(() => {
  const price = centsToYuan(goodInfo.value?.price || 0)
  const discount = selectedCoupon.value?.discountAmount || 0
  return calculateDiscountedPrice(price, discount)
})

const fetchGoodInfo = async () => {
  try {
    const res = await getGoodInfo(goodId)
    goodInfo.value = res.info
    track(
      goodInfo.value.goodType === "multi" ? "enter_multi_day_confirm" : "enter_single_day_confirm",
      {
        product_name: goodInfo.value.name,
        product_id: goodInfo.value.id
      }
    )
  } catch (e) {
    console.error("获取商品信息失败", e)
    Taro.showToast({ title: "获取商品信息失败", icon: "none" })
  } finally {
    loading.value = false
  }
}

// 加载可用优惠券
const loadAvailableCoupons = async () => {
  try {
    const res = await getMyCouponList(goodId)
    const coupons = res.list || []
    // 过滤出未使用的优惠券
    availableCoupons.value = coupons.filter(c => c.status === "unUsed")

    // 自动选择优惠金额最大的优惠券
    if (availableCoupons.value.length > 0) {
      const maxDiscountCoupon = availableCoupons.value.reduce((prev, current) => {
        return (current.discountAmount || 0) > (prev.discountAmount || 0) ? current : prev
      })
      selectedCoupon.value = maxDiscountCoupon
    }
  } catch (e) {
    console.error("获取优惠券失败", e)
  }
}

// 处理选择优惠券
const handleSelectCoupon = () => {
  if (availableCoupons.value.length === 0) {
    Taro.showToast({ title: "暂无可用优惠券", icon: "none" })
    return
  }

  Taro.navigateTo({
    url: `/pages/coupon/available/index?goodId=${goodId}&selectedCouponId=${
      selectedCoupon.value?.id || ""
    }`
  })
}

const handleSubmit = () => {
  if (!agreementChecked.value) {
    Taro.showToast({
      title: "请先同意相关协议",
      icon: "none"
    })
    return
  }

  // 判断是否为多日营商品
  const isMultiDayCamp = goodInfo.value?.goodType === "multi"

  // 检查是否需要推送合同且营员身份证号为空
  if (
    needPushContract.value &&
    isMultiDayCamp &&
    (!studentInfo.idCard || studentInfo.idCard.trim() === "")
  ) {
    // 弹出补充信息弹窗
    incompleteChildrenList.value = [
      {
        name: studentInfo.name,
        gender: studentInfo.sex === "M" ? "男" : "女",
        age: studentInfo.age,
        idCard: studentInfo.idCard || ""
      }
    ]
    completeInfoModalVisible.value = true
    return
  }

  // 根据是否需要推送合同来决定是否显示确认弹窗
  if (needPushContract.value) {
    confirmModalVisible.value = true
  } else {
    // 直接提交
    handleConfirmModalRightClick()
  }
}

const handleCompleteInfoConfirm = async (children: any[]) => {
  // 更新营员身份证号
  if (children.length > 0) {
    studentInfo.idCard = children[0].idCard

    // 如果有营员ID，保存身份证号到营员信息中
    if (studentInfo.id) {
      try {
        await createUserBindStudent({
          id: studentInfo.id,
          studentName: studentInfo.name,
          studentIdentityCard: studentInfo.idCard,
          studentSex: studentInfo.sex,
          studentAge: studentInfo.age
        })
      } catch (error) {
        console.error("保存营员身份证号失败", error)
        // 即使保存失败也继续支付流程
      }
    }
  }

  // 补充完成后直接提交订单，不再显示二次确认弹窗
  // 因为补充信息弹窗中已经有相关提示
  handleConfirmModalRightClick()
}

const handleCompleteInfoCancel = () => {
  completeInfoModalVisible.value = false
}

const handleConfirmModalLeftClick = () => {
  confirmModalVisible.value = false
}

const handleConfirmModalRightClick = async () => {
  trackClick("pay_now")
  try {
    submitting.value = true
    // 构建预约草稿数据
    const courseAppointmentDraft = {
      categoryId: goodInfo.value?.content?.goodCategories?.[0]?.categoryId || "",
      courseId:
        courseId || goodInfo.value?.content?.goodCategories?.[0]?.courses?.[0]?.courseId || "",
      date,
      period,
      studentName: studentInfo.name,
      studentIdentityCard: studentInfo.idCard,
      studentSex: studentInfo.sex,
      studentAge: studentInfo.age,
      parentName: guardianForm.parentName,
      parentPhone: guardianForm.parentPhone,
      parentAccompany: "unknown",
      parentRemark: remark.value || undefined
    }

    // 第一步:创建订单（包含预约草稿）
    const orderResult = await createMiniProgramOrder({
      goodId,
      goodNums: 1,
      parentRemark: remark.value || undefined,
      userCouponId: selectedCoupon.value?.id || undefined,
      courseAppointmentDraft
    })
    console.log("订单创建成功:", orderResult)

    const orderId = orderResult.orderId

    // 第二步:发起支付
    const paymentResult = await payOrder(orderId)

    // 第三步:处理支付结果（包含创建预约）
    await handlePaymentResult(paymentResult, orderId)
    // 支付成功后不重置 submitting，保持按钮禁用状态直到页面跳转
  } catch (error) {
    console.error("提交订单失败", error)
    const errorMessage = error.message || "提交订单失败，请重试"

    // 检查是否是优惠券相关错误
    if (
      errorMessage.includes("优惠券") ||
      errorMessage.includes("coupon") ||
      errorMessage.includes("过期")
    ) {
      // 刷新优惠券列表
      await loadAvailableCoupons()
      Taro.showToast({
        title: "优惠券已过期，请重新选择",
        icon: "none",
        duration: 2000
      })
    } else {
      Taro.showToast({ title: errorMessage, icon: "none" })
    }

    submitting.value = false
    // 只有在弹窗可见时才重置弹窗状态
    if (confirmModalVisible.value) {
      confirmModalVisible.value = false
    }
  }
}

onMounted(() => {
  fetchGoodInfo()
  loadAvailableCoupons()

  // 监听优惠券选择事件
  const eventChannel = Taro.eventCenter
  eventChannel.on("selectCoupon", (data: any) => {
    if (data.couponId) {
      // 找到选中的优惠券
      const coupon = availableCoupons.value.find(c => c.id === data.couponId)
      if (coupon) {
        selectedCoupon.value = coupon
      }
    } else {
      selectedCoupon.value = null
    }
  })
})
</script>

<style lang="less">
.order-confirm-content {
  overflow-y: auto;
  padding: 32rpx;

  .button-group {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 16rpx 27rpx 8rpx 0;
    gap: 32rpx;
    color: #fa5a65;
    font-family: PingFang SC;
    font-weight: 400;
    font-size: 28px;

    .total-price {
      font-size: 32rpx;
      font-weight: 600;
      line-height: 32rpx;
      letter-spacing: normal;
      color: #ff6b35;
      .total-price-value {
        font-family: AlibabaPuHuiTi_2_105_Heavy;
        font-size: 48px;
        .symbol {
          font-size: 28px;
        }
      }
    }
    .submit-btn {
      width: 232px;
    }
  }
  /* .remark 预留，如需自定义展示样式可在此扩展 */
  .remark {
    color: #848096;
    font-family: PingFang SC;
    font-weight: 400;
    font-size: 28px;
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .coupon-select {
    display: flex;
    align-items: center;

    .coupon-text {
      display: flex;
      align-items: center;
      font-family: PingFang SC;
      font-weight: 400;
      font-size: 28px;

      .coupon-discount {
        color: #fa5a66;
        font-weight: 600;
      }

      .arrow-icon {
        width: 24rpx;
        height: 24rpx;
        margin-left: 8rpx;
      }
    }

    .coupon-text-disabled {
      display: flex;
      align-items: center;
      color: #848096;
      font-family: PingFang SC;
      font-weight: 400;
      font-size: 28px;
    }
  }
}
.remark-sheet__container {
  position: relative;
  padding: 48rpx 32rpx 32rpx 32rpx;
}

.remark-textarea {
  width: 100%;
  min-height: 260rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-sizing: border-box;
}

.remark-count {
  position: absolute;
  text-align: right;
  color: #848096;
  margin-top: 8rpx;
  bottom: 64rpx;
  right: 64rpx;
}

.remark-actions {
  border-top: 2px solid #efeef3;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  .btn {
    width: 100%;
  }
}
</style>
