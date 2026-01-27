<template>
  <tab-bar-layout
    tab-key="order-submit"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{
      title: '提交订单'
    }"
  >
    <Loading v-if="loading" :fullscreen="true" text="加载中..." />

    <view
      v-else
      class="order-submit-content"
      :style="{
        height: `calc(100vh - ${getNavBarHeight()}rpx - 124rpx - env(safe-area-inset-bottom))`
      }"
    >
      <!-- 商品基本信息 -->
      <GoodInfo :good-info="goodInfo" :show-skip-appointment-btn="showNoAppointmentButton" />

      <!-- 课程选择（多选一的单日营） -->
      <CourseSelector
        v-if="isMultiCourseSelection"
        v-model="selectedCourseId"
        class="course-selector-box"
        :courses="courseList"
        :category-name="categoryInfo.name"
        @change="handleCourseChange"
      />

      <!-- 报名时间选择 -->
      <RegistrationTimeSelector
        v-model="form"
        :good-info="goodInfo"
        :available-dates="availableDates"
        :time-slots="timeSlots"
        :selected-course-name="selectedCourseName"
        @change="handleRegistrationTimeChange"
      />

      <!-- 选择营员 -->
      <view class="child-info-box">
        <ChildSelector v-model="childForm" @change="handleChildChange" @load="handleChildLoad" />
      </view>

      <!-- 选择监护人 -->
      <view class="guardian-info-box">
        <GuardianSelector
          v-model="guardianForm"
          @change="handleGuardianChange"
          @load="handleGuardianLoad"
        />
      </view>

      <!-- 底部提交按钮 -->
      <FixedBottomBar>
        <view class="button-group">
          <view class="price-info">
            <view v-if="showEstimatedPrice" class="original-price"
              >原价: <text class="price-text">¥{{ centsToYuan(goodInfo?.price || 0) }}</text></view
            >
            <view class="total-price"
              >{{ showEstimatedPrice ? "预估:" : "总计:" }}
              <text class="total-price-value"
                ><text class="symbol">¥</text>{{ displayPrice }}</text
              ></view
            >
          </view>
          <OIButton
            class="submit-btn"
            type="default"
            size="huge"
            round
            shadow
            theme="yellow"
            :disabled="submitting || !isFormValid"
            @click="handleSubmit"
          >
            立即报名
          </OIButton>
        </view>
      </FixedBottomBar>
    </view>
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from "vue"
import Taro, { useRouter } from "@tarojs/taro"
import RegistrationTimeSelector from "../components/RegistrationTimeSelector.vue"
import CourseSelector from "../components/CourseSelector.vue"
import ChildSelector from "../components/ChildSelector.vue"
import GuardianSelector from "../components/GuardianSelector.vue"
import GoodInfo from "../components/GoodInfo.vue"
import FixedBottomBar from "@/components/FixedBottomBar.vue"
import Loading from "@/components/Loading/index.vue"
import OIButton from "@/components/Ui/button/index.vue"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import type { TimeSlot } from "../components/TimeSlotSelector.vue"
import type { Course } from "../components/CourseSelector.vue"
import { getGoodInfo } from "@/api/good"
import { getNavBarHeight } from "@/utils/statusBar"
import { getCourseStockSelector } from "@/api/course"
import { formatDate } from "@/utils/date"
import { track, trackClick } from "@/utils/analytics"
import { calculateDiscountedPrice, formatAmount } from "@/utils/priceCalculator"
import { centsToYuan } from "@/utils/formatPrice"

interface ChildInfoForm {
  studentName: string
  studentIdentityCard: string
  studentSex: string
  studentAge: number
  id?: string
}

interface GuardianInfoForm {
  parentName: string
  parentPhone: string
  parentSex: string
}

// 获取路由参数
const router = useRouter()
const goodId = router.params.id as string
const userCouponId = router.params.userCouponId as string

// 商品信息
const goodInfo = ref<any>(null)
const loading = ref(true)
const submitting = ref(false)

// 提交表单数据
const form = reactive({
  goodId: goodId,
  date: "",
  period: "",
  courseId: ""
})

