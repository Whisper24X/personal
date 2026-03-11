<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseMessages } from './parsers'
import LogCard from './LogCard.vue'

const props = defineProps<{
  agentCliId: string
  messages: TaskMessage[]
}>()

const entries = computed(() => parseMessages(props.agentCliId, props.messages))
</script>

<template>
  <div v-if="entries.length > 0" class="space-y-2">
    <LogCard
      v-for="entry in entries"
      :key="entry.id"
      :entry="entry"
    />
  </div>
  <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
    暂无执行日志
  </div>
</template>
