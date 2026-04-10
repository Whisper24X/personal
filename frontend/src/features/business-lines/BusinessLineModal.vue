<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import type { BusinessLineItem, ProjectItem } from '@features/layout'
import BusinessLineManagementPanel from './BusinessLineManagementPanel.vue'

defineOptions({
  name: 'BusinessLineModal',
})

const props = defineProps<{
  open: boolean
  lines: BusinessLineItem[]
  projects: ProjectItem[]
  activeBusinessLineId: string
  selectedProjectId?: string
  canCreateBusinessLine: boolean
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'select-line', businessLineId: string): void
  (event: 'select-project', projectId: string): void
  (event: 'request-refresh'): void
}>()

let previousBodyOverflow = ''

watch(
  () => props.open,
  (open) => {
    if (open) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return
    }

    document.body.style.overflow = previousBodyOverflow
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
})

const closeModal = () => {
  emit('update:open', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="fixed inset-0 z-[95]" aria-live="polite">
      <button
        type="button"
        aria-label="关闭业务线弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-sm"
        @click="closeModal"
      />

      <div class="relative z-10 flex h-full min-h-0 flex-col">
        <BusinessLineManagementPanel
          mode="modal"
          :lines="props.lines"
          :projects="props.projects"
          :active-business-line-id="props.activeBusinessLineId"
          :selected-project-id="props.selectedProjectId"
          :can-create-business-line="props.canCreateBusinessLine"
          @close="closeModal"
          @select-line="emit('select-line', $event)"
          @select-project="emit('select-project', $event)"
          @request-refresh="emit('request-refresh')"
        />
      </div>
    </div>
  </Teleport>
</template>
