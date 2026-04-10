<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  type CapabilityTreeNode,
  flattenCapabilityTree,
  isCapabilityTreeLeaf,
} from '@shared/constants/access'

defineOptions({
  name: 'CustomRoleModal',
})

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  scopeLabel: string
  submitting: boolean
  capabilityTree: CapabilityTreeNode[]
  initialName?: string
  initialDescription?: string
  initialCapabilities: string[]
  errorMessage?: string
  size?: 'default' | 'large'
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
const expandedGroupKeys = ref<Set<string>>(new Set())

const collectGroupKeys = (nodes: CapabilityTreeNode[]): string[] => {
  return nodes.flatMap((node) => {
    if (isCapabilityTreeLeaf(node)) {
      return []
    }
    return [node.key, ...collectGroupKeys(node.children)]
  })
}

const modalTitle = computed(() => {
  return props.mode === 'edit' ? `编辑${props.scopeLabel}角色` : `新建${props.scopeLabel}角色`
})

const sectionClass = computed(() => {
  return props.size === 'large'
    ? 'relative z-10 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl'
    : 'relative z-10 flex max-h-[min(88vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl'
})

const flattenedOptions = computed(() => flattenCapabilityTree(props.capabilityTree))
const selectedCapabilitySet = computed(() => new Set(selectedCapabilities.value))
const allGroupKeys = computed(() => collectGroupKeys(props.capabilityTree))

const syncState = () => {
  formName.value = props.initialName ?? ''
  formDescription.value = props.initialDescription ?? ''
  const allowedCapabilities = new Set(flattenedOptions.value.map((item) => item.code))
  selectedCapabilities.value = props.initialCapabilities.filter((item) =>
    allowedCapabilities.has(item),
  )
  validationMessage.value = ''
  expandedGroupKeys.value = new Set(allGroupKeys.value)
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
  { immediate: true },
)

watch(
  () => [props.initialName, props.initialDescription, props.initialCapabilities],
  () => {
    if (props.open) {
      syncState()
    }
  },
)

const getGroupLeafCodes = (node: CapabilityTreeNode): string[] => {
  if (isCapabilityTreeLeaf(node)) {
    return [node.code]
  }
  return node.children.flatMap(getGroupLeafCodes)
}

const getGroupLeafCount = (node: CapabilityTreeNode) => getGroupLeafCodes(node).length

const getGroupSelectedCount = (node: CapabilityTreeNode) =>
  getGroupLeafCodes(node).filter((code) => selectedCapabilitySet.value.has(code)).length

const toggleCapability = (code: string) => {
  if (selectedCapabilities.value.includes(code)) {
    selectedCapabilities.value = selectedCapabilities.value.filter((item) => item !== code)
    return
  }
  selectedCapabilities.value = [...selectedCapabilities.value, code]
}

const toggleGroup = (node: CapabilityTreeNode) => {
  if (isCapabilityTreeLeaf(node)) return
  const codes = getGroupLeafCodes(node)
  const allSelected = codes.every((c) => selectedCapabilities.value.includes(c))
  if (allSelected) {
    selectedCapabilities.value = selectedCapabilities.value.filter((c) => !codes.includes(c))
  } else {
    const next = new Set(selectedCapabilities.value)
    codes.forEach((c) => next.add(c))
    selectedCapabilities.value = Array.from(next)
  }
}

const isGroupChecked = (node: CapabilityTreeNode): boolean => {
  if (isCapabilityTreeLeaf(node)) return false
  const codes = getGroupLeafCodes(node)
  return codes.length > 0 && codes.every((c) => selectedCapabilities.value.includes(c))
}

const isGroupIndeterminate = (node: CapabilityTreeNode): boolean => {
  if (isCapabilityTreeLeaf(node)) return false
  const codes = getGroupLeafCodes(node)
  const selectedCount = codes.filter((c) => selectedCapabilities.value.includes(c)).length
  return selectedCount > 0 && selectedCount < codes.length
}

