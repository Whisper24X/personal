<template>
  <view class="course-selector">
    <view class="course-selector-header">
      <image
        class="icon"
        src="https://fp.yangcong345.com/middle/1.0.0/course-list-8cd5c99be9993704585a1ce2c0f9e69a__w.png"
        mode="aspectFit"
      />
      <text class="title">{{ categoryName }}</text>
    </view>

    <!-- 课程列表 -->
    <view v-if="courses.length > 0" class="course-list">
      <view
        v-for="(course, index) in courses"
        :key="index"
        class="course-item"
        @tap="selectCourse(course)"
      >
        <view class="course-name">{{ course.courseName }}</view>
        <view class="course-check-icon">
          <OlRadio :checked="selectedCourseId === course.courseId" :disabled="disabled" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import OlRadio from "@/components/OlRadio/index.vue"

export interface Course {
  courseId: string
  courseName: string
  coursePrice?: string | number
  courseType?: string
}

interface Props {
  courses: Course[]
  modelValue?: string // 选中的课程ID
  disabled?: boolean // 是否禁用
  categoryName?: string // 分类名称
}

const props = withDefaults(defineProps<Props>(), {
  courses: () => [],
  modelValue: "",
  disabled: false,
  categoryName: ""
})

const emit = defineEmits(["update:modelValue", "change"])

// 选中的课程ID
const selectedCourseId = ref(props.modelValue)

// 监听modelValue变化
watch(
  () => props.modelValue,
  newValue => {
    selectedCourseId.value = newValue
  },
  { immediate: true }
)

// 选择课程
const selectCourse = (course: Course) => {
  if (props.disabled) {
    return
  }

  selectedCourseId.value = course.courseId
  emit("update:modelValue", course.courseId)
  emit("change", {
    courseId: course.courseId,
    courseName: course.courseName
  })
}
</script>

<style lang="less">
.course-selector {
  background: #fff;
  border-radius: 24px;
  padding: 32rpx;

  .course-selector-header {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 34rpx;

    .icon {
      width: 40px;
      height: 40px;
    }

    .title {
      font-family: PingFang SC;
      font-size: 32px;
      line-height: 32px;
      color: #393548;
    }
  }

  .course-list {
    display: flex;
    flex-direction: column;
    gap: 44rpx;

    .course-item {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .course-name {
        font-size: 28rpx;
        font-weight: 600;
        line-height: 28rpx;
        letter-spacing: normal;
        color: #393548;
        max-width: 80%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .course-check-icon {
        display: flex;
        align-items: center;
      }
    }
  }
}
</style>
