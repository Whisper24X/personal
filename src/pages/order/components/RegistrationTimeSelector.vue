<template>
  <view class="registration-time-selector">
    <!-- 报名时间标题和日期选择 -->
    <view class="time-header">
      <view class="time-title">
        <image
          class="clock-icon"
          src="https://fp.yangcong345.com/middle/1.0.0/yanxue/time__w.png"
          mode="aspectFit"
        />
        <text>报名时间</text>
      </view>
      <DateSelector
        v-model:value="selectedDate"
        :available-dates="processedAvailableDates"
        @change="handleDateChange"
      />
    </view>

    <!-- 时段选择 -->
    <view v-if="selectedDate" class="time-slots-container">
      <TimeSlotSelector
        v-model="selectedPeriod"
        :time-slots="timeSlots"
        :good-info="goodInfo"
        :selected-date="selectedDate"
        :selected-course-name="selectedCourseName"
        @change="handlePeriodChange"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import DateSelector from "./DateSelector.vue"
import TimeSlotSelector from "./TimeSlotSelector.vue"
import type { TimeSlot } from "./TimeSlotSelector.vue"

interface DateStock {
  date: string
  stockRemain: number
}

interface Props {
  availableDates: DateStock[]
  timeSlots: TimeSlot[]
  goodInfo: any
  modelValue: {
    date: string
    period: string
  }
  selectedCourseName?: string // 选中的课程名称
}

const props = defineProps<Props>()
console.log(props.availableDates, "availableDates")
console.log(props.modelValue, "modelValue")

const emit = defineEmits<{
  "update:modelValue": [value: { date: string; period: string }]
  change: [value: { date: string; period: string }]
}>()
// 发出变更事件
const emitChange = () => {
  const value = {
    date: selectedDate.value,
    period: selectedPeriod.value
  }
  emit("update:modelValue", value)
  emit("change", value)
}
// 内部状态
const selectedDate = ref(props.modelValue.date || "")
const selectedPeriod = ref(props.modelValue.period || "")

// 处理多日营数据，将日期范围转换为单个日期供Calendar使用
const processedAvailableDates = computed(() => {
  if (!props.availableDates || props.availableDates.length === 0) {
    return []
  }

  const processedDates: { date: string; stockRemain: number }[] = []

  props.availableDates.forEach(item => {
    if (item.date.includes("到")) {
      // 多日营：取开始日期作为代表日期
      const startDate = item.date.split("到")[0]
      processedDates.push({
        date: startDate,
        stockRemain: item.stockRemain
      })
    } else {
      // 单日营：直接使用
      processedDates.push({
        date: item.date,
        stockRemain: item.stockRemain
      })
    }
  })

  return processedDates
})
// 监听props变化
watch(
  () => props.modelValue,
  newValue => {
    selectedDate.value = newValue.date || ""
    selectedPeriod.value = newValue.period || ""
  },
  { deep: true }
)

// 监听可用日期变化，自动选择最近有库存的日期
watch(
  () => props.availableDates,
  newDates => {
    if (newDates && newDates.length > 0 && !selectedDate.value) {
      // 找到最近的有库存日期
      const today = new Date()
      const todayStr = today.toISOString().split("T")[0] // 格式化为 YYYY-MM-DD
      const sortedDates = newDates
        .filter(date => date.stockRemain > 0 && date.date !== todayStr)
        .sort((a, b) => {
          // 处理多日营的日期比较
          const dateA = a.date.includes("到") ? a.date.split("到")[0] : a.date
          const dateB = b.date.includes("到") ? b.date.split("到")[0] : b.date
          return new Date(dateA).getTime() - new Date(dateB).getTime()
        })
        .filter(date => {
          const compareDate = date.date.includes("到") ? date.date.split("到")[0] : date.date
          return new Date(compareDate) > today
        })

      if (sortedDates.length > 0) {
        selectedDate.value = sortedDates[0].date
        emitChange()
      }
    }
  },
  { immediate: true }
)

// 监听选中日期变化，同步到内部状态
watch(
  () => selectedDate.value,
  newDate => {
    if (newDate && newDate !== props.modelValue.date) {
      emitChange()
    }
  }
)

// 监听选中时段变化，同步到内部状态
watch(
  () => selectedPeriod.value,
  newPeriod => {
    if (newPeriod && newPeriod !== props.modelValue.period) {
      emitChange()
    }
  }
)

// 监听时间段变化，自动选择第一个有库存的时间段
watch(
  () => props.timeSlots,
  newTimeSlots => {
    if (newTimeSlots && newTimeSlots.length > 0 && !selectedPeriod.value) {
      // 找到第一个有库存的时间段
      const availableSlot = newTimeSlots.find(slot => slot.stockRemain > 0)
      if (availableSlot) {
        selectedPeriod.value = availableSlot.period
      }
    }
  },
  { immediate: true }
)

// 处理日期变更
const handleDateChange = (date: string) => {
  // 找到对应的完整日期范围
  const fullDateRange = props.availableDates.find(item => {
    if (item.date.includes("到")) {
      return item.date.split("到")[0] === date
    } else {
      return item.date === date
    }
  })

  if (fullDateRange) {
    selectedDate.value = fullDateRange.date
  } else {
    selectedDate.value = date
  }
  selectedPeriod.value = "" // 清空已选择的时段
  emitChange()
}

// 处理时段变更
const handlePeriodChange = (period: string) => {
  selectedPeriod.value = period
  emitChange()
}
</script>

<style lang="less">
.registration-time-selector {
  background: #fff;
  border-radius: 24px;
  padding: 32rpx;

  .time-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .time-title {
      display: flex;
      align-items: center;
      gap: 12rpx;
      font-family: PingFang SC;
      font-size: 32px;
      line-height: 32px;
      color: #393548;

      .clock-icon {
        width: 40px;
        height: 40px;
      }
    }
  }

  .time-slots-container {
    margin-top: 32rpx;
  }
}
</style>
