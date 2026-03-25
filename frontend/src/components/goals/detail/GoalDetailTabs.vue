<script setup lang="ts">
defineOptions({
  name: 'GoalDetailTabs',
})

type GoalDetailTab = 'prd' | 'plan'

const props = defineProps<{
  modelValue: GoalDetailTab
}>()

const emit = defineEmits<{
  'update:modelValue': [value: GoalDetailTab]
}>()

const tabs: Array<{ value: GoalDetailTab; label: string }> = [
  { value: 'prd', label: 'PRD' },
  { value: 'plan', label: '任务计划' },
]
</script>

<template>
  <div
    class="border-border flex flex-wrap gap-1 border-b text-sm"
    role="tablist"
    aria-label="需求内容分区"
  >
    <button
      v-for="tab in tabs"
      :id="`goal-tab-${tab.value}`"
      :key="tab.value"
      type="button"
      role="tab"
      :aria-selected="props.modelValue === tab.value"
      class="focus-visible:ring-ring rounded-t-md px-3 py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      :class="
        props.modelValue === tab.value
          ? 'border-primary text-foreground border-b-2'
          : 'text-muted-foreground'
      "
      @click="emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
