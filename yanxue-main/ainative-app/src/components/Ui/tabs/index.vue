<template>
  <view :class="tabsClasses">
    <view class="oi-tabs__wrap" :style="customStyle">
      <slot></slot>
      <view
        v-if="showBar"
        class="oi-tabs__sign"
        :class="{ 'oi-tabs__sign-bend': bend && type === 'normal' }"
        :style="{ left: barLeft + 'px', width: barWidth + 'px' }"
      ></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted, watch } from "vue"
interface Props {
  modelValue?: string | number
  type?:
    | "normal"
    | "card"
    | "purple-card"
    | "round"
    | "dark-capsule"
    | "purple-capsule"
    | "bubble"
    | "light-bubble"
  tabAlign?: "left" | "center" | "between"
  size?: "medium" | "small"
  bend?: boolean
  customItemClass?: string
  signBackgroundColor?: string
  activeFontColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  type: "normal",
  tabAlign: "left",
  size: "medium",
  bend: false,
  customItemClass: "",
  signBackgroundColor: "",
  activeFontColor: ""
})

const emit = defineEmits<{
  (e: "update:modelValue", value: string | number): void
  (e: "change", value: string | number): void
}>()

const scrollLeft = ref(0)
const barLeft = ref(0)
const barWidth = ref(0)
const activeIndex = ref(0)

// 存储tab item的信息
const tabItems = ref<Array<{ value: string | number; offsetLeft: number; width: number }>>([])

const tabsClasses = computed(() => {
  let classes = "oi-tabs"
  classes += ` oi-tabs--type-${props.type}`
  if (props.tabAlign === "center" && ["normal", "round"].includes(props.type)) {
    classes += ` oi-tabs--center`
  }
  if (
    props.tabAlign === "between" &&
    ["normal", "round", "card", "purple-card"].includes(props.type)
  ) {
    classes += ` oi-tabs--between`
  }
  if (props.type === "normal" || props.type === "round") {
    classes += ` oi-tabs--size-${props.size}`
  }
  return classes
})

const customStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.signBackgroundColor) {
    style["--tabs-sign-background-color"] = props.signBackgroundColor
  }
  if (props.activeFontColor) {
    style["--tabs-active-font-color"] = props.activeFontColor
  }
  return style
})

const showBar = computed(() => {
  return ["normal", "card", "purple-card", "round", "dark-capsule", "purple-capsule"].includes(
    props.type
  )
})

// 提供给子组件的方法
const setCurrent = (value: string | number) => {
  emit("update:modelValue", value)
  emit("change", value)
}

const updateBarPosition = (index: number, offsetLeft: number, width: number) => {
  activeIndex.value = index
  if (props.type === "normal") {
    // todo：小程序不确定什么原因需要减去4px
    barLeft.value = offsetLeft + (width / 2 - barWidth.value / 2)
  } else if (
    ["card", "purple-card", "round", "dark-capsule", "purple-capsule"].includes(props.type)
  ) {
    barWidth.value = width
    barLeft.value = offsetLeft
  }

  // 滚动到居中位置
  const scrollPosition = offsetLeft - 375 + width / 2 // 750为屏幕宽度的一半(750rpx)
  scrollLeft.value = scrollPosition > 0 ? scrollPosition : 0
}

// 注册tab item
const registerTabItem = (value: string | number, offsetLeft: number, width: number) => {
  tabItems.value.push({ value, offsetLeft, width })
  if (value === props.modelValue) {
    const index = tabItems.value.length - 1
    updateBarPosition(index, offsetLeft, width)
  }
}

// 提供给子组件
provide("tabsProps", props)
provide("setCurrent", setCurrent)
provide("registerTabItem", registerTabItem)

onMounted(() => {
  // 初始化bar宽度
  if (props.type === "normal") {
    barWidth.value = 16
  }
})

// 监听 modelValue 变化，只在值变化时更新bar位置
watch(
  () => props.modelValue,
  newValue => {
    const activeItem = tabItems.value.find(item => item.value === newValue)
    if (activeItem) {
      const index = tabItems.value.indexOf(activeItem)
      updateBarPosition(index, activeItem.offsetLeft, activeItem.width)
    }
  },
  { immediate: false }
)
</script>

