<script setup lang="ts">
import { provide } from 'vue'
import BusinessLineManagementPanelInner from './BusinessLineManagementPanelInner.vue'
import {
  businessLineManagementPanelInjectionKey,
  useBusinessLineManagementPanel,
  type BusinessLineManagementPanelProps,
} from './use-business-line-management-panel'

defineOptions({
  name: 'BusinessLineManagementPanel',
})

const props = withDefaults(defineProps<BusinessLineManagementPanelProps>(), {
  mode: 'page',
})

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'select-line', businessLineId: string): void
  (event: 'select-project', projectId: string): void
  (event: 'request-refresh'): void
}>()

const vm = useBusinessLineManagementPanel(props, emit)
provide(businessLineManagementPanelInjectionKey, vm)
</script>

<template>
  <BusinessLineManagementPanelInner />
</template>
