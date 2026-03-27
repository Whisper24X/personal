<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import AppMessageHost from '@/components/core/feedback/AppMessageHost.vue'
import AppLayout from '@/components/core/layouts/Layout.vue'
import WorkspacePageLayout from '@/components/core/layouts/WorkspacePageLayout.vue'

const route = useRoute()
</script>

<template>
  <AppLayout
    v-if="
      route.meta.layout !== 'auth' &&
      route.meta.layout !== 'business-line' &&
      route.meta.layout !== 'workspace-page'
    "
  >
    <RouterView />
  </AppLayout>

  <WorkspacePageLayout
    v-else-if="route.meta.layout === 'business-line' || route.meta.layout === 'workspace-page'"
  />

  <RouterView v-else />
  <AppMessageHost />
</template>