<style lang="less">
.scrollBar() {
  -webkit-overflow-scrolling: touch;
  // Firefox
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.oi-tabs {
  &__wrap {
    position: relative;
    display: flex;
    justify-content: center;
  }
}

.oi-tabs__sign {
  position: absolute;
  transition: all 0.3s;
  z-index: 0;
}

.oi-tabs--type-normal {
  .oi-tabs__wrap {
    .scrollBar();
    height: 88rpx;
  }

  .oi-tabs__sign {
    bottom: 16rpx;
    width: 32rpx;
    height: 6rpx;
    background-color: var(--tabs-sign-background-color, #ffd633);
    border-radius: 4rpx;
  }

  .oi-tabs__sign-bend {
    // 弯的下划线
    bottom: 8rpx;
    width: 40rpx;
    height: 12rpx;
    background: url(https://fp.yangcong345.com/middle/1.0.0/bend-phone.png) no-repeat;
    background-size: 100% 100%;
  }
}

.oi-tabs--type-round {
  .oi-tabs__wrap {
    .scrollBar();
    padding: 20rpx 0;
  }

  .oi-tabs__sign {
    height: 64rpx;
    background-color: var(--tabs-sign-background-color, #ffd633);
    border-radius: 42rpx;
  }
}

.oi-tabs--type-card {
  .oi-tabs__wrap {
    color: #d4d1dd;
    box-sizing: border-box;
    padding: 16rpx 24rpx 0;
  }

  .oi-tabs__sign {
    bottom: 0;
    height: 72rpx;
    background-color: var(--tabs-sign-background-color, #fff);
    border-radius: 16rpx 16rpx 0 0;
  }
}

.oi-tabs--type-purple-card {
  .oi-tabs__wrap {
    .scrollBar();
    box-sizing: border-box;
    padding: 8rpx 24rpx 0;
    width: 100%;
    overflow: scroll;
    background-color: #7b66ff;
    color: #fff;
    border-radius: 8rpx 8rpx 0 0;
  }

  .oi-tabs__sign {
    bottom: 0;
    height: 72rpx;
    background-color: var(--tabs-sign-background-color, #fff);
    border-radius: 8rpx 8rpx 0 0;

    &::after,
    &::before {
      content: "";
      position: absolute;
      bottom: 0;
      width: 8rpx;
      height: 8rpx;
      background-repeat: no-repeat;
      background-size: 100%;
    }

    &::after {
      right: -8rpx;
      background-image: url(https://fp.yangcong345.com/middle/1.0.0/right-tab.png);
    }

    &::before {
      left: -8rpx;
      background-image: url(https://fp.yangcong345.com/middle/1.0.0/left-tabs.png);
    }
  }
}

.capsule() {
  justify-content: space-between;
  padding: 4rpx;
  font-size: 28rpx;
  border-radius: 180rpx;
  box-sizing: border-box;
  color: #fff;

  .oi-tabs__sign {
    top: 4rpx;
    height: 48rpx;
    background-color: var(--tabs-sign-background-color, #fff);
    border-radius: 180rpx;
  }
}

.oi-tabs--type-dark-capsule {
  .oi-tabs__wrap {
    .capsule();
    background-color: #393548;
  }
}

.oi-tabs--type-purple-capsule {
  .oi-tabs__wrap {
    .capsule();
    background-color: #604cea;
  }
}

.oi-tabs--type-bubble,
.oi-tabs--type-light-bubble {
  .oi-tabs__wrap {
    justify-content: space-between;
    height: 72rpx;
    padding: 16rpx 32rpx 24rpx;
  }
}

.oi-tabs--type-normal.oi-tabs--size-medium {
  .oi-tabs__wrap {
    font-size: 32rpx;
  }

  .oi-tabs__sign {
    bottom: 14rpx;
  }
}

.oi-tabs--type-normal .oi-tabs--size-medium {
  .oi-tabs__sign {
    bottom: 14rpx;
  }
}

.oi-tabs--type-normal.oi-tabs--size-medium {
  .oi-tabs__sign.oi-tabs__sign-bend {
    bottom: 8rpx;
  }
}

.oi-tabs--type-normal.oi-tabs--size-small {
  .oi-tabs__wrap {
    font-size: 28rpx;
  }

  .oi-tabs__sign {
    bottom: 16rpx;
  }
}

.oi-tabs--center {
  .oi-tabs__wrap {
    justify-content: center;
  }
}

.oi-tabs--between {
  .oi-tabs__wrap {
    justify-content: space-between;
  }
}
</style>
