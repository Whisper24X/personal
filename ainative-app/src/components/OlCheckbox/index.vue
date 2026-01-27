<template>
  <view class="checkbox-container" @tap="handleClick">
    <view class="check-icon">
      <image
        class="checkmark"
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
.checkbox-container {
  display: inline-block;
  cursor: pointer;
}

.check-icon {
  color: #4a90e2;
  height: 32rpx;
  width: 32rpx;

  .checkmark {
    width: 100%;
    height: 100%;
  }
}
</style>
