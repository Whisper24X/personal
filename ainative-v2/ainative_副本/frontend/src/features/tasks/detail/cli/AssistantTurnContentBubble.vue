<script setup lang="ts">
defineOptions({ name: 'CliAssistantTurnContentBubble' })
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border/50 bg-muted/20">
    <div class="divide-y divide-border/30">
      <slot />
    </div>
  </div>
</template>
