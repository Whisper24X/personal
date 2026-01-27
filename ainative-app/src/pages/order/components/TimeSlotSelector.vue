<template>
  <view class="time-slot-selector">
    <view class="time-slots-list">
      <view
        v-for="(timeSlot, index) in timeSlots"
        :key="index"
        class="time-slot-card"
        :class="{
          selected: timeSlot.period === modelValue,
          available: timeSlot.stockRemain > 0,
          unavailable: timeSlot.stockRemain <= 0
        }"
        @tap="selectTimeSlot(timeSlot)"
      >
        <view class="time-slot-content">
          <view class="time-slot-content-top">
            <!-- 多日营显示日期范围 -->
            <view
              v-if="selectedDate && selectedDate.includes('到')"
              class="period-label multi-day"
              >{{ formatDateRange(selectedDate) }}</view
            >
            <!-- 单日营显示时间段 -->
            <view v-else-if="timeSlot.period.length > 0" class="period-label">{{
              timeSlot.period
            }}</view>

            <view class="activity-name">{{ courseName }}</view>
          </view>
          <view class="stock-info">剩余{{ timeSlot.stockRemain }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue"

export interface TimeSlot {
  period: string // 时间段，如 "09:30 - 12:00"
  stock: number // 总库存
  stockRemain: number // 剩余库存
}

interface Props {
  goodInfo: any
  timeSlots: TimeSlot[] // 可选的时间段
  modelValue: string // v-model绑定值，选中的时间段
  selectedDate?: string // 选中的日期，用于多日营显示时间范围
  selectedCourseName?: string // 选中的课程名称
}

const props = defineProps<Props>()

const emit = defineEmits(["update:modelValue", "change"])

// 获取课程名称
const courseName = computed(() => {
  // 如果传入了选中的课程名称，优先使用
  if (props.selectedCourseName) {
    return props.selectedCourseName
  }
  // 否则使用默认的第一个课程名称
  return props.goodInfo?.content?.goodCategories?.[0]?.courses?.[0]?.courseName || ""
})

// 选择时间段
const selectTimeSlot = (timeSlot: TimeSlot) => {
  if (timeSlot.stockRemain > 0) {
    emit("update:modelValue", timeSlot.period)
    emit("change", timeSlot.period)
  }
}

// 格式化多日营的日期范围显示
const formatDateRange = (dateStr: string) => {
  if (!dateStr || !dateStr.includes("到")) return ""

  const [startDate, endDate] = dateStr.split("到")
  const start = new Date(startDate)
  const end = new Date(endDate)

  const startYear = start.getFullYear()
  const startMonth = start.getMonth() + 1
  const startDay = start.getDate()

  const endYear = end.getFullYear()
  const endMonth = end.getMonth() + 1
  const endDay = end.getDate()

  // 如果是同一年，只显示一次年份
  if (startYear === endYear) {
    if (startMonth === endMonth) {
      // 同月：10月16日-21日
      return `${startMonth}月${startDay}日-${endDay}日`
    } else {
      // 不同月：10月16日-11月5日
      return `${startMonth}月${startDay}日-${endMonth}月${endDay}日`
    }
  } else {
    // 跨年：2025年10月16日-2026年1月5日
    return `${startYear}年${startMonth}月${startDay}日-${endYear}年${endMonth}月${endDay}日`
  }
}
</script>

<style lang="less">
.time-slot-selector {
  .time-slots-list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;

    .time-slot-card {
      box-sizing: border-box;
      border-radius: 18px;
      display: flex;
      flex-direction: column;
      padding: 40px 32px;
      gap: 24px;
      background: #f7f7f9;
      border: 2px solid transparent;

      .time-slot-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        .time-slot-content-top {
          display: flex;
          align-items: center;
          .period-label {
            border-radius: 4rpx;
            padding: 9px 16px;
            background: #518aff;
            font-family: PingFang SC;
            font-size: 22px;
            font-weight: 600;
            line-height: 22px;
            color: #ffffff;
            margin-right: 16rpx;
            white-space: wrap;
            max-width: 200px;

            &.multi-day {
              padding: 9px 12px;
              font-size: 20px;
            }
          }

          .activity-name {
            flex: 1;
            padding: 4rpx 0;
            font-family: PingFang SC;
            font-size: 32px;
            font-weight: 600;
            line-height: 32px;
            color: #3d3d3d;
          }

          .price {
            width: 120px;
            font-family: AlibabaPuHuiTi_2_105_Heavy;
            font-size: 40px;
            line-height: 40px;
            letter-spacing: 0.38px;
            color: #fa5a65;
            text-align: right;
            .symbol {
              font-size: 28px;
            }
          }
        }
      }
      .stock-info {
        font-family: PingFang SC;
        font-size: 28px;
        font-weight: normal;
        line-height: 28px;
        color: #3d3d3d;
        width: 110rpx;
        text-align: right;
      }

      &.unavailable {
        background: #f7f7f9;
        border-color: transparent;
        opacity: 0.6;
      }

      &.selected {
        border-color: #518aff;
        background: rgba(81, 138, 255, 0.06);
      }
    }
  }
}
</style>
