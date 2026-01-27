<template>
  <tab-bar-layout
    tab-key="course"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{
      title: isUpdating ? '调整预约' : '课程预约'
    }"
  >
    <Loading v-if="loading" :fullscreen="true" text="加载中..." />

    <view
      v-else
      class="appointment-content"
      :style="{
        height: `calc(100vh - ${getNavBarHeight()}rpx - 162rpx - env(safe-area-inset-bottom))`
      }"
    >
      <view class="good-name" :class="{ 'single-course': !isMutiCourse }">
        <view class="good-name-text">{{ goodInfo?.name }}</view>
        <view
          v-if="goodInfo.content.goodCategories.length === 1"
          :class="getTagClass(goodInfo.content.goodCategories[0])"
          class="good-name-tag"
        >
          <view class="good-name-tag-text">{{
            showTagText(goodInfo.content.goodCategories[0])
          }}</view>
        </view>
      </view>

      <!-- 课程选择（多课程场景） -->
      <view v-if="isMutiCourse" class="course-selector-box">
        <CourseSelector
          v-model="form.courseId"
          :active-category-id="form.categoryId"
          :categories="courseCategories"
          :disabled="isUpdating"
          @change="handleCourseChange"
        />
      </view>

      <!-- 日期选择 -->
      <view class="section-box">
        <view class="section-title">预约日期</view>
        <view class="section-content">
          <DateSelector
            v-model:value="form.date"
            :available-dates="availableDates"
            :disabled="isUpdating"
            @change="handleDateChange"
          />
        </view>
      </view>

      <!-- 时间段选择 -->
      <view v-if="form.date" class="time-slot-box">
        <view class="time-slot-title">预约时段:</view>
        <TimeSlotSelector
          v-model="form.period"
          :time-slots="timeSlots"
          @change="handleTimeSlotChange"
        />
      </view>

      <!-- 添加营员信息 -->
      <view class="child-info-box">
        <view class="child-info-add" :class="{ 'no-child': isNoChild }" @tap="goToAddChild">
          <view class="section-title">添加营员信息</view>
          <view class="section-content">
            <view class="arrow-icon">
              <image
                src="https://fp.yangcong345.com/middle/1.0.3/right-arrow__w.png"
                mode="aspectFit"
              />
            </view>
          </view>
        </view>
        <ChildSelector v-model="childForm" @change="handleChildChange" @load="handleChildLoad" />
      </view>

      <!-- 添加监护人信息 -->
      <view class="guardian-info-box">
        <view
          class="guardian-info-add"
          :class="{ 'no-guardian': isNoGuardian }"
          @tap="goToAddGuardian"
        >
          <view class="section-title">添加监护人信息</view>
          <view class="section-content">
            <view class="arrow-icon">
              <image
                src="https://fp.yangcong345.com/middle/1.0.3/right-arrow__w.png"
                mode="aspectFit"
              />
            </view>
          </view>
        </view>
        <GuardianSelector
          v-model="guardianForm"
          @change="handleGuardianChange"
          @load="handleGuardianLoad"
        />
      </view>

      <!-- 家长信息 -->
      <view class="section-box">
        <ParentInfo
          ref="parentInfoRef"
          v-model="parentForm"
          :verification-code-type="verificationCodeType"
          @change="handleParentChange"
        />
      </view>

      <!-- 协议勾选 - 仅抖音和微店渠道显示 -->
      <AgreementCheckbox
        v-if="isDouyinOrWechatChannel"
        v-model:checked="agreementChecked"
        prefix="我已阅读并同意"
        :agreements="agreements"
      />
    </view>

    <!-- 底部预约按钮 -->
    <FixedBottomBar>
      <view class="button-group">
        <OIButton
          class="cancel-btn"
          type="hollow"
          size="huge"
          round
          :disabled="submitting"
          theme="white"
          border-color="black"
          @click="handleCancel"
        >
          取消
        </OIButton>
        <OIButton
          v-if="
            [OrderStatus.PENDING, OrderStatus.SUCCESS].includes(orderInfo?.status as OrderStatus)
          "
          class="confirm-btn"
          type="default"
          size="huge"
          round
          shadow
          theme="yellow"
          :disabled="submitting || (isDouyinOrWechatChannel && !agreementChecked)"
          @click="handleSubmit"
        >
          {{ isUpdating ? "调整" : "预约" }}
        </OIButton>
      </view>
    </FixedBottomBar>

    <!-- 确认弹窗 -->
    <OIModal
      v-model:visible="confirmModalVisible"
      :title="isUpdating ? '确定调整预约信息吗？' : '确定预约该时段课程吗？'"
      :content="'温馨提示：以上信息用于推送研学合同，购买旅行保险等实名制服务，请确保此信息真实有效，洋葱研学将通过加密等方式保护此信息。'"
      :left-button-text="'取消'"
      :right-button-text="isUpdating ? '确认调整' : '预约'"
      @left-button-click="handleConfirmModalLeftClick"
      @right-button-click="handleConfirmModalRightClick"
    />
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, nextTick } from "vue"
import Taro, { useRouter } from "@tarojs/taro"
import DateSelector from "./components/DateSelector.vue"
import TimeSlotSelector from "./components/TimeSlotSelector.vue"
import CourseSelector, { type Category } from "./components/CourseSelector.vue"
import ChildSelector from "./components/ChildSelector.vue"
import GuardianSelector from "./components/GuardianSelector.vue"
import ParentInfo, { type ParentInfoForm } from "./components/ParentInfo.vue"
import FixedBottomBar from "@/components/FixedBottomBar.vue"
import Loading from "@/components/Loading/index.vue"
import OIButton from "@/components/Ui/button/index.vue"
import TabBarLayout from "@/components/TabBarLayout/index.vue"
import OIModal from "@/components/Ui/modal/index.vue"
import AgreementCheckbox from "@/components/AgreementCheckbox/index.vue"
import type { TimeSlot } from "./components/TimeSlotSelector.vue"
import { getOrderGoodInfo } from "@/api/order"
import { getNavBarHeight } from "@/utils/statusBar"
import {
  getCourseStockSelector,
  createCourseAppointment,
  getCourseAppointmentInfo,
  updateCourseAppointment
} from "@/api/course"
import { formatDate } from "@/utils/date"
import { OrderStatus } from "@/types/order"
import { getUserInfo } from "@/api/user"
import { queryParentInfo } from "@/api/parent"
import { getUserBindStudentList } from "@/api/child"

