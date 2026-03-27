<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { ComponentPublicInstance, CSSProperties } from 'vue'
import {
  isSelectOptionGroup,
  type SelectOption,
  type SelectOptionEntry,
  type SelectValue,
} from './types'

defineOptions({
  name: 'AppSelect',
  inheritAttrs: false,
})

const SIZE_CLASSES = {
  sm: 'h-8 px-2.5 text-sm',
  md: 'h-10 px-3 text-sm',
  lg: 'h-11 px-3.5 text-sm',
} as const

let selectInstanceId = 0

const props = withDefaults(
  defineProps<{
    modelValue: SelectValue
    options: SelectOptionEntry[]
    placeholder?: string
    ariaLabel?: string
    disabled?: boolean
    block?: boolean
    size?: keyof typeof SIZE_CLASSES
    matchTriggerWidth?: boolean
    /** false：触发器内选中项可换行，避免长文案被截断 */
    triggerLabelTruncate?: boolean
    /** false：下拉项可换行，配合 matchTriggerWidth=false 时面板可随内容变宽 */
    optionLabelTruncate?: boolean
    wrapperClass?: string
    triggerClass?: string
    menuClass?: string
    optionClass?: string
    emptyText?: string
    panelZIndex?: number | string
    panelPlacement?: 'auto' | 'top' | 'bottom'
    /**
     * 为 false 时不限制下拉面板高度、不使用内部滚动，适合选项少、标签较短的列表。
     * 默认可限制高度以避免长列表撑出视口。
     */
    clampPanelHeight?: boolean
  }>(),
  {
    placeholder: '请选择',
    ariaLabel: '选择器',
    disabled: false,
    block: true,
    size: 'md',
    matchTriggerWidth: true,
    triggerLabelTruncate: true,
    optionLabelTruncate: true,
    wrapperClass: '',
    triggerClass: '',
    menuClass: '',
    optionClass: '',
    emptyText: '暂无可选项',
    panelZIndex: 80,
    panelPlacement: 'auto',
    clampPanelHeight: true,
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: SelectValue): void
  (event: 'change', value: SelectValue, option: SelectOption | null): void
}>()

interface FlatSelectOption extends SelectOption {
  flatIndex: number
  key: string
}

type RenderedEntry =
  | {
      type: 'group'
      key: string
      label: string
      options: FlatSelectOption[]
    }
  | {
      type: 'option'
      key: string
      option: FlatSelectOption
    }

const instanceId = `app-select-${++selectInstanceId}`
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const highlightedIndex = ref(-1)
const panelStyle = ref<CSSProperties>({})
const optionRefs = new Map<number, HTMLButtonElement>()

const flatOptions = computed<FlatSelectOption[]>(() => {
  const result: FlatSelectOption[] = []
  let flatIndex = 0

  for (const entry of props.options) {
    if (isSelectOptionGroup(entry)) {
      entry.options.forEach((option, optionIndex) => {
        result.push({
          ...option,
          flatIndex,
          key: `${instanceId}-group-${entry.label}-${optionIndex}`,
        })
        flatIndex += 1
      })
      continue
    }

    result.push({
      ...entry,
      flatIndex,
      key: `${instanceId}-option-${flatIndex}`,
    })
    flatIndex += 1
  }

  return result
})

const renderedEntries = computed<RenderedEntry[]>(() => {
  const result: RenderedEntry[] = []
  let flatIndex = 0

  for (const entry of props.options) {
    if (isSelectOptionGroup(entry)) {
      const options = entry.options.map((option, optionIndex) => {
        const resolvedOption = flatOptions.value[flatIndex + optionIndex]
        if (!resolvedOption) {
          throw new Error(`Missing flattened option for group ${entry.label}`)
        }

        return resolvedOption
      })

      result.push({
        type: 'group',
        key: `${instanceId}-group-${entry.label}`,
        label: entry.label,
        options,
      })
      flatIndex += entry.options.length
      continue
    }

    const option = flatOptions.value[flatIndex]
    if (!option) {
      throw new Error(`Missing flattened option for ${entry.label}`)
    }

    result.push({
      type: 'option',
      key: option.key,
      option,
    })
    flatIndex += 1
  }

  return result
})

const enabledOptionIndices = computed(() => {
  return flatOptions.value
    .filter((option) => !option.disabled)
    .map((option) => option.flatIndex)
})

const selectedOption = computed(() => {
  return flatOptions.value.find((option) => Object.is(option.value, props.modelValue)) ?? null
})

