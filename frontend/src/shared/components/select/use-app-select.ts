import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { ComponentPublicInstance, CSSProperties } from 'vue'
import {
  isSelectOptionGroup,
  type SelectOption,
  type SelectOptionEntry,
  type SelectValue,
} from './types'
import { APP_SELECT_SIZE_CLASSES } from './app-select.constants'

let selectInstanceId = 0

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

export type AppSelectProps = {
  modelValue: SelectValue
  options: SelectOptionEntry[]
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
  block?: boolean
  size?: keyof typeof APP_SELECT_SIZE_CLASSES
  matchTriggerWidth?: boolean
  triggerLabelTruncate?: boolean
  optionLabelTruncate?: boolean
  wrapperClass?: string
  triggerClass?: string
  menuClass?: string
  optionClass?: string
  emptyText?: string
  panelZIndex?: number | string
  panelPlacement?: 'auto' | 'top' | 'bottom'
  clampPanelHeight?: boolean
}

export type AppSelectEmit = {
  (event: 'update:modelValue', value: SelectValue): void
  (event: 'change', value: SelectValue, option: SelectOption | null): void
}

export type AppSelectContext = ReturnType<typeof useAppSelect>

export function useAppSelect(props: AppSelectProps, emit: AppSelectEmit) {
const SIZE_CLASSES = APP_SELECT_SIZE_CLASSES
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
    SIZE_CLASSES[props.size ?? 'md'],
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
  const maxLeft = Math.max(
    viewportPadding,
    window.innerWidth - minWidth - viewportPadding,
  )
  const left = Math.min(Math.max(triggerRect.left, viewportPadding), maxLeft)
  const availableWidth = Math.max(0, window.innerWidth - left - viewportPadding)
  const panelMaxWidth = Math.max(minWidth, availableWidth)

  const style: CSSProperties = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${minWidth}px`,
    maxHeight: `${maxHeight}px`,
    maxWidth: `${panelMaxWidth}px`,
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


  return reactive({
    canTeleport,
    closeDropdown,
    enabledOptionIndices,
    flatOptions,
    focusHighlightedOption,
    focusTrigger,
    handleDocumentKeydown,
    handleDocumentPointerDown,
    handleOptionKeydown,
    handleSelect,
    handleTriggerKeydown,
    highlightBoundaryOption,
    highlightedIndex,
    instanceId,
    isOpen,
    menuClasses,
    moveHighlight,
    openDropdown,
    optionRefs,
    panelRef,
    panelStyle,
    renderedEntries,
    resolveOptionByIndex,
    rootClasses,
    selectedLabel,
    selectedOption,
    setOptionRef,
    syncHighlightedIndex,
    toggleDropdown,
    triggerClasses,
    triggerRef,
    updatePanelPosition,
  })
}
