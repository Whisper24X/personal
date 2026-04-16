<script setup lang="ts">
defineOptions({ name: 'CliAssistantMessageShell' })

withDefaults(
  defineProps<{
    /** 已格式化的展示用时间，空则隐藏时间行 */
    timeLabel?: string
    /** 为 true 时为 slot 增加边框正文容器；TaskGroupCard 等自带边框时设为 false */
    wrapBody?: boolean
  }>(),
  { wrapBody: true },
)
</script>

<template>
  <div class="mb-4 flex items-start gap-2.5 last:mb-0">
    <div
      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px]"
      aria-hidden="true"
    >
      🤖
    </div>
    <div class="min-w-0 flex-1">
      <div
        v-if="wrapBody"
        class="rounded-lg border border-border/50 bg-muted/20 p-3.5 text-sm leading-relaxed text-foreground"
      >
        <slot />
      </div>
      <slot v-else />
    </div>
  </div>
</template>