interface ChildInfoForm {
  studentName: string
  studentIdentityCard: string
  studentSex: string
  studentAge: number
  id?: string // 孩子ID，选择已有孩子时使用
}

interface GuardianInfoForm {
  parentName: string
  parentPhone: string
  parentSex: string
}

// 获取路由参数
const router = useRouter()

// 订单ID和商品信息
const orderId = router.params.id as string
// 获取appointmentId，用于判断是否是调整预约
const appointmentId = router.params.appointmentId as string
// 获取来源页面，用于提交预约时跳转到正确的页面
const fromPage = router.params.from as string // 'order' 或 'appointment'
const orderInfo = ref<any>(null)
const goodInfo = ref<any>(null)
const channelInfo = ref<any>(null)
const loading = ref(true)
const submitting = ref(false)
const isUpdating = computed(() => !!appointmentId) // 是否是调整预约

// 确认弹窗状态
const confirmModalVisible = ref(false)
const agreementChecked = ref(false)
const verificationCodeType = computed(() => {
  return channelInfo.value?.verificationCodeType
})

// 判断是否是抖音或微店渠道
const isDouyinOrWechatChannel = computed(() => {
  const channelName = channelInfo.value?.name
  return channelName === "抖音" || channelName === "微店"
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
  // 如果后台没有返回，使用默认协议
  return [
    {
      name: "《洋葱星球研学基地小程序付费协议》",
      url: "/pages/user/agreement/index?type=payment"
    }
  ]
})

// 判断是否是多课程预约
const isMutiCourse = computed(() => {
  return (
    goodInfo.value?.content?.goodCategories?.length > 1 ||
    goodInfo.value?.content?.goodCategories?.[0]?.courses?.length > 1
  )
})

// 课程分类数据
const courseCategories = ref<Category[]>([])

