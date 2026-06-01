<script setup lang="ts">
defineOptions({ name: 'BlmLineSettingsTab' })

defineProps<{
  selectedLineName: string
  selectedLineDescription: string
  activeLineId: string
  loadingLineDetail: boolean
  canManageActiveLine: boolean
  canDeleteLine: boolean
}>()

const emit = defineEmits<{
  'edit-line': []
  'delete-line': []
}>()
</script>

<template>
  <section class="space-y-4">
    <article class="panel-card p-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">基础信息</p>
          <p class="mt-1 text-xs text-muted-foreground">编辑当前业务线名称与描述。</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!activeLineId || loadingLineDetail || !canManageActiveLine"
            @click="emit('edit-line')"
          >
            编辑信息
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!canDeleteLine"
            @click="emit('delete-line')"
          >
            删除业务线
          </button>
        </div>
      </div>

      <div class="mt-4 space-y-3 rounded-xl border border-border bg-background/70 p-4">
        <div>
          <p class="text-xs text-muted-foreground">业务线名称</p>
          <p class="mt-1 text-sm font-semibold">{{ selectedLineName }}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">描述</p>
          <p class="mt-1 text-sm text-foreground">{{ selectedLineDescription || '暂无描述' }}</p>
        </div>
      </div>
    </article>
  </section>
</template>
