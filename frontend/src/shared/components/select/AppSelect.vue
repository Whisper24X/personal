<script setup lang="ts">
import { toRef } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import {
  useAppSelect,
  type AppSelectProps,
  type AppSelectEmit,
} from './use-app-select'

defineOptions({
  name: 'AppSelect',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<AppSelectProps>(), {
  placeholder: '请选择',
  ariaLabel: '选择器',
  disabled: false,
  block: true,
  size: 'md',
  matchTriggerWidth: false,
  wrapperClass: '',
  triggerClass: '',
  menuClass: '',
  optionClass: '',
  emptyText: '暂无可选项',
  panelZIndex: 80,
  panelPlacement: 'auto',
  clampPanelHeight: true,
})

const emit = defineEmits<AppSelectEmit>()

const vm = useAppSelect(props, emit)
const triggerRef = toRef(vm, 'triggerRef')
const panelRef = toRef(vm, 'panelRef')
</script>

<template>
  <div :class="vm.rootClasses">
    <button
      ref="triggerRef"
      type="button"
      :class="vm.triggerClasses"
      :aria-expanded="vm.isOpen"
      :aria-haspopup="'listbox'"
      :aria-label="props.ariaLabel"
      :disabled="props.disabled"
      @click="void vm.toggleDropdown()"
      @keydown="void vm.handleTriggerKeydown($event)"
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
          {{ vm.selectedLabel }}
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
          :class="vm.isOpen ? 'rotate-180' : ''"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </button>

    <Teleport v-if="vm.canTeleport" to="body">
      <div
        v-if="vm.isOpen"
        ref="panelRef"
        data-app-select-panel=""
        class="pointer-events-auto"
        :class="vm.menuClasses"
        :style="vm.panelStyle"
        role="listbox"
        :aria-label="props.ariaLabel"
      >
        <template v-if="props.options.length > 0">
          <template v-for="entry in vm.renderedEntries" :key="entry.key">
            <div v-if="entry.type === 'group'" class="py-1">
              <p class="px-3 pb-1 text-[11px] font-semibold text-muted-foreground">
                {{ entry.label }}
              </p>
              <div class="space-y-1">
                <button
                  v-for="option in entry.options"
                  :key="option.key"
                  :ref="(element: Element | ComponentPublicInstance | null) => vm.setOptionRef(option.flatIndex, element)"
                  type="button"
                  role="option"
                  :aria-selected="Object.is(option.value, props.modelValue)"
                  :disabled="option.disabled"
                  class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition"
                  :class="[
                    option.disabled
                      ? 'cursor-not-allowed opacity-50'
                      : option.flatIndex === vm.highlightedIndex
                        ? 'bg-primary/12 text-foreground'
                        : 'text-foreground hover:bg-muted/60',
                    props.optionClass,
                  ]"
                  @click="vm.handleSelect(option)"
                  @focus="vm.highlightedIndex = option.flatIndex"
                  @keydown="void vm.handleOptionKeydown($event, option)"
                >
                  <span class="min-w-0 flex-1 whitespace-normal break-words text-left">{{ option.label }}</span>
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
              :ref="(element: Element | ComponentPublicInstance | null) => vm.setOptionRef(entry.option.flatIndex, element)"
              type="button"
              role="option"
              :aria-selected="Object.is(entry.option.value, props.modelValue)"
              :disabled="entry.option.disabled"
              class="my-1 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition"
              :class="[
                entry.option.disabled
                  ? 'cursor-not-allowed opacity-50'
                  : entry.option.flatIndex === vm.highlightedIndex
                    ? 'bg-primary/12 text-foreground'
                    : 'text-foreground hover:bg-muted/60',
                props.optionClass,
              ]"
              @click="vm.handleSelect(entry.option)"
              @focus="vm.highlightedIndex = entry.option.flatIndex"
              @keydown="void vm.handleOptionKeydown($event, entry.option)"
            >
              <span class="min-w-0 flex-1 whitespace-normal break-words text-left">{{ entry.option.label }}</span>
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