// 营员信息表单
const childForm = reactive<ChildInfoForm>({
  studentName: "",
  studentIdentityCard: "",
  studentSex: "",
  studentAge: 0,
  id: ""
})

// 监护人信息表单
const guardianForm = reactive<GuardianInfoForm>({
  parentName: "",
  parentPhone: "",
  parentSex: ""
})

// 可预约日期和时间段
const availableDates = ref<{ date: string; stockRemain: number }[]>([])
const timeSlots = ref<TimeSlot[]>([])

// 课程列表
const courseList = ref<Course[]>([])
const selectedCourseId = ref("")

// 选中的课程名称（从courseList中查找）
const selectedCourseName = computed(() => {
  if (!selectedCourseId.value) return ""
  const course = courseList.value.find(c => c.courseId === selectedCourseId.value)
  return course?.courseName || ""
})

// 表单验证
const isFormValid = computed(() => {
  console.log("isFormValid", childForm)
  // 如果是多选一的单日营，需要验证课程选择
  const needCourseSelection = isMultiCourseSelection.value
  return (
    form.date &&
    (form.period || form.date.includes("到")) && // 多日营的period可以为空
    (!needCourseSelection || form.courseId) && // 多选一时需要选择课程
    childForm.studentName &&
    childForm.studentSex &&
    childForm.studentAge > 0 &&
    guardianForm.parentName &&
    guardianForm.parentPhone &&
    guardianForm.parentSex
  )
})

// 是否显示不预约直接购买按钮
const showNoAppointmentButton = computed(() => {
  // 检查是否为单日营且isPushAppointmentInfo为true
  const isSingleDay =
    goodInfo.value?.content?.goodCategories?.[0]?.courses?.[0]?.courseType === "single"
  const isPushAppointmentInfo = goodInfo.value?.isPushAppointmentInfo === true
  return isSingleDay && isPushAppointmentInfo
})

// 是否需要显示课程选择（多选一的单日营商品）
const isMultiCourseSelection = computed(() => {
  // 只有一个分类，但有多个单日营课程
  const categories = goodInfo.value?.content?.goodCategories || []
  if (categories.length !== 1) return false

  const courses = categories[0]?.courses || []
  if (courses.length <= 1) return false

  // 检查是否都是单日营
  return courses.every((course: any) => course.courseType === "single")
})

// 分类名称和总课程数
const categoryInfo = computed(() => {
  const categories = goodInfo.value?.content?.goodCategories || []
  if (categories.length === 0) return { name: "", totalCount: 0 }

  const category = categories[0]
  return {
    name: category.categoryName || ""
  }
})

// 是否显示预估价格
const showEstimatedPrice = computed(() => {
  return (
    goodInfo.value?.maxDiscountAmount !== undefined &&
    goodInfo.value.maxDiscountAmount > 0 &&
    goodInfo.value.price !== undefined &&
    goodInfo.value.maxDiscountAmount <= goodInfo.value.price
  )
})

// 显示的价格（原价或预估价）
const displayPrice = computed(() => {
  if (!goodInfo.value?.price) return 0

  // 先将分转换为元
  const priceInYuan = centsToYuan(goodInfo.value.price)
  const maxDiscountInYuan = goodInfo.value.maxDiscountAmount || 0

  if (showEstimatedPrice.value && maxDiscountInYuan) {
    // 计算预估价格 = 原价 - 最大优惠金额
    const estimatedPrice = calculateDiscountedPrice(priceInYuan, maxDiscountInYuan)
    return formatAmount(estimatedPrice)
  }

  return formatAmount(priceInYuan)
})

// 原始课程库存数据
const courseStockItems = ref<any[]>([])

