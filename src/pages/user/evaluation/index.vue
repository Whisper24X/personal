<template>
  <tab-bar-layout
    tab-key="evaluation"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{
      title: '课程评价'
    }"
  >
    <view class="evaluation">
      <view class="evaluation-container">
        <!-- 课程信息卡片 -->
        <view class="course-info-card">
          <view class="course-name">{{ appointmentInfo.courseName }}</view>
          <view class="course-date">出行日期：{{ appointmentInfo.date }}</view>
          <view class="divider"></view>
          <view class="rating-container">
            <rating-selector
              v-model="form.rating"
              title="总体评价"
              icon-type="smile"
              :title-style="{ fontWeight: '600' }"
            />
            <view v-if="form.rating > 0" class="evaluation-dimension">
              <view
                v-for="item in evaluationDimension"
                :key="item.name"
                class="evaluation-dimension-item"
              >
                <rating-selector v-model="item.score" :title="item.name" />
              </view>
            </view>
          </view>
        </view>
        <!-- 标签选择 -->
        <view class="evaluation-card">
          <tag-selector v-model="form.tags" :tags="evaluationTags" />
          <feedback-input
            v-model="form.comment"
            placeholder="请分享孩子的研学体验和收获，帮助我们不断改进课程质量。"
            :max-length="500"
          />
          <image-uploader
            v-model="form.images"
            upload-text="上传图片"
            :max-count="9"
            @update-uploading="updateUploading"
          />
        </view>
        <view class="tips">
          <view class="title">温馨提示</view>
          <rich-text class="content" :nodes="tipsText"></rich-text>
        </view>
      </view>

      <!-- 底部提交按钮 -->
      <view class="fixed-bottom-bar">
        <button
          class="submit-btn"
          :class="{ disabled: isDisabled }"
          :loading="submitting"
          :disabled="isDisabled"
          @tap="handleSubmit"
        >
          发布评论
        </button>
      </view>
    </view>

    <!-- 确认提交评价弹窗 -->
    <OnionModal
      v-model:visible="showConfirmModal"
      title="确认提交评价"
      content="评价提交后将不可修改，确定提交吗？"
      left-button-text="取消"
      right-button-text="确定"
      @left-button-click="handleCancelSubmit"
      @right-button-click="handleConfirmSubmit"
    />
  </tab-bar-layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue"
import Taro from "@tarojs/taro"

import TabBarLayout from "../../../components/TabBarLayout/index.vue"
import RatingSelector from "./components/RatingSelector.vue"
import TagSelector from "./components/TagSelector.vue"
import FeedbackInput from "./components/FeedbackInput.vue"
import ImageUploader from "./components/ImageUploader.vue"
import OnionModal from "../../../components/Ui/modal/index.vue"
import type { UploadFile } from "../../../utils/upload"
import { getCourseAppointmentInfo } from "../../../api/course"
import { createEvaluation, getEvaluationTemplate } from "../../../api/evaluation"

// 获取参数
const appointmentId = ref("")
const courseId = ref("")

// 加载状态
const submitting = ref(false)

// OnionModal 状态
const showConfirmModal = ref(false)

// 预约记录信息
const appointmentInfo = reactive({
  courseName: "",
  date: "",
  childName: "",
  parentName: "",
  phone: ""
})

// 表单数据
const form = reactive({
  appointmentId: "",
  courseId: "",
  rating: 0,
  tags: [] as string[],
  comment: "",
  images: [] as UploadFile[]
})
const isUploadingPicture = ref(false)
const updateUploading = (value: boolean) => {
  isUploadingPicture.value = value
}

const isDisabled = computed(() => {
  return (
    form.rating === 0 ||
    !form.comment ||
    evaluationDimension.value.some(item => item.score === 0) ||
    isUploadingPicture.value
  )
})

// 验证表单
const validateForm = () => {
  if (form.rating === 0) {
    Taro.showToast({
      title: "请完成课程评价",
      icon: "none"
    })
    return false
  }
  if (evaluationDimension.value.some(item => item.score === 0)) {
    Taro.showToast({
      title: "请完成每个维度的评价",
      icon: "none"
    })
    return false
  }
  if (!form.comment.trim()) {
    Taro.showToast({
      title: "请填写评价内容",
      icon: "none"
    })
    return false
  }
  return true
}

// 提交评价
const handleSubmit = () => {
  if (!validateForm()) return
  showConfirmModal.value = true
}