// 预约表单数据
const form = reactive({
  orderId: orderId,
  categoryId: "",
  courseId: "",
  date: "",
  period: ""
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

// 家长信息表单
const parentForm = reactive<ParentInfoForm>({
  parentAccompany: "unknown",
  verificationCode: "",
  parentRemark: ""
})

// 可预约日期和时间段
const availableDates = ref<{ date: string; stockRemain: number }[]>([])
const timeSlots = ref<TimeSlot[]>([])

// 表单验证
const isFormValid = computed(() => {
  return (
    form.courseId &&
    form.date &&
    form.period &&
    childForm.studentName &&
    childForm.studentSex &&
    childForm.studentAge > 0 &&
    guardianForm.parentName &&
    guardianForm.parentPhone &&
    (parentForm.verificationCode || verificationCodeType.value === "none")
  )
})

// 原始课程库存数据
const courseStockItems = ref<any[]>([])

// 引用ParentInfo组件
const parentInfoRef = ref<any>(null)

// 判断是否需要推送合同
const needPushContract = computed(() => {
  // 检查当前选择的课程是否需要推送合同
  if (!form.courseId || !goodInfo.value?.content?.goodCategories) {
    return false
  }

  for (const category of goodInfo.value.content.goodCategories) {
    for (const course of category.courses) {
      if (course.courseId === form.courseId) {
        return course.isPushContractRequired || false
      }
    }
  }

  return false
})

// 获取商品信息
const fetchGoodInfo = async () => {
  try {
    loading.value = true
    // 调用真实API获取订单商品信息
    const res = await getOrderGoodInfo(orderId)
    goodInfo.value = res.goodInfo
    orderInfo.value = res.orderInfo
    channelInfo.value = res.channelInfo

    // 处理课程分类数据
    if (goodInfo.value?.content?.goodCategories) {
      courseCategories.value = goodInfo.value.content.goodCategories
      // 如果只有一个课程分类，默认选择第一个isAppointment为false的课程
      if (courseCategories.value.length === 1 && courseCategories.value[0].courses.length > 0) {
        let firstCourse = courseCategories.value[0].courses.find(course => !course.isAppointment)
        if (!firstCourse) {
          firstCourse = courseCategories.value[0].courses[0]
        }
        form.courseId = firstCourse.courseId
        form.categoryId = courseCategories.value[0].categoryId

        // 加载课程可预约时间
        await fetchCourseTimeSlots(firstCourse.courseId)
      }
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

// 获取课程可预约时间
const fetchCourseTimeSlots = async (courseId: string, isUpdating: boolean = false) => {
  try {
    // 计算查询的日期范围（当前日期起的365天）
    const currentDate = new Date()
    const startDate = formatDate(currentDate)

    const endDate = new Date(currentDate)
    // 延长预约时间到1年
    endDate.setDate(currentDate.getDate() + 365)
    const endDateStr = formatDate(endDate)

    // 调用真实API获取课程可预约时间
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

      if (item.stockRemain > 0) {
        if (dateMap.has(item.date)) {
          dateMap.set(item.date, dateMap.get(item.date)! + item.stockRemain)
        } else {
          dateMap.set(item.date, item.stockRemain)
        }
      }
    })

    availableDates.value = Array.from(dateMap.entries()).map(([date, stockRemain]) => ({
      date,
      stockRemain
    }))

    // 清空已选择的日期和时间段
    if (!isUpdating) {
      form.date = ""
      form.period = ""
      timeSlots.value = []
    }
  } catch (error) {
    console.error("获取课程可预约时间失败", error)
    Taro.showToast({
      title: "获取课程可预约时间失败，请重试",
      icon: "none"
    })
  }
}

// 处理课程变更
const handleCourseChange = (course: any) => {
  form.courseId = course.courseId
  form.categoryId = course.categoryId

  // 加载课程可预约时间
  fetchCourseTimeSlots(course.courseId)
}

// 处理日期变更
const handleDateChange = (date: string, isUpdating: boolean = false) => {
  form.date = date

  // 更新可选时间段
  if (date) {
    try {
      const selectedDateSlots = courseStockItems.value.filter(item => item.date === date)
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
  // 清空已选择的时间段
  if (!isUpdating) {
    form.period = ""
  }
}

// 处理时间段变更
const handleTimeSlotChange = (period: string) => {
  form.period = period
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

const isNoChild = ref(false)
const isNoGuardian = ref(false)
// 处理孩子加载
const handleChildLoad = (childList: any) => {
  console.log("孩子加载", childList)
  isNoChild.value = childList.length === 0
}

// 跳转到添加孩子页面
const goToAddChild = () => {
  Taro.navigateTo({
    url: "/pages/user/familyInfo/childInfo/form"
  })
}

// 跳转到添加监护人页面
const goToAddGuardian = () => {
  Taro.navigateTo({
    url: "/pages/user/familyInfo/parentInfo/form"
  })
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
  isNoGuardian.value = guardianList.length === 0
}

// 处理家长信息变更
const handleParentChange = (parent: any) => {
  console.log("家长信息:", parent)
  parentForm.parentAccompany = parent.parentAccompany
  parentForm.verificationCode = parent.verificationCode
  parentForm.parentRemark = parent.parentRemark
  console.log("parentForm", parentForm)
}

// 获取预约记录信息
const fetchAppointmentInfo = async () => {
  try {
    loading.value = true
    const res = await getCourseAppointmentInfo(appointmentId)
    const appointmentInfo = res.info

    if (appointmentInfo) {
      console.log("appointmentInfo", appointmentInfo)

      // 回显预约信息
      form.courseId = appointmentInfo.courseId || ""
      form.categoryId = appointmentInfo.categoryId || ""
      form.date = appointmentInfo.date || ""
      form.period = appointmentInfo.period || ""

      // 回显营员信息
      childForm.studentName = appointmentInfo.studentName || ""
      childForm.studentIdentityCard = appointmentInfo.studentIdentityCard || ""
      childForm.studentSex = appointmentInfo.studentSex || ""
      childForm.studentAge = appointmentInfo.studentAge || 0
      childForm.id = appointmentInfo.id || ""

      // 回显监护人信息
      guardianForm.parentName = (appointmentInfo as any).parentName || ""
      guardianForm.parentPhone = (appointmentInfo as any).parentPhone || ""
      guardianForm.parentSex = (appointmentInfo as any).parentSex || ""

      // 回显家长信息
      parentForm.parentAccompany = appointmentInfo.parentAccompany || "unknown"
      parentForm.verificationCode = appointmentInfo.verificationCode || ""
      parentForm.parentRemark = appointmentInfo.parentRemark || ""

      // 如果是调整预约，加载并验证监护人列表和营员列表
      // 判断之前预约的监护人和孩子信息是否没有被删除
      try {
        const [guardianRes, childRes] = await Promise.all([
          queryParentInfo(),
          getUserBindStudentList()
        ])

        const guardianList = guardianRes.parentInfo || []
        const childList = childRes.list || []

        // 验证营员信息是否还在列表中
        if (childForm.id || childForm.studentIdentityCard) {
          const childExists = childList.some(
            child =>
              (childForm.id && child.id === childForm.id) ||
              (childForm.studentIdentityCard &&
                child.studentIdentityCard === childForm.studentIdentityCard)
          )
          if (!childExists) {
            console.warn("预约信息中的营员已被删除", {
              id: childForm.id,
              identityCard: childForm.studentIdentityCard
            })
            // 重置营员信息
            childForm.studentName = ""
            childForm.studentIdentityCard = ""
            childForm.studentSex = ""
            childForm.studentAge = 0
            childForm.id = ""
            Taro.showToast({
              title: "预约信息中的营员已被删除，请重新选择",
              icon: "none",
              duration: 3000
            })
          }
        }

        // 验证监护人信息是否还在列表中
        if (guardianForm.parentPhone) {
          const guardianExists = guardianList.some(
            guardian => guardian.parentPhone === guardianForm.parentPhone
          )
          if (!guardianExists) {
            console.warn("预约信息中的监护人已被删除", {
              phone: guardianForm.parentPhone
            })
            // 重置监护人信息
            guardianForm.parentName = ""
            guardianForm.parentPhone = ""
            guardianForm.parentSex = ""
            Taro.showToast({
              title: "预约信息中的监护人已被删除，请重新选择",
              icon: "none",
              duration: 3000
            })
          }
        }
      } catch (error) {
        console.error("验证监护人和营员信息失败", error)
        // 验证失败不影响主流程，只记录错误
      }

      // 如果有核销码，使用ref方法设置
      if (appointmentInfo.verificationCode && parentInfoRef.value) {
        // 使用组件暴露的方法设置核销码
        nextTick(() => {
          parentInfoRef.value.setVerificationCode(appointmentInfo.verificationCode)
        })
      }

      // 如果有日期，加载时间段
      if (form.date && form.courseId) {
        await fetchCourseTimeSlots(form.courseId, isUpdating.value)
        // 更新可选时间段
        handleDateChange(form.date, isUpdating.value)
      }
    }
  } catch (error) {
    console.error("获取预约记录信息失败", error)
    Taro.showToast({
      title: "获取预约记录信息失败，请重试",
      icon: "none"
    })
  } finally {
    loading.value = false
  }
}

//获取最新提交的家长信息并填入表单
const fetchParentInfo = async () => {
  const userInfoResponse = await getUserInfo()
  if (userInfoResponse.userInfo && userInfoResponse.userInfo.id) {
    // 填入表单
    const appointmentInfo = userInfoResponse.userInfo.userAppointmentInfo
    if (appointmentInfo) {
      parentForm.parentAccompany = appointmentInfo.parentAccompany || "unknown"
    }
  }
}

// 提交预约
const handleSubmit = async (showConfirm = true) => {
  if (submitting.value) return

  // 如果是抖音或微店渠道，验证协议勾选
  if (isDouyinOrWechatChannel.value && !agreementChecked.value) {
    Taro.showToast({
      title: "请先同意相关协议",
      icon: "none"
    })
    return
  }

  if (!form.courseId || !form.date || !form.period) {
    Taro.showToast({
      title: "请选择预约课程、日期和时间段",
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
  if (!guardianForm.parentName || !guardianForm.parentPhone) {
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

  if (!parentForm.verificationCode && verificationCodeType.value !== "none") {
    Taro.showToast({
      title: "请上传核销码",
      icon: "none"
    })
    return
  }

  if (!isFormValid.value) {
    Taro.showToast({
      title: "请完善预约信息",
      icon: "none"
    })
    return
  }

  // 通用数据
  const commonData = {
    date: form.date,
    period: form.period,
    studentName: childForm.studentName,
    studentIdentityCard: childForm.studentIdentityCard,
    studentSex: childForm.studentSex,
    studentAge: childForm.studentAge,
    parentName: guardianForm.parentName,
    parentPhone: guardianForm.parentPhone,
    parentAccompany: parentForm.parentAccompany,
    verificationCode: parentForm.verificationCode,
    parentRemark: parentForm.parentRemark
  }

  // 构建提交数据
  const appointmentData = {
    ...commonData,
    orderId: form.orderId,
    categoryId: form.categoryId,
    courseId: form.courseId
  }

  console.log("commonData", commonData)
  console.log("appointmentData", appointmentData)

  // 根据是否需要推送合同来决定是否显示确认弹窗
  if (needPushContract.value && showConfirm) {
    confirmModalVisible.value = true
  } else {
    // 直接提交
    await handleConfirmModalRightClick()
  }
}

// 取消预约
const handleCancel = () => {
  console.log("取消预约")
  Taro.navigateBack()
}

// 确认弹窗处理
const handleConfirmModalRightClick = async () => {
  if (submitting.value) return

  try {
    submitting.value = true

    // 通用数据
    const commonData = {
      date: form.date,
      period: form.period,
      studentName: childForm.studentName,
      studentIdentityCard: childForm.studentIdentityCard,
      studentSex: childForm.studentSex,
      studentAge: childForm.studentAge,
      parentName: guardianForm.parentName,
      parentPhone: guardianForm.parentPhone,
      parentAccompany: parentForm.parentAccompany,
      verificationCode: parentForm.verificationCode,
      parentRemark: parentForm.parentRemark
    }

    // 构建提交数据
    const appointmentData = {
      ...commonData,
      orderId: form.orderId,
      categoryId: form.categoryId,
      courseId: form.courseId
    }

    if (isUpdating.value) {
      // 调整预约
      const updateData = {
        ...commonData,
        id: appointmentId
      }
      await updateCourseAppointment(updateData)
    } else {
      // 新建预约
      await createCourseAppointment(appointmentData)
    }

    Taro.showToast({
      title: isUpdating.value ? "调整成功" : "预约成功",
      icon: "success"
    })

    // 根据来源页面跳转到对应的页面
    setTimeout(() => {
      if (isUpdating.value) {
        Taro.navigateBack()
      } else {
        // 根据 fromPage 参数决定跳转到哪个页面
        if (fromPage === "order") {
          // 从我的订单进入，返回到我的订单页面
          Taro.redirectTo({
            url: "/pages/order/list/index"
          })
        } else {
          // 从预约列表或其他地方进入，返回到预约列表页面
          Taro.switchTab({
            url: "/pages/appointment/list/index"
          })
        }
      }
    }, 1500)
  } catch (error) {
    console.error("提交预约失败", error)
  } finally {
    setTimeout(() => {
      submitting.value = false
    }, 2000)
  }
}

// 取消确认弹窗
const handleConfirmModalLeftClick = () => {
  confirmModalVisible.value = false
}

// 初始化
onMounted(async () => {
  // 加载商品信息
  await fetchGoodInfo()

  if (appointmentId) {
    // 如果是调整预约，获取预约记录信息
    await fetchAppointmentInfo()
  } else {
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
    } else {
      // 如果是新建预约，获取上次最新提交的家长信息
      await fetchParentInfo()
    }
  }
})
export interface goodCategoryItem {
  categoryId: string
  categoryName: string
  useTimes: number
  alreadyAppointmentUseTimes: number
}
const getTagClass = (item: goodCategoryItem) => {
  if (item.alreadyAppointmentUseTimes === 0) {
    return "tag-pending"
  }
  if (item.alreadyAppointmentUseTimes === item.useTimes) {
    return "tag-completed"
  }
  return "tag-partial"
}
const showTagText = (item: goodCategoryItem) => {
  if (item.alreadyAppointmentUseTimes === 0) {
    return "待预约"
  }
  if (item.alreadyAppointmentUseTimes === item.useTimes) {
    return "已完成"
  }
  return `已预约${item.alreadyAppointmentUseTimes}/${item.useTimes}`
}
</script>

<style lang="less">
.appointment-content {
  overflow-y: auto;
  padding: 32rpx 32rpx 100rpx 32rpx;

  .good-name {
    display: flex;
    gap: 10rpx;
    font-size: 36rpx;
    font-weight: 600;
    line-height: 48rpx;
    letter-spacing: normal;
    color: #393548;
    max-width: 90%;
    .good-name-text {
      //超过两行省略号显示
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      max-width: 80%;
    }
    .good-name-tag {
      margin-top: -4rpx;
      padding: 4rpx 8rpx;
      border-radius: 13rpx;
      height: 26rpx;

      .good-name-tag-text {
        font-family: "PingFang SC", sans-serif;
        font-size: 18rpx;
        font-weight: normal;
        line-height: 18rpx;
        letter-spacing: normal;
        color: #fff;
      }

      &.tag-pending {
        background: #fea345;
      }

      &.tag-completed {
        background: linear-gradient(90deg, #4ecb71 0%, #44c768 100%);
      }

      &.tag-partial {
        background: #518aff;
      }
    }
  }

  .single-course {
    margin-bottom: 32rpx;
  }

  .section-box {
    margin-bottom: 24rpx;
    padding: 32rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 16rpx 0 rgba(0, 0, 0, 0.04);
    display: flex;
    justify-content: space-between;
    align-items: center;

    .section-title {
      font-size: 28rpx;
      font-weight: 600;
      line-height: 28rpx;
      letter-spacing: normal;
      color: #393548;
    }
  }

  .child-info-box {
    margin-bottom: 24rpx;
    padding: 32rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 16rpx 0 rgba(0, 0, 0, 0.04);

    .child-info-add {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 34rpx;
      border-bottom: 1rpx solid #eee;

      &.no-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .section-title {
        font-size: 28rpx;
        font-weight: 600;
        line-height: 28rpx;
        letter-spacing: normal;
        color: #393548;
      }

      .arrow-icon {
        width: 32px;
        height: 32px;

        image {
          width: 100%;
          height: 100%;
        }
      }
    }
  }

  .guardian-info-box {
    margin-bottom: 24rpx;
    padding: 32rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 16rpx 0 rgba(0, 0, 0, 0.04);

    .guardian-info-add {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 34rpx;
      border-bottom: 1rpx solid #eee;

      &.no-guardian {
        border-bottom: none;
        padding-bottom: 0;
      }

      .section-title {
        font-size: 28rpx;
        font-weight: 600;
        line-height: 28rpx;
        letter-spacing: normal;
        color: #393548;
      }

      .arrow-icon {
        width: 32px;
        height: 32px;

        image {
          width: 100%;
          height: 100%;
        }
      }
    }
  }

  .time-slot-box {
    margin-bottom: 24rpx;
    padding: 32rpx;
    background: #fff;
    border-radius: 16rpx;

    .time-slot-title {
      font-size: 28rpx;
      font-weight: 600;
      line-height: 28rpx;
      letter-spacing: normal;
      color: #504b64;
      margin-bottom: 24rpx;
    }
  }
}
.button-group {
  display: flex;
  padding: 32rpx;
  gap: 32rpx;

  .cancel-btn {
    width: 260rpx;
  }

  .confirm-btn {
    flex: 1;
  }
}
</style>
