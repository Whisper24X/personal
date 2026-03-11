<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  type CapabilityTreeNode,
  flattenCapabilityTree,
  isCapabilityTreeLeaf,
} from '@/constants/access'

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

const modalTitle = computed(() => {
  return props.mode === 'edit' ? `编辑${props.scopeLabel}角色` : `新建${props.scopeLabel}角色`
})

const flattenedOptions = computed(() => flattenCapabilityTree(props.capabilityTree))

const syncState = () => {
  formName.value = props.initialName ?? ''
  formDescription.value = props.initialDescription ?? ''
  const allowedCapabilities = new Set(flattenedOptions.value.map((item) => item.code))
  selectedCapabilities.value = props.initialCapabilities.filter((item) =>
    allowedCapabilities.has(item),
  )
  validationMessage.value = ''
  expandedGroupKeys.value = new Set(
    props.capabilityTree
      .filter((n) => !isCapabilityTreeLeaf(n))
      .map((n) => (n as { key: string }).key),
  )
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

/** 获取分组下所有叶子能力码 */
const getGroupLeafCodes = (node: CapabilityTreeNode): string[] => {
  if (isCapabilityTreeLeaf(node)) {
    return [node.code]
  }
  return node.children.flatMap(getGroupLeafCodes)
}

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

      <section
        class="relative z-10 flex max-h-[min(88vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
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
              <div class="flex items-center justify-between gap-2">
                <div>
                  <p class="text-xs font-semibold text-muted-foreground">权限列表</p>
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

              <ul class="space-y-1">
                <template v-for="node in props.capabilityTree" :key="isCapabilityTreeLeaf(node) ? node.code : (node as { key: string }).key">
                  <!-- 分组节点 -->
                  <li v-if="!isCapabilityTreeLeaf(node)" class="rounded-lg border border-border bg-background">
                    <div
                      class="flex cursor-pointer items-center gap-3 px-3 py-2 transition hover:bg-muted/30"
                      @click="toggleGroupExpanded((node as { key: string }).key)"
                    >
                      <span
                        class="inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition hover:text-foreground"
                        aria-label="展开或收起"
                      >
                        {{ isGroupExpanded((node as { key: string }).key) ? '▼' : '▶' }}
                      </span>
                      <input
                        v-indeterminate="isGroupIndeterminate(node)"
                        :checked="isGroupChecked(node)"
                        class="h-4 w-4 shrink-0 rounded border-border"
                        type="checkbox"
                        @click.stop="toggleGroup(node)"
                      />
                      <div class="min-w-0 flex-1">
                        <span class="block text-sm font-semibold text-foreground">{{ (node as { label: string }).label }}</span>
                        <span
                          v-if="(node as { description?: string }).description"
                          class="mt-0.5 block text-xs text-muted-foreground"
                        >
                          {{ (node as { description?: string }).description }}
                        </span>
                      </div>
                    </div>
                    <ul
                      v-show="isGroupExpanded((node as { key: string }).key)"
                      class="border-t border-border pl-6 pr-3 pb-2 pt-1"
                    >
                      <li
                        v-for="child in (node as { children: CapabilityTreeNode[] }).children"
                        :key="isCapabilityTreeLeaf(child) ? child.code : (child as { key: string }).key"
                        class="flex items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-muted/20"
                      >
                        <input
                          v-if="isCapabilityTreeLeaf(child)"
                          :checked="selectedCapabilities.includes(child.code)"
                          class="mt-1 h-4 w-4 shrink-0 rounded border-border"
                          type="checkbox"
                          @change="toggleCapability(child.code)"
                        />
                        <span
                          v-if="isCapabilityTreeLeaf(child)"
                          class="min-w-0 flex-1"
                        >
                          <span class="block text-sm font-medium text-foreground">{{ child.label }}</span>
                          <span class="mt-0.5 block text-xs text-muted-foreground">{{ child.description }}</span>
                          <code class="mt-1 block text-[11px] text-muted-foreground">{{ child.code }}</code>
                        </span>
                      </li>
                    </ul>
                  </li>
                  <!-- 叶子节点（顶层无分组时） -->
                  <li
                    v-else
                    class="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2 transition hover:bg-muted/30"
                  >
                    <input
                      :checked="selectedCapabilities.includes(node.code)"
                      class="mt-1 h-4 w-4 shrink-0 rounded border-border"
                      type="checkbox"
                      @change="toggleCapability(node.code)"
                    />
                    <span class="min-w-0">
                      <span class="block text-sm font-semibold text-foreground">{{ node.label }}</span>
                      <span class="mt-1 block text-xs text-muted-foreground">{{ node.description }}</span>
                      <code class="mt-2 block text-[11px] text-muted-foreground">{{ node.code }}</code>
                    </span>
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
