<template>
  <view class="course-selector">
    <!-- 多分类时显示标签页 -->
    <TabWithTags
      v-if="categories.length > 1"
      v-model="activeTab"
      :items="tabItems"
      @change="handleTabChange"
    />

    <!-- 课程列表 -->
    <view
      v-if="categories.length > 0"
      class="course-list"
      :style="{ marginTop: categories.length === 1 ? '24rpx' : '0' }"
    >
      <view
        v-for="(course, index) in categories[activeTab]?.courses"
        :key="index"
        class="course-item"
        @tap="selectCourse(course)"
      >
        <view class="course-name">{{ course.courseName }}</view>
        <view class="course-check-icon">
          <OlRadio
            :checked="selectedCourseId === course.courseId && !isNoTimes"
            :disabled="isNoTimes || props.disabled"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue"
import TabWithTags, { type TabItem } from "@/components/TabWithTags/index.vue"
import OlRadio from "@/components/OlRadio/index.vue"

export interface Course {
  courseId: string
  courseName: string
  coursePrice: string | number
  isAppointment: boolean
}

export interface Category {
  categoryId: string
  categoryName: string
  useTimes: number
  alreadyAppointmentUseTimes?: number
  courses: Course[]
}

interface Props {
  categories: Category[]
  modelValue?: string // 选中的课程ID
  disabled?: boolean // 是否禁用
  activeCategoryId?: string // 当前激活的分类ID
}

const props = withDefaults(defineProps<Props>(), {
  categories: () => [],
  modelValue: "",
  disabled: false,
  activeCategoryId: ""
})

const emit = defineEmits(["update:modelValue", "change"])

// 当前激活的标签页
const activeTab = ref(0)
// 选中的课程ID
const selectedCourseId = ref(props.modelValue)

// 计算标签页数据
const tabItems = computed<TabItem[]>(() => {
  return props.categories.map(category => ({
    id: category.categoryId,
    title: category.categoryName,
    useTimes: category.useTimes,
    appointedTimes:
      category.alreadyAppointmentUseTimes ??
      category.courses.filter(course => course.isAppointment).length
  }))
})

const isNoTimes = computed(() => {
  if (!props.categories[activeTab.value]) return false
  return (
    props.categories[activeTab.value].useTimes === 0 ||
    (props.categories[activeTab.value].alreadyAppointmentUseTimes ??
      props.categories[activeTab.value].courses.filter(course => course.isAppointment).length) >=
      props.categories[activeTab.value].useTimes
  )
})

// 监听modelValue变化
watch(
  () => props.modelValue,
  newValue => {
    selectedCourseId.value = newValue

    // 如果选中了课程，自动切换到对应的分类标签
    if (newValue) {
      const categoryIndex = props.categories.findIndex(
        category =>
          (!props.activeCategoryId || category.categoryId === props.activeCategoryId) &&
          category.courses.some(course => course.courseId === newValue)
      )

      if (categoryIndex !== -1) {
        activeTab.value = categoryIndex
      }
    }
  }
)

// 处理标签页切换
const handleTabChange = (index: number) => {
  activeTab.value = index
}

// 选择课程
const selectCourse = (course: Course) => {
  // 如果没有次数或已禁用，则不触发选择
  if (isNoTimes.value || props.disabled) {
    return
  }

  selectedCourseId.value = course.courseId
  emit("update:modelValue", course.courseId)
  emit("change", {
    courseId: course.courseId,
    courseName: course.courseName,
    categoryId: props.categories[activeTab.value].categoryId,
    categoryName: props.categories[activeTab.value].categoryName
  })
}
</script>

<style lang="less">
.course-selector {
  display: flex;
  flex-direction: column;
  align-items: center;

  .course-list {
    width: 100%;
    margin-bottom: 24rpx;
    border-radius: 16rpx;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 44rpx;
    padding: 32rpx;

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

      .course-text {
        font-size: 24rpx;
        font-weight: normal;
        line-height: 28rpx;
        text-align: center;
        letter-spacing: normal;
        color: #b8b4c7;
      }
    }
  }
}
</style>