const toggleGroupExpanded = (key: string) => {
  const next = new Set(expandedGroupKeys.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  expandedGroupKeys.value = next
}

const isGroupExpanded = (key: string) => expandedGroupKeys.value.has(key)

const expandAllGroups = () => {
  expandedGroupKeys.value = new Set(allGroupKeys.value)
}

const collapseAllGroups = () => {
  expandedGroupKeys.value = new Set()
}

const selectAllCapabilities = () => {
  selectedCapabilities.value = flattenedOptions.value.map((item) => item.code)
}

const clearAllCapabilities = () => {
  selectedCapabilities.value = []
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

/** 用于分组复选框的 indeterminate 状态 */
const vIndeterminate = {
  mounted(el: unknown, binding: { value: boolean }) {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      el.indeterminate = binding.value
    }
  },
  updated(el: unknown, binding: { value: boolean }) {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      el.indeterminate = binding.value
    }
  },
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

      <section :class="sectionClass">
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

        <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
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
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-semibold text-muted-foreground">权限列表</p>
                  <p class="mt-1 text-xs text-muted-foreground">
                    勾选当前 {{ props.scopeLabel }} 作用域内需要开放的能力。
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-foreground"
                  >
                    已选 {{ selectedCapabilities.length }} / {{ flattenedOptions.length }}
                  </span>
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition hover:bg-muted/40"
                    @click="selectAllCapabilities"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="selectedCapabilities.length === 0"
                    @click="clearAllCapabilities"
                  >
                    清空
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition hover:bg-muted/40"
                    @click="expandAllGroups"
                  >
                    展开全部
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition hover:bg-muted/40"
                    @click="collapseAllGroups"
                  >
                    收起全部
                  </button>
                </div>
              </div>

              <ul class="space-y-3">
                <template
                  v-for="node in props.capabilityTree"
                  :key="isCapabilityTreeLeaf(node) ? node.code : (node as { key: string }).key"
                >
                  <!-- 分组节点 -->
                  <li
                    v-if="!isCapabilityTreeLeaf(node)"
                    class="overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-sm transition"
                    :class="
                      isGroupChecked(node)
                        ? 'border-primary/40 bg-primary/[0.04] shadow-[0_0_0_1px_rgba(var(--primary-rgb),0.08)]'
                        : isGroupIndeterminate(node)
                          ? 'border-primary/25 bg-primary/[0.02]'
                          : ''
                    "
                  >
                    <div
                      class="flex items-start gap-3 border-b border-border/60 bg-muted/[0.22] px-4 py-3"
                    >
                      <input
                        v-indeterminate="isGroupIndeterminate(node)"
                        :checked="isGroupChecked(node)"
                        class="mt-1 h-4 w-4 shrink-0 rounded border-border"
                        type="checkbox"
                        @change="toggleGroup(node)"
                      />
                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="block text-sm font-semibold text-foreground">
                            {{ (node as { label: string }).label }}
                          </span>
                          <span
                            class="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {{ getGroupSelectedCount(node) }} / {{ getGroupLeafCount(node) }}
                          </span>
                        </div>
                        <span
                          v-if="(node as { description?: string }).description"
                          class="mt-0.5 block text-xs text-muted-foreground"
                        >
                          {{ (node as { description?: string }).description }}
                        </span>
                      </div>
                      <button
                        type="button"
                        class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                        @click="toggleGroupExpanded((node as { key: string }).key)"
                      >
                        {{ isGroupExpanded((node as { key: string }).key) ? '收起' : '展开' }}
                      </button>
                    </div>
                    <ul
                      v-show="isGroupExpanded((node as { key: string }).key)"
                      class="relative ml-6 space-y-2 border-l border-border/70 px-3 pb-3 pt-2"
                    >
                      <li
                        v-for="child in (node as { children: CapabilityTreeNode[] }).children"
                        :key="isCapabilityTreeLeaf(child) ? child.code : (child as { key: string }).key"
                        class="relative"
                      >
                        <label
                          v-if="isCapabilityTreeLeaf(child)"
                          class="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition"
                          :class="
                            selectedCapabilitySet.has(child.code)
                              ? 'border-primary/35 bg-primary/5 shadow-sm'
                              : 'border-border/70 bg-background hover:border-border hover:bg-muted/20'
                          "
                        >
                          <span
                            class="pointer-events-none absolute -left-[13px] top-5 h-px w-3 bg-border/70"
                          />
                          <span
                            class="pointer-events-none absolute -left-[18px] top-[15px] h-2.5 w-2.5 rounded-full border bg-background"
                            :class="
                              selectedCapabilitySet.has(child.code)
                                ? 'border-primary/60 bg-primary/70'
                                : 'border-border/80'
                            "
                          />
                          <input
                            :checked="selectedCapabilitySet.has(child.code)"
                            class="mt-1 h-4 w-4 shrink-0 rounded border-border"
                            type="checkbox"
                            @change="toggleCapability(child.code)"
                          />
                          <span class="min-w-0 flex-1">
                            <span class="flex flex-wrap items-center gap-2">
                              <span class="block text-sm font-medium text-foreground">
                                {{ child.label }}
                              </span>
                              <code
                                class="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {{ child.code }}
                              </code>
                            </span>
                            <span class="mt-1 block text-xs leading-5 text-muted-foreground">
                              {{ child.description }}
                            </span>
                          </span>
                        </label>
                      </li>
                    </ul>
                  </li>
                  <!-- 叶子节点（顶层无分组时） -->
                  <li
                    v-else
                    class="relative rounded-2xl border border-border bg-background shadow-sm"
                  >
                    <label
                      class="flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-3 transition"
                      :class="
                        selectedCapabilitySet.has(node.code)
                          ? 'bg-primary/5'
                          : 'hover:bg-muted/20'
                      "
                    >
                      <input
                        :checked="selectedCapabilitySet.has(node.code)"
                        class="mt-1 h-4 w-4 shrink-0 rounded border-border"
                        type="checkbox"
                        @change="toggleCapability(node.code)"
                      />
                      <span class="min-w-0">
                        <span class="flex flex-wrap items-center gap-2">
                          <span class="block text-sm font-semibold text-foreground">
                            {{ node.label }}
                          </span>
                          <code
                            class="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {{ node.code }}
                          </code>
                        </span>
                        <span class="mt-1 block text-xs leading-5 text-muted-foreground">
                          {{ node.description }}
                        </span>
                      </span>
                    </label>
                  </li>
                </template>
              </ul>
            </section>

            <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
            <p v-else-if="props.errorMessage" class="text-sm text-destructive">
              {{ props.errorMessage }}
            </p>
          </div>

          <div class="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-4">
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
