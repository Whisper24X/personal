<template>
  <view class="tag-selector">
    <view class="tags-container">
      <view
        v-for="tag in tags"
        :key="tag"
        class="tag-item"
        :class="{ active: selectedTags.includes(tag) }"
        @tap="toggleTag(tag)"
      >
        {{ tag }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"

const props = defineProps({
  tags: {
    type: Array as () => string[],
    default: () => []
  },
  modelValue: {
    type: Array as () => string[],
    default: () => []
  },
  maxCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(["update:modelValue"])

const selectedTags = ref<string[]>([...props.modelValue])

// 监听外部更新
watch(
  () => props.modelValue,
  newVal => {
    selectedTags.value = [...newVal]
  },
  { deep: true }
)

// 切换标签选中状态
const toggleTag = (value: string) => {
  const index = selectedTags.value.indexOf(value)

  if (index > -1) {
    // 已选中，取消选择
    selectedTags.value.splice(index, 1)
  } else {
    // 未选中，添加选择
    if (props.maxCount && selectedTags.value.length >= props.maxCount) {
      return // 达到最大选择数量
    }
    selectedTags.value.push(value)
  }

  emit("update:modelValue", [...selectedTags.value])
}
</script>

<style lang="less">
.tag-selector {
  width: 100%;
  margin-bottom: 32px;

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 32px;

    .tag-item {
      padding: 9px 16px;
      border-radius: 4px;
      background: #f7f7f9;
      font-family: "PingFang SC", sans-serif;
      font-size: 22px;
      color: #393548;

      &.active {
        background: #ffd633;
        color: #393548;
        font-weight: 600;
      }
    }
  }
}
</style>
