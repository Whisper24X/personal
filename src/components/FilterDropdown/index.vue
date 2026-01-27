<template>
  <view class="filter-dropdown-container">
    <!-- 筛选下拉触发器 -->
    <view class="filter-dropdown-trigger" @tap="toggleFilterOptions">
      <text class="filter-text">{{ currentLabel }}</text>
      <image class="filter-icon" :src="dropdownIcon" />
    </view>

    <!-- 筛选选项列表 -->
    <view v-if="showOptions" class="filter-options">
      <view class="triangle"></view>
      <view
        v-for="option in options"
        :key="option.value"
        class="filter-option"
        :class="{ active: modelValue === option.value }"
        @tap="selectOption(option.value)"
      >
        <text>{{ option.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { useDidShow } from "@tarojs/taro"

interface FilterOption {
  label: string
  value: string | number
}

const props = defineProps<{
  modelValue: string | number
  options: FilterOption[]
  dropdownIcon?: string
  position?: "right" | "left" | "center"
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: string | number): void
  (e: "change", value: string | number): void
}>()

// 默认下拉图标
const defaultIcon = "https://fp.yangcong345.com/middle/1.0.0/yanxueImg/icon_xiala12*12__w.png"

// 计算属性
const dropdownIcon = computed(() => props.dropdownIcon || defaultIcon)
const currentLabel = computed(() => {
  const option = props.options.find(opt => opt.value === props.modelValue)
  return option?.label || props.options[0]?.label || ""
})

// 状态
const showOptions = ref(false)

// 切换筛选选项显示
const toggleFilterOptions = () => {
  showOptions.value = !showOptions.value
}

// 选择选项
const selectOption = (value: string | number) => {
  emit("update:modelValue", value)
  emit("change", value)
  showOptions.value = false
}

// 关闭下拉选项
const closeOptions = () => {
  showOptions.value = false
}

// 监听页面显示，关闭下拉选项
useDidShow(() => {
  closeOptions()
})

// 暴露关闭方法供父组件调用
defineExpose({
  closeOptions
})
</script>

<style lang="less">
.filter-dropdown-container {
  position: relative;
  display: inline-block;
}

// 筛选触发器
.filter-dropdown-trigger {
  display: flex;
  align-items: center;
  cursor: pointer;

  .filter-text {
    font-family: PingFang SC;
    font-size: 28rpx;
    font-weight: normal;
    line-height: 28rpx;
    color: #393548;
    margin-right: 8rpx;
  }

  .filter-icon {
    width: 24rpx;
    height: 24rpx;
  }
}

// 筛选选项
.filter-options {
  position: absolute;
  top: 60rpx;
  right: 16rpx;
  z-index: 9;
  width: 300rpx;
  border-radius: 8rpx;
  background: #fff;

  /* 常用投影（000000 10%  X0  Y4  B10  S0） */

  /* 样式描述：按钮阴影 */
  box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.1);
  padding: 16rpx;

  .triangle {
    position: absolute;
    top: -16rpx;
    right: 28rpx;
    width: 0;
    height: 0;
    border-left: 15rpx solid transparent;
    border-right: 15rpx solid transparent;
    border-bottom: 16rpx solid #fff;
    filter: drop-shadow(0 -1px 1px rgb(0 0 0 / 10%));
    z-index: 1;
  }

  .filter-option {
    padding: 16rpx;
    border-radius: 8rpx;
    color: #393548;

    &:last-child {
      border-bottom: none;
    }

    &.active {
      background: #ffd633;
      font-weight: bold;
      border-radius: 8rpx;
    }

    text {
      font-size: 28rpx;
    }
  }
}
</style>