// 确认提交评价
const handleConfirmSubmit = async () => {
  try {
    submitting.value = true
    // 组装参数
    const params = {
      appointmentId: appointmentId.value,
      childName: appointmentInfo.childName,
      courseName: appointmentInfo.courseName,
      courseTime: appointmentInfo.date,
      evaluationLabel: form.tags,
      dimensionScore: evaluationDimension.value.map(item => `${item.name}:${item.score}`),
      feedBack: form.comment,
      feedBackImage: form.images.map(img => img.url),
      parentName: appointmentInfo.parentName,
      phone: appointmentInfo.phone,
      totalScore: form.rating
    }
    await createEvaluation(params)
    Taro.showToast({
      title: "评价提交成功",
      icon: "success",
      duration: 2000
    })
    setTimeout(() => {
      submitting.value = false
      Taro.navigateBack()
    }, 2000)
  } catch (error: any) {
    console.error("提交评价失败", error)
    Taro.showToast({
      title: error.message || "提交失败，请重试",
      icon: "none"
    })
    submitting.value = false
  }
}

// 取消提交
const handleCancelSubmit = () => {
  showConfirmModal.value = false
}

// 获取预约记录信息
const fetchAppointmentInfo = async () => {
  const res = await getCourseAppointmentInfo(appointmentId.value)
  appointmentInfo.courseName = res.info.courseName
  appointmentInfo.date = res.info.date
  appointmentInfo.childName = res.info.studentName
  appointmentInfo.parentName = res.info.parentName
  appointmentInfo.phone = res.info.parentPhone
}
const evaluationDimension = ref<{ name: string; score: number }[]>([])
// 提示文案
const tipsText = ref("")

// 评价标签
const evaluationTags = ref<string[]>([])
//获取评价模版
const fetchEvaluationTemplate = async () => {
  const { info } = await getEvaluationTemplate("研学单日营评价模板")
  console.log(info, "info")

  evaluationDimension.value =
    info!.evaluationDimension?.map(item => {
      return {
        name: item,
        score: 0
      }
    }) || []
  tipsText.value = info!.tips || ""
  evaluationTags.value = info!.evaluationLabel || []
}

// 初始化
onMounted(async () => {
  // 获取页面参数
  const instance = Taro.getCurrentInstance()
  const params = instance.router?.params
  if (params) {
    appointmentId.value = params.appointmentId || ""
    courseId.value = params.courseId || ""
    form.appointmentId = appointmentId.value
    form.courseId = courseId.value
  }

  if (!appointmentId.value || !courseId.value) {
    Taro.showToast({
      title: "参数错误，请返回重试",
      icon: "none"
    })
    return
  }
  // 获取课程信息
  await fetchAppointmentInfo()
  await fetchEvaluationTemplate()
})
</script>

<style lang="less">
.evaluation {
  min-height: 100vh;
  padding-bottom: calc(140px + env(safe-area-inset-bottom, 0));

  .evaluation-container {
    padding: 24px 32px 0;
    position: relative;
    z-index: 1;

    .course-info-card {
      background-color: #fff;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;

      .course-name {
        font-family: "PingFang SC", sans-serif;
        font-size: 32px;
        font-weight: 600;
        line-height: 32px;
        color: #393548;
        margin-bottom: 16px;
      }

      .course-date {
        font-family: "PingFang SC", sans-serif;
        font-size: 24px;
        font-weight: normal;
        color: #848096;
      }

      .divider {
        margin: 24px 0 32px;
        width: 100%;
        height: 2px;
        background: #efeef3;
      }

      .rating-container {
        .evaluation-dimension {
          margin-top: 32px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
      }
    }

    .evaluation-card {
      background-color: #fff;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 32px;

      .card-title {
        font-size: 28px;
        font-weight: 500;
        color: #333;
        margin-bottom: 24px;
      }
    }

    .tips {
      font-family: "PingFang SC", sans-serif;
      font-weight: normal;
      color: #848096;
      margin-bottom: 40px;

      .title {
        font-size: 24px;
        margin-bottom: 16px;
      }

      .content {
        font-size: 22px;
        line-height: 36px;
        color: #848096;
        word-wrap: break-word;
        white-space: pre-line;
        word-break: break-all;

        // rich-text 组件样式
        :deep(rich-text) {
          font-size: 22px;
          line-height: 36px;
        }
      }
    }
  }

  .fixed-bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 24px 32px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom, 0));
    background-color: #fff;
    border-top: 2px solid #f0f0f0;

    .submit-btn {
      width: 100%;
      height: 88px;
      background: linear-gradient(135deg, #ffd633 0%, #ffb300 100%);
      color: #393548;
      border: none;
      border-radius: 44px;
      font-size: 32px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;

      &.disabled {
        background: #f0f0f0;
        color: #999;
      }
    }
  }
}
</style>
