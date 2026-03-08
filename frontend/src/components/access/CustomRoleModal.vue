<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CapabilityOption } from '@/constants/access'

defineOptions({
  name: 'CustomRoleModal',
})

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  scopeLabel: string
  submitting: boolean
  capabilityOptions: CapabilityOption[]
  initialName?: string
  initialDescription?: string
  initialCapabilities: string[]
  errorMessage?: string
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (
    event: 'submit',
    payload: {
      name: string
      description: string
      capabilities: string[]
    },
  ): void
}>()

const formName = ref('')
const formDescription = ref('')
const selectedCapabilities = ref<string[]>([])
const validationMessage = ref('')

const modalTitle = computed(() => {
  return props.mode === 'edit' ? `编辑${props.scopeLabel}角色` : `新建${props.scopeLabel}角色`
})

const visibleCapabilityOptions = computed(() => {
  return props.capabilityOptions
})

const syncState = () => {
  formName.value = props.initialName ?? ''
  formDescription.value = props.initialDescription ?? ''
  const allowedCapabilities = new Set(props.capabilityOptions.map((item) => item.code))
  selectedCapabilities.value = props.initialCapabilities.filter((item) =>
    allowedCapabilities.has(item),
  )
  validationMessage.value = ''
}

const close = () => {
  emit('update:open', false)
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      syncState()
    }
  },
)

watch(
  () => [props.initialName, props.initialDescription, props.initialCapabilities],
  () => {
    if (props.open) {
      syncState()
    }
  },
)

const toggleCapability = (capability: string) => {
  if (selectedCapabilities.value.includes(capability)) {
    selectedCapabilities.value = selectedCapabilities.value.filter((item) => item !== capability)
    return
  }

  selectedCapabilities.value = [...selectedCapabilities.value, capability]
}

const submit = () => {
  const trimmedName = formName.value.trim()
  if (!trimmedName) {
    validationMessage.value = '请输入角色名称'
    return
  }

  validationMessage.value = ''
  emit('submit', {
    name: trimmedName,
    description: formDescription.value.trim(),
    capabilities: [...selectedCapabilities.value],
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[130] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭角色弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        class="relative z-10 w-full max-w-4xl rounded-2xl border border-border bg-background shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 class="text-sm font-semibold">{{ modalTitle }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">
              能力可在当前 {{ props.scopeLabel }} 作用域内自由配置。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="close"
          >
            ×
          </button>
        </header>

        <form class="space-y-4 px-4 py-4" @submit.prevent="submit">
          <div class="grid gap-3 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">角色名称</span>
              <input
                v-model="formName"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                maxlength="120"
                placeholder="例如：发布管理员"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">描述</span>
              <textarea
                v-model="formDescription"
                class="min-h-[88px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                maxlength="255"
                placeholder="补充这个角色适用的人员或职责范围"
              />
            </label>
          </div>

          <section class="space-y-3 rounded-xl border border-border bg-background/70 p-3">
            <div class="flex items-center justify-between gap-2">
              <div>
                <p class="text-xs font-semibold text-muted-foreground">能力列表</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  勾选当前 {{ props.scopeLabel }} 作用域内需要开放的能力。
                </p>
              </div>
              <span
                class="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground"
              >
                已选 {{ selectedCapabilities.length }} 项
              </span>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <label
                v-for="item in visibleCapabilityOptions"
                :key="item.code"
                class="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 transition hover:bg-muted/30"
              >
                <input
                  :checked="selectedCapabilities.includes(item.code)"
                  class="mt-1 h-4 w-4 rounded border-border"
                  type="checkbox"
                  @change="toggleCapability(item.code)"
                />
                <span class="min-w-0">
                  <span class="block text-sm font-semibold text-foreground">{{ item.label }}</span>
                  <span class="mt-1 block text-xs text-muted-foreground">{{
                    item.description
                  }}</span>
                  <code class="mt-2 block text-[11px] text-muted-foreground">{{ item.code }}</code>
                </span>
              </label>
            </div>
          </section>

          <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
          <p v-else-if="props.errorMessage" class="text-sm text-destructive">
            {{ props.errorMessage }}
          </p>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              @click="close"
            >
              取消
            </button>
            <button
              type="submit"
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.submitting"
            >
              {{ props.submitting ? '保存中...' : props.mode === 'edit' ? '保存角色' : '创建角色' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