const selectedLabel = computed(() => {
  return selectedOption.value?.label ?? props.placeholder
})

const rootClasses = computed(() => {
  return [
    'relative',
    props.block ? 'w-full' : 'inline-flex',
    props.wrapperClass,
  ]
})

const triggerClasses = computed(() => {
  return [
    'inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-background text-left text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
    props.block ? 'w-full' : 'w-auto',
    SIZE_CLASSES[props.size],
    props.disabled ? '' : 'hover:border-border/80 hover:bg-muted/30',
    props.triggerClass,
  ]
})

const menuClasses = computed(() => {
  return [
    props.clampPanelHeight
      ? 'overflow-auto rounded-xl border border-border bg-background/95 p-1 shadow-2xl backdrop-blur-sm'
      : 'overflow-visible rounded-xl border border-border bg-background/95 p-1 shadow-2xl backdrop-blur-sm',
    props.menuClass,
  ]
})

const canTeleport = typeof document !== 'undefined'

const resolveOptionByIndex = (flatIndex: number) => {
  return flatOptions.value.find((option) => option.flatIndex === flatIndex) ?? null
}

const syncHighlightedIndex = () => {
  if (selectedOption.value && !selectedOption.value.disabled) {
    highlightedIndex.value = selectedOption.value.flatIndex
    return
  }

  highlightedIndex.value = enabledOptionIndices.value[0] ?? -1
}

const focusTrigger = () => {
  triggerRef.value?.focus()
}

const focusHighlightedOption = async () => {
  if (highlightedIndex.value < 0) {
    return
  }

  await nextTick()
  optionRefs.get(highlightedIndex.value)?.focus()
}