// 获取商品信息
const fetchGoodInfo = async (needTrack = true) => {
  try {
    loading.value = true
    const res = await getGoodInfo(goodId)
    goodInfo.value = res.info
    needTrack &&
      track(
        goodInfo.value.goodType === "multi"
          ? "enter_multi_day_booking"
          : "enter_single_day_booking",
        {
          product_name: goodInfo.value.name,
          product_id: goodInfo.value.id
        }
      )

    // 处理课程列表
    const categories = goodInfo.value?.content?.goodCategories || []
    if (categories.length > 0 && categories[0]?.courses) {
      courseList.value = categories[0].courses.map((course: any) => ({
        courseId: course.courseId,
        courseName: course.courseName,
        coursePrice: course.coursePrice,
        courseType: course.courseType
      }))

      // 如果只有一个课程，自动选中
      selectedCourseId.value = courseList.value[0].courseId
      form.courseId = courseList.value[0].courseId
    }

    // 如果有课程信息，加载可预约时间
    if (goodInfo.value?.content?.goodCategories?.[0]?.courses?.[0]) {
      const firstCourse = goodInfo.value.content.goodCategories[0].courses[0]
      await fetchCourseTimeSlots(firstCourse.courseId)
    }
  } catch (error) {
    console.error("获取商品信息失败", error)
    Taro.showToast({
      title: "获取商品信息失败，请重试",
      icon: "none"
    })
  } finally {
    loading.value = false
  }
}

