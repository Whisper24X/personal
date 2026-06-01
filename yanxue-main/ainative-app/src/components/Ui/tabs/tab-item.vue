<template>
  <view :class="itemClasses" :data-text="dataText || itemText" @tap="handleChange">
    <slot></slot>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, getCurrentInstance, nextTick, watch } from "vue"
import Taro from "@tarojs/taro"

interface Props {
  value?: string | number
  dataText?: string
}

const props = withDefaults(defineProps<Props>(), {
  value: "",
  dataText: ""
})

const itemText = ref("")
const offsetLeft = ref(0)
const width = ref(0)
const isCalculating = ref(false) // 防止重复计算

// 注入父组件提供的方法和属性
const tabsProps: any = inject("tabsProps", {})
const setCurrent: any = inject("setCurrent", () => {})
const registerTabItem: any = inject("registerTabItem", () => {})

const itemClasses = computed(() => {
  let classes = "oi-tab-item"
  if (tabsProps.type) classes += ` oi-tab-item--type-${tabsProps.type}`
  if (tabsProps.type === "bubble" || tabsProps.type === "light-bubble")
    classes += " ignore-px-to-vw"
  if (tabsProps.modelValue === props.value) classes += ` oi-tab-item--active`
  if (tabsProps.customItemClass) classes += ` ${tabsProps.customItemClass}`
  return classes
})

const instance = getCurrentInstance()
/**
 * 获取元素的矩形信息
 * @returns 矩形信息
 */
const getRect = async () => {
  // 防止重复计算
  if (isCalculating.value || !instance?.proxy) {
    return
  }

  isCalculating.value = true

  setTimeout(() => {
    const query = Taro.createSelectorQuery()
    query
      .select(".oi-tab-item--active")
      .boundingClientRect()
      .exec((rects: any) => {
        const rect = rects[0] || {}
        console.log("获取到的 rect:", rect, "props.value:", props.value)

        if (rect && rect.width > 0) {
          itemText.value = ""
          offsetLeft.value = rect.left
          width.value = rect.width
          console.log("注册 tab item:", props.value, rect.left, rect.width)
          registerTabItem(props.value, rect.left, rect.width)
        } else {
          console.warn("无法获取有效的元素信息:", rect)
        }

        // 计算完成后重置标志
        isCalculating.value = false
      })
  }, 0)
}

const handleChange = () => {
  if (props.value === undefined) {
    throw new Error("OITabItem 必须传入 value 值")
  }
  console.log("handleChange", props.value)
  setCurrent(props.value)
  // 更新完成后获取位置信息
  // nextTick(() => {
  //   // 更新完成后获取位置信息
  //   getRect()
  // })
}

onMounted(() => {
  // 获取文本内容
  // 更新完成后获取位置信息
  nextTick(() => {
    getRect()
  })
})

// 监听 modelValue 变化，只在激活状态变化时重新计算位置
watch(
  () => tabsProps.modelValue,
  newValue => {
    if (newValue === props.value) {
      nextTick(() => {
        getRect()
      })
    }
  },
  { immediate: false }
)
</script>

<style lang="less">
@top: 11rpx;

.oi-tab-item {
  position: relative;
  text-align: center;
  white-space: nowrap;
  flex-shrink: 0;
}

.oi-tab-item-hidden {
  font-family: AlibabaPuHuiTi_2_105_Heavy;
  pointer-events: none;
  visibility: hidden;
}

.oi-tab-item--type-normal {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 48rpx;
  color: #848096;
  box-sizing: border-box;
}

.oi-tab-item__float--type-normal {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  box-sizing: border-box;
}

.oi-tab-item--type-normal.oi-tab-item--active {
  color: var(--tabs-active-font-color, #504b64);
  font-family: AlibabaPuHuiTi_2_105_Heavy;

  .oi-tab-item__float--type-normal {
  }
}

.oi-tab-item--type-card {
  position: relative;
  padding: 16rpx 40rpx;
  min-width: 164rpx;
  border-radius: 8rpx 8rpx 0px 0px;
  font-size: 28rpx;
  text-align: center;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.oi-tab-item--type-card.oi-tab-item--active {
  color: var(--tabs-active-font-color, #1c3058);
  font-weight: bold;
}

.oi-tab-item--type-purple-card {
  width: 196rpx;
  padding: 22rpx 0;
  border-radius: 8rpx 8rpx 0px 0px;
  font-size: 28rpx;
  line-height: 28rpx;
  font-weight: bold;
  text-align: center;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.oi-tab-item--type-purple-card.oi-tab-item--active {
  color: var(--tabs-active-font-color, #7b66ff);
}

.oi-tab-item--type-round {
  height: 64rpx;
  min-width: 160rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  line-height: 28rpx;
  color: #504b64;
  font-family: AlibabaPuHuiTi_2_105_Heavy;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1;
}

.oi-tab-item--type-round.oi-tab-item--active {
  color: var(--tabs-active-font-color, #393548);
}

.oi-tab-item--type-dark-capsule,
.oi-tab-item--type-purple-capsule {
  z-index: 1;
  flex: 1;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  font-family: AlibabaPuHuiTi_2_105_Heavy;
}

.oi-tab-item--type-purple-capsule.oi-tab-item--active,
.oi-tab-item--type-dark-capsule.oi-tab-item--active {
  color: var(--tabs-active-font-color, #393548);
}

.oi-tab-item--type-bubble,
.oi-tab-item--type-light-bubble {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  font-family: AlibabaPuHuiTi_2_105_Heavy;
  text-align: center;
  border-radius: 8rpx;
  box-sizing: border-box;
  /* prettier-ignore */
  border: 2rpx solid;
  font-style: italic;
}

.oi-tab-item--type-bubble.oi-tab-item--active,
.oi-tab-item--type-light-bubble.oi-tab-item--active {
  background-color: #ffd633;
  -webkit-text-stroke: 8rpx #393548;

  &::after {
    position: absolute;
    top: @top;
    left: 0;
    z-index: 1;
    text-align: center;
    width: 100%;
    color: #fff;
    font-family: AlibabaPuHuiTi_2_105_Heavy;
    font-style: italic;
    content: attr(data-text);
    -webkit-text-stroke: initial;
  }

  &::before {
    content: "";
    position: absolute;
    bottom: -20rpx;
    left: 48rpx;
    width: 20rpx;
    height: 20rpx;
    transition: none;
    background-size: cover;
  }
}

.oi-tab-item--type-bubble {
  color: #fff;
  /* prettier-ignore */
  border: 2rpx solid #fff;

  & + .oi-tab-item--type-bubble {
    margin-left: 24rpx;
  }
}

.oi-tab-item--type-bubble.oi-tab-item--active {
  &::before {
    background-image: url(https://fp.yangcong345.com/middle/1.0.0/tabs-light.png);
  }
}

.oi-tab-item--type-light-bubble {
  color: #504b64;
  background: #fff;
  /* prettier-ignore */
  border: 2rpx solid #504b64;

  & + .oi-tab-item--type-light-bubble {
    margin-left: 24rpx;
  }
}

.oi-tab-item--type-bubble,
.oi-tab-item--type-light-bubble {
  &.ignore-px-to-vw {
    /* prettier-ignore */
    border-width: 2rpx;
  }
}

.oi-tab-item--type-light-bubble.oi-tab-item--active {
  &::before {
    background-image: url(https://fp.yangcong345.com/middle/1.0.0/bubble-tabs.png);
  }
}
</style>
