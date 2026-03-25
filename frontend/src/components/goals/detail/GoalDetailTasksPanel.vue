<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { taskStatusLabel } from '@/hooks/useSidebarRecentTasks'
import type { GoalDetail } from '@/types/api/goals'

defineOptions({
  name: 'GoalDetailTasksPanel',
})

const props = defineProps<{
  tasks: GoalDetail['tasks']
}>()

const emit = defineEmits<{
  goTask: [taskId: string]
}>()
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto">
    <ul class="flex flex-col gap-2 text-sm">
      <li
        v-for="task in props.tasks"
        :key="task.id"
        class="border-border/80 bg-muted/20 rounded-lg border px-3 py-2.5"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="link"
            class="h-auto min-w-0 flex-1 justify-start px-0 py-0 text-left"
            @click="emit('goTask', task.id)"
          >
            {{ task.title }}
          </Button>
          <span class="text-muted-foreground shrink-0 text-xs">
            {{ taskStatusLabel(task.status) }}
          </span>
        </div>
      </li>
    </ul>
    <p v-if="props.tasks.length === 0" class="text-muted-foreground text-sm">暂无任务</p>
  </div>
</template>
