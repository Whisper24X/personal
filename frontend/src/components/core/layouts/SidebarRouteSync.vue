<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSidebar } from '@/components/ui/sidebar'

const route = useRoute()
const { setOpenMobile, isMobile } = useSidebar()

watch(
  () => route.fullPath,
  () => {
    if (isMobile.value) {
      setOpenMobile(false)
    }
  },
)
</script>

<template>
  <span class="hidden" aria-hidden="true" />
</template>
