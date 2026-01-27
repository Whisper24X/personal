<template>
  <view class="tab-group">
    <view class="tab-container">
      <view
        v-for="(item, index) in items"
        :key="item.id"
        class="tab-item"
        :class="{ active: activeIndex === index }"
        @tap="handleTabChange(index)"
      >
        <view class="tab-text">{{ item.title }}</view>
        <view :class="getTagClass(item)" class="tab-item-tag">
          <view class="tab-item-tag-text">{{ showTagText(item) }}</view>
        </view>
      </view>
    </view>
    <view
      class="tab-indicator"
      :style="{ left: `calc(${(activeIndex + 0.5) * (100 / items.length)}% - 16rpx)` }"
    ></view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"

export interface TabItem {
  id: string
  title: string
  useTimes: number
  appointedTimes: number
}

interface Props {
  items: TabItem[]
  modelValue?: number // 当前激活的索引
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  modelValue: 0
})

const emit = defineEmits(["update:modelValue", "change"])

const activeIndex = ref(props.modelValue)

// 监听modelValue变化
watch(
  () => props.modelValue,
  newValue => {
    activeIndex.value = newValue
  }
)

// 处理标签页切换
const handleTabChange = (index: number) => {
  activeIndex.value = index
  emit("update:modelValue", index)
  emit("change", index)
}

const showTagText = (item: TabItem) => {
  if (item.appointedTimes === 0) {
    return "待预约"
  }
  if (item.appointedTimes === item.useTimes) {
    return "已完成"
  }
  return `已预约${item.appointedTimes}/${item.useTimes}`
}

const getTagClass = (item: TabItem) => {
  if (item.appointedTimes === 0) {
    return "tag-pending"
  }
  if (item.appointedTimes === item.useTimes) {
    return "tag-completed"
  }
  return "tag-partial"
}
</script>

<style lang="less">
.tab-group {
  position: relative;
  overflow-x: auto;
  min-height: 100rpx;
  padding-top: 24rpx;
  margin-bottom: 24rpx;
  width: 100%;

  .tab-container {
    display: flex;
    position: relative;
  }

  .tab-item {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20rpx;
    cursor: pointer;

    .tab-text {
      font-family: PingFang SC;
      font-size: 32px;
      line-height: 32px;
      text-align: center;
      color: #848096;
      transition: color 0.3s;
    }

    &.active .tab-text {
      font-size: 32px;
      font-weight: 900;
      line-height: 32px;
      text-align: center;
      color: #504b64;
    }

    .tab-item-tag {
      position: absolute;
      right: 50%;
      top: -10rpx;
      transform: translateX(100%);
      padding: 4rpx 8rpx;
      border-radius: 13rpx;

      .tab-item-tag-text {
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

  .tab-indicator {
    position: absolute;
    bottom: 0;
    height: 6rpx;
    background: #ffd633;
    transition: left 0.3s;
    border-radius: 3rpx;
    width: 32rpx;
  }
}
</style>
