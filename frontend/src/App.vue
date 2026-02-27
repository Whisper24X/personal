<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import AppMessageHost from '@/components/core/feedback/AppMessageHost.vue'
import AppLayout from '@/components/core/layouts/Layout.vue'

const route = useRoute()
</script>

<template>
  <AppLayout v-if="route.meta.layout !== 'auth'">
    <RouterView />
  </AppLayout>

  <RouterView v-else />
  <AppMessageHost />
</template>