// 自动选择最近有库存的时间
const autoSelectAvailableTime = () => {
  if (availableDates.value.length === 0) {
    return
  }

  // 找到最近的有库存日期
  const today = new Date()
  const todayStr = formatDate(today)
  const sortedDates = availableDates.value
    .filter(date => date.stockRemain > 0 && date.date !== todayStr)
    .sort((a, b) => {
      if (a.date.includes("到")) {
        return new Date(a.date.split("到")[0]).getTime() - new Date(b.date.split("到")[0]).getTime()
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
    .filter(
      date => new Date(date.date.includes("到") ? date.date.split("到")[0] : date.date) > today
    )

  if (sortedDates.length > 0) {
    const selectedDate = sortedDates[0].date

    // 获取该日期的可用时间段
    const selectedDateSlots = courseStockItems.value.filter(item => item.date === selectedDate)
    const availableSlots = selectedDateSlots.filter(item => item.stockRemain > 0)

    if (availableSlots.length > 0) {
      // 选择第一个有库存的时间段
      const selectedSlot = availableSlots[0]

      // 更新表单数据
      form.date = selectedDate
      form.period = selectedSlot.period || "" // 多日营的period可能为空

      // 更新时间段列表
      timeSlots.value = selectedDateSlots.map(item => ({
        period: item.period,
        stock: item.stock,
        stockRemain: item.stockRemain
      }))
    }
  }
}

// 获取课程可预约时间
const fetchCourseTimeSlots = async (courseId: string) => {
  try {
    // 计算查询的日期范围（当前日期起的365天）
    const currentDate = new Date()
    const startDate = formatDate(currentDate)

    const endDate = new Date(currentDate)
    endDate.setDate(currentDate.getDate() + 365)
    const endDateStr = formatDate(endDate)

    // 调用API获取课程可预约时间
    const res = await getCourseStockSelector({
      courseId,
      startDate,
      endDate: endDateStr
    })

    // 保存原始数据，用于后续筛选时间段
    courseStockItems.value = res.items

    // 处理可预约日期数据
    const dateMap = new Map<string, number>()
    const todayStr = formatDate(currentDate)

    courseStockItems.value.forEach(item => {
      // 过滤掉当天日期
      if (item.date === todayStr) {
        return
      }

      // 保留所有日期,包括库存为0的日期,用于显示"已约满"
      if (dateMap.has(item.date)) {
        dateMap.set(item.date, dateMap.get(item.date)! + item.stockRemain)
      } else {
        dateMap.set(item.date, item.stockRemain)
      }
    })

    availableDates.value = Array.from(dateMap.entries()).map(([date, stockRemain]) => ({
      date,
      stockRemain
    }))

    // 自动选择最近有库存的日期和时间段
    autoSelectAvailableTime()
  } catch (error) {
    console.error("获取课程可预约时间失败", error)
    Taro.showToast({
      title: "获取课程可预约时间失败，请重试",
      icon: "none"
    })
  }
}

// 处理报名时间变更
const handleRegistrationTimeChange = (value: { date: string; period: string }) => {
  form.date = value.date
  form.period = value.period

  // 更新可选时间段
  if (value.date) {
    try {
      const selectedDateSlots = courseStockItems.value.filter(item => item.date === value.date)
      timeSlots.value = selectedDateSlots.map(item => ({
        period: item.period,
        stock: item.stock,
        stockRemain: item.stockRemain
      }))
    } catch (error) {
      console.error("处理时间段数据失败", error)
      timeSlots.value = []
    }
  } else {
    timeSlots.value = []
  }
}

// 处理孩子选择变更
const handleChildChange = (child: any) => {
  console.log("选择的营员信息:", child)
  childForm.studentName = child.studentName
  childForm.studentIdentityCard = child.studentIdentityCard || ""
  childForm.studentSex = child.studentSex || ""
  childForm.studentAge = child.studentAge || 0
  childForm.id = child.id
}

// 处理孩子加载
const handleChildLoad = (childList: any) => {
  console.log("孩子加载", childList)
}

// 处理监护人选择变更
const handleGuardianChange = (guardian: any) => {
  console.log("选择的监护人信息:", guardian)
  guardianForm.parentName = guardian.parentName
  guardianForm.parentPhone = guardian.parentPhone
  guardianForm.parentSex = guardian.parentSex
}

// 处理监护人加载
const handleGuardianLoad = (guardianList: any) => {
  console.log("监护人加载", guardianList)
}

// 处理课程选择变更
const handleCourseChange = (course: any) => {
  console.log("选择的课程信息:", course)
  selectedCourseId.value = course.courseId
  form.courseId = course.courseId

  // 切换课程后，重新加载该课程的可预约时间
  fetchCourseTimeSlots(course.courseId)
}
// 提交订单（跳转到确认页二次确认）
const handleSubmit = async () => {
  if (submitting.value) return

  // 验证课程选择
  if (isMultiCourseSelection.value && !form.courseId) {
    Taro.showToast({
      title: "请选择课程",
      icon: "none"
    })
    return
  }

  if (!form.date || (!form.period && !form.date.includes("到"))) {
    Taro.showToast({
      title: "请选择预约日期和时间段",
      icon: "none"
    })
    return
  }
  trackClick("sign_up")
  try {
    submitting.value = true

    // 实时接口拉取最新商品状态
    const res = await getGoodInfo(goodId)
    goodInfo.value = res.info
    // 校验商品上架状态
    if (goodInfo.value?.status !== "putOn") {
      Taro.showToast({
        title: "您选择的商品已下架",
        icon: "none",
        duration: 1800,
        mask: true
      })
      setTimeout(() => {
        Taro.navigateBack({ delta: 2 })
      }, 1800)
      return
    }

    // 实时接口拉取库存，校验库存
    try {
      // 如果是多选一，使用选中的课程ID；否则使用第一个课程ID
      let courseIdToCheck = ""
      if (isMultiCourseSelection.value && form.courseId) {
        courseIdToCheck = form.courseId
      } else {
        const firstCourse = goodInfo.value?.content?.goodCategories?.[0]?.courses?.[0]
        courseIdToCheck = firstCourse?.courseId
      }

      if (!courseIdToCheck) throw new Error("课程信息缺失")
      // 重新获取该课程最新库存
      const currentDate = new Date()
      const startDate = formatDate(currentDate)
      const endDate = new Date(currentDate)
      endDate.setDate(currentDate.getDate() + 365)
      const endDateStr = formatDate(endDate)
      const stockRes = await getCourseStockSelector({
        courseId: courseIdToCheck,
        startDate,
        endDate: endDateStr
      })
      courseStockItems.value = stockRes.items
      // 校验库存
      let hasStock = false
      if (form.date) {
        hasStock = courseStockItems.value.some(
          item =>
            item.date === form.date &&
            (!form.period || item.period === form.period) &&
            item.stockRemain > 0
        )
      }
      if (!hasStock) {
        Taro.showToast({
          title: "当前时间商品库存不足",
          icon: "none"
        })
        // 清空日期和时间段选择
        form.date = ""
        form.period = ""
        // 保持刷新了库存状态
        availableDates.value = [] // 清空后强制重新渲染（不影响已有逻辑）
        await fetchGoodInfo(false) // 重新拉取页面全部状态
        return
      }
    } catch {
      Taro.showToast({
        title: "查询库存失败，请重试",
        icon: "none"
      })
      return
    }

    // 不允许选择当天报名
    const todayStr = formatDate(new Date())
    if (form.date === todayStr || form.date.startsWith(todayStr + "到")) {
      Taro.showToast({
        title: "当天不可报名，请选择其他日期",
        icon: "none"
      })
      return
    }

    if (!childForm.studentName || !childForm.studentSex || childForm.studentAge <= 0) {
      Taro.showToast({
        title: "请完善营员信息",
        icon: "none"
      })
      return
    }

    // 验证监护人信息
    if (!guardianForm.parentName || !guardianForm.parentPhone || !guardianForm.parentSex) {
      Taro.showToast({
        title: "请完善监护人信息",
        icon: "none"
      })
      return
    }

    // 验证监护人手机号
    if (!/^1\d{10}$/.test(guardianForm.parentPhone)) {
      Taro.showToast({
        title: "请输入正确的监护人手机号",
        icon: "none"
      })
      return
    }

    if (!isFormValid.value) {
      Taro.showToast({
        title: "请完善订单信息",
        icon: "none"
      })
      return
    }

    let query =
      `?goodId=${encodeURIComponent(form.goodId)}&date=${encodeURIComponent(
        form.date
      )}&period=${encodeURIComponent(form.period)}` +
      `&studentName=${encodeURIComponent(
        childForm.studentName
      )}&studentIdentityCard=${encodeURIComponent(childForm.studentIdentityCard)}` +
      `&studentSex=${encodeURIComponent(childForm.studentSex)}&studentAge=${encodeURIComponent(
        String(childForm.studentAge)
      )}` +
      `&parentName=${encodeURIComponent(guardianForm.parentName)}&parentPhone=${encodeURIComponent(
        guardianForm.parentPhone
      )}&parentSex=${encodeURIComponent(guardianForm.parentSex)}`

    // 如果是多选一，添加课程ID到查询参数
    if (isMultiCourseSelection.value && form.courseId) {
      query += `&courseId=${encodeURIComponent(form.courseId)}`
    }

    // 如果有营员ID，添加到查询参数中
    if (childForm.id) {
      query += `&studentId=${encodeURIComponent(childForm.id)}`
    }

    // 如果有优惠券ID，添加到查询参数中
    if (userCouponId) {
      query += `&userCouponId=${encodeURIComponent(userCouponId)}`
    }

    Taro.navigateTo({
      url: `/pages/order/confirm/index${query}`
    })
  } finally {
    setTimeout(() => {
      submitting.value = false
    }, 2000)
  }
}

// 初始化
onMounted(async () => {
  // 加载商品信息
  await fetchGoodInfo()

  // 检查是否从孩子列表页面返回
  const fromChildList = Taro.getStorageSync("selectedChild")
  if (fromChildList) {
    try {
      const childInfo = JSON.parse(fromChildList)
      childForm.studentName = childInfo.name
      childForm.studentIdentityCard = childInfo.idCard || ""
      childForm.studentSex = childInfo.gender || ""
      childForm.studentAge = childInfo.age || 0
      childForm.id = childInfo.id

      // 清除存储
      Taro.removeStorageSync("selectedChild")
    } catch (error) {
      console.error("解析营员信息失败", error)
    }
  }
})
</script>

<style lang="less">
.order-submit-content {
  overflow-y: auto;
  padding: 32rpx;

  .course-selector-box {
    margin-bottom: 32rpx;
  }

  .registration-time-selector {
    margin-bottom: 32rpx;
  }

  .child-info-box {
    margin-bottom: 32rpx;
  }

  .guardian-info-box {
    margin-bottom: 32rpx;
  }

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

    .price-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8rpx;

      .original-price {
        font-size: 24rpx;
        font-weight: 400;
        line-height: 24rpx;
        color: #999;
        text-decoration: line-through;

        .price-text {
          font-family: PingFang SC;
        }
      }

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
    }

    .submit-btn {
      width: 232px;
    }
  }
}
</style>
