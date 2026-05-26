<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type Component } from 'vue'
import { PlatformWorkflowTemplatesPanel } from '@features/platform'
import PersonalSettingsPanel from '@features/settings/PersonalSettingsPanel.vue'
import {
  SETTINGS_SECTION_LABELS,
  type SettingsSection,
} from '@shared/types/common/settings'

defineOptions({
  name: 'SettingsModal',
})

const props = defineProps<{
  open: boolean
  activeSection: SettingsSection
  sections: SettingsSection[]
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'select-section', value: SettingsSection): void
}>()

const dialogRef = ref<HTMLElement | null>(null)
let previousBodyOverflow = ''
let previousFocusedElement: HTMLElement | null = null

const sectionComponents: Record<SettingsSection, Component> = {
  account: PersonalSettingsPanel,
  appearance: PersonalSettingsPanel,
  notifications: PersonalSettingsPanel,
  platformWorkflowTemplates: PlatformWorkflowTemplatesPanel,
}

const currentSectionComponent = computed<Component>(() => {
  return sectionComponents[props.activeSection]
})

const currentSectionProps = computed(() => {
  if (props.activeSection === 'account') {
    return {
      externalTab: 'profile' as const,
    }
  }

  if (props.activeSection === 'platformWorkflowTemplates') {
    return {}
  }

  return {
    externalTab: props.activeSection,
  }
})

const close = () => {
  emit('update:open', false)
}

const selectSection = (section: SettingsSection) => {
  emit('select-section', section)
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousBodyOverflow = document.body.style.overflow
      previousFocusedElement = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      await nextTick()
      dialogRef.value?.focus()
      return
    }

    document.body.style.overflow = previousBodyOverflow
    previousFocusedElement?.focus()
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[92] flex items-center justify-center p-3 sm:p-6"
      @keydown.esc.prevent.stop="close"
    >
      <button
        aria-label="关闭设置弹窗"
        class="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        type="button"
        @click="close"
      />

      <section
        ref="dialogRef"
        aria-labelledby="settings-modal-title"
        aria-modal="true"
        class="relative z-10 flex h-[min(92vh,900px)] w-[min(1200px,96vw)] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        role="dialog"
        tabindex="-1"
      >
        <aside class="w-56 border-r border-border bg-card/60 p-3">
          <p class="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings</p>
          <nav class="space-y-1">
            <button
              v-for="section in props.sections"
              :key="section"
              class="flex w-full items-center justify-start rounded-lg px-3 py-2 text-sm font-medium transition"
              :class="
                section === props.activeSection
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/80 hover:bg-muted hover:text-foreground'
              "
              type="button"
              @click="selectSection(section)"
            >
              {{ SETTINGS_SECTION_LABELS[section] }}
            </button>
          </nav>
        </aside>

        <div class="min-w-0 flex-1">
          <header class="flex h-14 items-center justify-between border-b border-border px-4">
            <h2 id="settings-modal-title" class="text-sm font-semibold">
              {{ SETTINGS_SECTION_LABELS[props.activeSection] }}
            </h2>
            <button
              aria-label="关闭设置"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
              type="button"
              @click="close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </header>

          <main class="h-[calc(100%-3.5rem)] overflow-auto px-4 py-4">
            <component :is="currentSectionComponent" v-bind="currentSectionProps" />
          </main>
        </div>
      </section>
    </div>
  </Teleport>
</template>
