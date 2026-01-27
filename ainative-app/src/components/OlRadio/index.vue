<template>
  <view class="radio-container" @tap="handleClick">
    <view class="radio-icon">
      <view v-if="disabled" class="radio-disabled"> </view>
      <image
        v-else
        class="radio-image"
        :src="
          checked
            ? 'https://fp.yangcong345.com/middle/1.0.0/yanxueImg/check32__w.png'
            : 'https://fp.yangcong345.com/middle/1.0.0/yanxueImg/uncheck32__w.png'
        "
        mode="aspectFit"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
interface Props {
  checked?: boolean
  disabled?: boolean
}

interface Emits {
  (e: "change", value: boolean): void
  (e: "update:checked", value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  checked: false,
  disabled: false
})

const emit = defineEmits<Emits>()

const handleClick = () => {
  if (props.disabled) return

  const newValue = !props.checked
  emit("update:checked", newValue)
  emit("change", newValue)
}
</script>

<style lang="less">
.radio-container {
  display: inline-block;
  cursor: pointer;
}

.radio-icon {
  width: 32rpx;
  height: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  .radio-image {
    width: 100%;
    height: 100%;
  }

  .radio-disabled {
    width: 100%;
    height: 100%;
    background-color: #efeef3;
    border-radius: 50%;
    border: 2px solid #b8b4c7;
  }
}
</style>
