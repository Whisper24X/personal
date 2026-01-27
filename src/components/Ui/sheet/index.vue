<template>
  <view ref="sheetDom" style="height: 0" @tap="stopPropagation">
    <view v-if="state.domShow" class="oi-sheet__bg" @tap="closeMask">
      <view v-if="$slots.top" class="oi-sheet__top" @tap="stopPropagation">
        <slot name="top" />
      </view>
      <view :class="['oi-sheet__contain', state.animalShow ? 'show' : '']" @tap="stopPropagation">
        <view class="oi-sheet__header">
          <view class="oi-sheet__title">{{ title }}</view>
          <view class="oi-sheet__close" @tap="onClickClose"></view>
        </view>
        <view :class="['oi-sheet__main', safeArea ? 'oi-sheet--safe-area' : '']">
          <slot v-if="!$slots.top" />
          <slot v-else name="contain" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, watch, nextTick } from "vue"

interface Props {
  title: string
  safeArea?: boolean
  maskClickClose?: boolean
  show: boolean
  appendToBody?: boolean
}

interface Emits {
  (e: "clickClose"): void
}

const props = withDefaults(defineProps<Props>(), {
  safeArea: false,
  maskClickClose: true,
  appendToBody: true
})

const emit = defineEmits<Emits>()

const sheetDom = ref<HTMLElement>()

const state = reactive({
  domShow: false,
  animalShow: false
})

const closeMask = () => {
  if (props.maskClickClose) {
    onClickClose()
  }
}

const onClickClose = () => {
  emit("clickClose")
}

const stopPropagation = (e: Event) => {
  e.stopPropagation()
}

// 监听 show 属性变化
watch(
  () => props.show,
  async show => {
    if (show) {
      if (props.appendToBody && sheetDom.value) {
        // Taro 中不需要手动操作 DOM，由框架处理
        // document.body.appendChild(sheetDom.value)
      }
      state.domShow = true
      await nextTick()
      state.animalShow = true
    } else {
      state.animalShow = false
      setTimeout(() => {
        state.domShow = false
        // Taro 中不需要手动操作 DOM
        // if (sheetDom.value?.parentNode === document.body) {
        //   document.body.removeChild(sheetDom.value)
        // }
      }, 200)
    }
  },
  { immediate: true }
)
</script>

<style lang="less">
.oi-sheet__top {
  flex: 1;
  position: relative;
}

.oi-sheet__bg {
  width: 100%;
  height: 100%;
  position: fixed;
  top: 0px;
  left: 0px;
  right: 0px;
  bottom: 0px;
  z-index: 500;
  background-color: rgba(0, 0, 0, 0.7);
  flex-direction: column;
  justify-content: flex-end;
  display: flex;
}

.oi-sheet__contain {
  transition: all 0.2s ease;
  transform: translateY(100vh);
}

.oi-sheet__contain.show {
  transform: translateY(0);
}

.oi-sheet__header {
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 32rpx 18rpx;
  font-family: AlibabaPuHuiTi_2_105_Heavy;
}

.oi-sheet__title {
  font-size: 36rpx;
  color: #fff;
  height: 48rpx;
  line-height: 48rpx;
  transform: skew(-13deg);
}

.oi-sheet__close {
  height: 48rpx;
  width: 48rpx;
  background-image: url(https://fp.yangcong345.com/middle/1.0.0/modal-close.png);
  background-size: 100% 100%;
}

.oi-sheet__main {
  width: 100%;
  max-height: 1042rpx;
  height: auto;
  background-color: #f7f7f9;
  overflow: hidden;
  position: relative;

  & > div {
    z-index: 10;
    position: relative;
  }

  &::before {
    position: absolute;
    content: "";
    width: 244rpx;
    height: 520rpx;
    left: -12rpx;
    bottom: 0;
    background-image: url(https://fp.yangcong345.com/middle/1.0.1/oi_sheet__bg.png);
    background-repeat: no-repeat;
    background-size: 100% 100%;
    z-index: 0;
    pointer-events: none;
  }
}

.oi-sheet--safe-area {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
