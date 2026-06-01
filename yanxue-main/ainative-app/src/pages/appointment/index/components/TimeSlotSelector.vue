<template>
  <view class="time-slot-selector">
    <view class="time-slots-grid">
      <view
        v-for="(timeSlot, index) in timeSlots"
        :key="index"
        class="time-slot-item"
        :class="{
          selected: timeSlot.period === modelValue,
          available: timeSlot.stockRemain > 0,
          unavailable: timeSlot.stockRemain <= 0
        }"
        @tap="selectTimeSlot(timeSlot)"
      >
        <view class="time-slot-content">
          <view class="time-range">{{ timeSlot.period }}</view>
          <view class="stock-info">剩余{{ timeSlot.stockRemain }}人</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from "vue"

export interface TimeSlot {
  period: string // 时间段，如 "09:30 - 12:00"
  stock: number // 总库存
  stockRemain: number // 剩余库存
}

interface Props {
  timeSlots: TimeSlot[] // 可选的时间段
  modelValue: string // v-model绑定值，选中的时间段
}

const props = defineProps<Props>()

const emit = defineEmits(["update:modelValue", "change"])

// 选择时间段
const selectTimeSlot = (timeSlot: TimeSlot) => {
  if (timeSlot.stockRemain > 0) {
    emit("update:modelValue", timeSlot.period)
    emit("change", timeSlot.period)
  }
}
</script>

<style lang="less">
.time-slot-selector {
  .time-slots-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;

    .time-slot-item {
      width: 196rpx;
      height: 130rpx;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 12rpx;
      border-radius: 8rpx;
      background: #f7f7f9;
      box-sizing: border-box;
      border: 2rpx solid #efeef3;

      .time-slot-content {
        text-align: center;

        .time-range {
          font-size: 26rpx;
          font-weight: normal;
          line-height: 26rpx;
          letter-spacing: normal;
          color: #848096;
          margin-bottom: 16rpx;
        }

        .stock-info {
          font-size: 22rpx;
          font-weight: normal;
          line-height: 22rpx;
          letter-spacing: normal;
          color: #848096;
        }
      }

      &.available {
        background: #f7f7f9;
      }

      &.unavailable {
        background: #f5f5f5;
        color: #ccc;
        cursor: not-allowed;

        .time-range,
        .stock-info {
          color: #ccc;
        }
      }

      &.selected {
        background: #fdf6d9;
        box-sizing: border-box;
        border: 2rpx solid #ffd633;

        .time-range {
          font-size: 26rpx;
          font-weight: 600;
          line-height: 26rpx;
          letter-spacing: normal;
          color: #393548;
        }

        .stock-info {
          color: #848096;
        }
      }
    }
  }
}
</style>