const updatePanelPosition = () => {
  if (typeof window === 'undefined' || !triggerRef.value) {
    return
  }

  const triggerRect = triggerRef.value.getBoundingClientRect()
  const panelHeight = panelRef.value?.offsetHeight ?? 0
  const viewportPadding = 8
  const offset = 8
  const availableBelow = window.innerHeight - triggerRect.bottom - viewportPadding
  const availableAbove = triggerRect.top - viewportPadding
  const autoPlaceAbove =
    panelHeight > 0 && availableBelow < Math.min(panelHeight, 240) && availableAbove > availableBelow
  const placeAbove =
    props.panelPlacement === 'top'
      ? true
      : props.panelPlacement === 'bottom'
        ? false
        : autoPlaceAbove
  const maxHeight = Math.max(
    120,
    Math.floor((placeAbove ? availableAbove : availableBelow) - offset),
  )
  const top = placeAbove
    ? Math.max(viewportPadding, triggerRect.top - panelHeight - offset)
    : Math.min(window.innerHeight - viewportPadding, triggerRect.bottom + offset)
  const minWidth = Math.round(triggerRect.width)
  const panelMaxWidth = Math.min(window.innerWidth - viewportPadding * 2, 42 * 16)
  const maxLeft = Math.max(
    viewportPadding,
    window.innerWidth - minWidth - viewportPadding,
  )
  const left = Math.min(Math.max(triggerRect.left, viewportPadding), maxLeft)

  const style: CSSProperties = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${minWidth}px`,
    maxWidth: props.matchTriggerWidth ? undefined : `${panelMaxWidth}px`,
    width: props.matchTriggerWidth ? `${minWidth}px` : 'max-content',
    zIndex: String(props.panelZIndex),
  }
  if (props.clampPanelHeight) {
    style.maxHeight = `${maxHeight}px`
  }
  panelStyle.value = style
}

const closeDropdown = ({ focus = true } = {}) => {
  if (!isOpen.value) {
    return
  }

  isOpen.value = false
  optionRefs.clear()

  if (focus) {
    nextTick(() => {
      focusTrigger()
    })
  }
}

const openDropdown = async (preferredFlatIndex?: number) => {
  if (props.disabled) {
    return
  }

  if (
    preferredFlatIndex !== undefined &&
    enabledOptionIndices.value.includes(preferredFlatIndex)
  ) {
    highlightedIndex.value = preferredFlatIndex
  } else {
    syncHighlightedIndex()
  }

  isOpen.value = true
  await nextTick()
  updatePanelPosition()
  await focusHighlightedOption()
}

const toggleDropdown = async () => {
  if (isOpen.value) {
    closeDropdown()
    return
  }

  await openDropdown()
}

const moveHighlight = async (direction: 1 | -1) => {
  const indices = enabledOptionIndices.value
  if (indices.length === 0) {
    return
  }

  const currentPosition = indices.findIndex((index) => index === highlightedIndex.value)

  if (currentPosition === -1) {
    highlightedIndex.value = direction > 0 ? indices[0]! : indices[indices.length - 1]!
  } else {
    const nextPosition =
      (currentPosition + direction + indices.length) % indices.length
    highlightedIndex.value = indices[nextPosition]!
  }

  await focusHighlightedOption()
}

const highlightBoundaryOption = async (boundary: 'first' | 'last') => {
  if (enabledOptionIndices.value.length === 0) {
    return
  }

  highlightedIndex.value =
    boundary === 'first'
      ? enabledOptionIndices.value[0]!
      : enabledOptionIndices.value[enabledOptionIndices.value.length - 1]!

  await focusHighlightedOption()
}

const handleSelect = (option: SelectOption) => {
  if (option.disabled) {
    return
  }

  emit('update:modelValue', option.value)
  emit('change', option.value, option)
  closeDropdown()
}

const handleTriggerKeydown = async (event: KeyboardEvent) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (!isOpen.value) {
        await openDropdown(enabledOptionIndices.value[0])
        return
      }
      await moveHighlight(1)
      return
    case 'ArrowUp':
      event.preventDefault()
      if (!isOpen.value) {
        await openDropdown(
          enabledOptionIndices.value[enabledOptionIndices.value.length - 1],
        )
        return
      }
      await moveHighlight(-1)
      return
    case 'Home':
      event.preventDefault()
      if (!isOpen.value) {
        await openDropdown(enabledOptionIndices.value[0])
        return
      }
      await highlightBoundaryOption('first')
      return
    case 'End':
      event.preventDefault()
      if (!isOpen.value) {
        await openDropdown(
          enabledOptionIndices.value[enabledOptionIndices.value.length - 1],
        )
        return
      }
      await highlightBoundaryOption('last')
      return
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (!isOpen.value) {
        await openDropdown()
        return
      }

      if (highlightedIndex.value >= 0) {
        const option = resolveOptionByIndex(highlightedIndex.value)
        if (option) {
          handleSelect(option)
        }
      }
      return
    case 'Escape':
      if (isOpen.value) {
        event.preventDefault()
        closeDropdown()
      }
      return
  }
}

const handleOptionKeydown = async (event: KeyboardEvent, option: FlatSelectOption) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      await moveHighlight(1)
      return
    case 'ArrowUp':
      event.preventDefault()
      await moveHighlight(-1)
      return
    case 'Home':
      event.preventDefault()
      await highlightBoundaryOption('first')
      return
    case 'End':
      event.preventDefault()
      await highlightBoundaryOption('last')
      return
    case 'Enter':
    case ' ':
      event.preventDefault()
      handleSelect(option)
      return
    case 'Escape':
      event.preventDefault()
      closeDropdown()
      return
    case 'Tab':
      closeDropdown({ focus: false })
      return
  }
}

const handleDocumentPointerDown = (event: Event) => {
  if (!(event.target instanceof Node)) {
    return
  }

  const clickedInsideTrigger = triggerRef.value?.contains(event.target) ?? false
  const t = event.target
  const el = t instanceof Element ? t : t.parentElement
  const clickedInsidePanelTree =
    (panelRef.value?.contains(event.target) ?? false) ||
    Boolean(el?.closest('[data-app-select-panel]'))

  if (!clickedInsideTrigger && !clickedInsidePanelTree) {
    closeDropdown({ focus: false })
  }
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeDropdown()
    return
  }

  if (event.key === 'Tab') {
    closeDropdown({ focus: false })
  }
}

const setOptionRef = (
  flatIndex: number,
  element: Element | ComponentPublicInstance | null,
) => {
  if (element instanceof HTMLButtonElement) {
    optionRefs.set(flatIndex, element)
    return
  }

  optionRefs.delete(flatIndex)
}

watch(
  () => isOpen.value,
  (open) => {
    if (typeof document === 'undefined') {
      return
    }

    if (open) {
      document.addEventListener('pointerdown', handleDocumentPointerDown)
      document.addEventListener('keydown', handleDocumentKeydown)
      document.addEventListener('scroll', updatePanelPosition, true)
      window.addEventListener('resize', updatePanelPosition)
      return
    }

    document.removeEventListener('pointerdown', handleDocumentPointerDown)
    document.removeEventListener('keydown', handleDocumentKeydown)
    document.removeEventListener('scroll', updatePanelPosition, true)
    window.removeEventListener('resize', updatePanelPosition)
  },
)

watch(
  () => props.modelValue,
  () => {
    if (isOpen.value) {
      syncHighlightedIndex()
    }
  },
)

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) {
      closeDropdown({ focus: false })
    }
  },
)

onBeforeUnmount(() => {
  if (typeof document === 'undefined') {
    return
  }

  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  document.removeEventListener('scroll', updatePanelPosition, true)
  window.removeEventListener('resize', updatePanelPosition)
})
</script>

<template>
  <div :class="rootClasses">
    <button
      ref="triggerRef"
      type="button"
      :class="triggerClasses"
      :aria-expanded="isOpen"
      :aria-haspopup="'listbox'"
      :aria-label="props.ariaLabel"
      :disabled="props.disabled"
      @click="void toggleDropdown()"
      @keydown="void handleTriggerKeydown($event)"
    >
      <span class="flex min-w-0 items-center gap-2">
        <slot name="prefix" />
        <span
          :class="
            triggerLabelTruncate
              ? 'truncate'
              : 'whitespace-normal break-words text-left'
          "
        >
          {{ selectedLabel }}
        </span>
      </span>
      <span class="pointer-events-none shrink-0 text-muted-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-transform"
          :class="isOpen ? 'rotate-180' : ''"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </button>

    <Teleport v-if="canTeleport" to="body">
      <div
        v-if="isOpen"
        ref="panelRef"
        data-app-select-panel=""
        class="pointer-events-auto"
        :class="menuClasses"
        :style="panelStyle"
        role="listbox"
        :aria-label="props.ariaLabel"
      >
        <template v-if="props.options.length > 0">
          <template v-for="entry in renderedEntries" :key="entry.key">
            <div v-if="entry.type === 'group'" class="py-1">
              <p class="px-3 pb-1 text-[11px] font-semibold text-muted-foreground">
                {{ entry.label }}
              </p>
              <div class="space-y-1">
                <button
                  v-for="option in entry.options"
                  :key="option.key"
                  :ref="(element: Element | ComponentPublicInstance | null) => setOptionRef(option.flatIndex, element)"
                  type="button"
                  role="option"
                  :aria-selected="Object.is(option.value, props.modelValue)"
                  :disabled="option.disabled"
                  class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition"
                  :class="[
                    option.disabled
                      ? 'cursor-not-allowed opacity-50'
                      : option.flatIndex === highlightedIndex
                        ? 'bg-primary/12 text-foreground'
                        : 'text-foreground hover:bg-muted/60',
                    props.optionClass,
                  ]"
                  @click="handleSelect(option)"
                  @focus="highlightedIndex = option.flatIndex"
                  @keydown="void handleOptionKeydown($event, option)"
                >
                  <span
                    class="min-w-0 flex-1"
                    :class="
                      optionLabelTruncate
                        ? 'truncate'
                        : 'whitespace-normal break-words text-left'
                    "
                  >
                    {{ option.label }}
                  </span>
                  <svg
                    v-if="Object.is(option.value, props.modelValue)"
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="shrink-0 text-primary"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
              </div>
            </div>

            <button
              v-else
              :ref="(element: Element | ComponentPublicInstance | null) => setOptionRef(entry.option.flatIndex, element)"
              type="button"
              role="option"
              :aria-selected="Object.is(entry.option.value, props.modelValue)"
              :disabled="entry.option.disabled"
              class="my-1 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition"
              :class="[
                entry.option.disabled
                  ? 'cursor-not-allowed opacity-50'
                  : entry.option.flatIndex === highlightedIndex
                    ? 'bg-primary/12 text-foreground'
                    : 'text-foreground hover:bg-muted/60',
                props.optionClass,
              ]"
              @click="handleSelect(entry.option)"
              @focus="highlightedIndex = entry.option.flatIndex"
              @keydown="void handleOptionKeydown($event, entry.option)"
            >
              <span
                class="min-w-0 flex-1"
                :class="
                  optionLabelTruncate
                    ? 'truncate'
                    : 'whitespace-normal break-words text-left'
                "
              >
                {{ entry.option.label }}
              </span>
              <svg
                v-if="Object.is(entry.option.value, props.modelValue)"
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="shrink-0 text-primary"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </button>
          </template>
        </template>

        <div v-else class="px-3 py-2 text-sm text-muted-foreground">
          {{ props.emptyText }}
        </div>
      </div>
    </Teleport>
  </div>
</template>
