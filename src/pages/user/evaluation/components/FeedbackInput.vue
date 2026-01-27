<template>
  <view class="feedback-input">
    <view class="input-container">
      <image
        v-if="!modelValue"
        class="input-icon"
        src="https://fp.yangcong345.com/middle/1.0.0/yanxue/edit__w.png"
        alt=""
      />
      <textarea
        class="input-area"
        :placeholder="placeholder"
        :value="modelValue"
        :maxlength="maxLength"
        @input="handleInput"
      >
      </textarea>
      <view class="counter">{{ modelValue.length }}/{{ maxLength }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps({
  placeholder: {
    type: String,
    default: "请输入您的评价..."
  },
  modelValue: {
    type: String,
    default: ""
  },
  maxLength: {
    type: Number,
    default: 500
  }
})

const emit = defineEmits(["update:modelValue"])

const handleInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  emit("update:modelValue", target.value)
}
</script>

<style lang="less">
.feedback-input {
  width: 100%;
  margin-bottom: 48px;

  .input-container {
    position: relative;
    width: 100%;
    display: flex;
    gap: 16px;

    .input-icon {
      width: 32px;
      height: 32px;
    }

    .input-area {
      margin-bottom: 24px;
      width: 100%;
      height: 216px;
      border-radius: 16px;
      border: none;
      font-family: "PingFang SC", sans-serif;
      font-size: 24px;
      font-weight: normal;
      line-height: 36px;
      resize: none;
      color: #393548;

      &::placeholder {
        font-family: "PingFang SC", sans-serif;
        font-size: 24px;
        font-weight: normal;
        line-height: 36px;
        color: #848096;
      }
    }

    .counter {
      position: absolute;
      bottom: -24px;
      left: 0;
      font-size: 24px;
      color: #999;
    }
  }
}
</style>
