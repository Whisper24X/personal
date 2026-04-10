<script setup lang="ts">
defineOptions({
  name: 'ImagePreview',
})

const props = defineProps<{
  src: string
  alt: string
}>()
</script>

<template>
  <div
    class="flex h-full w-full items-center justify-center overflow-auto bg-[linear-gradient(45deg,rgba(148,163,184,0.08)_25%,transparent_25%,transparent_50%,rgba(148,163,184,0.08)_50%,rgba(148,163,184,0.08)_75%,transparent_75%,transparent)] bg-[length:24px_24px] p-3"
  >
    <img
      :src="props.src"
      :alt="props.alt"
      class="max-h-full max-w-full rounded-xl border border-border bg-background object-contain shadow-lg"
    />
  </div>
</template>
