<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAccessStore } from '@app/stores/modules/access'
import { PlatformWorkflowTemplatesPanel } from '@features/platform'
import PersonalSettingsPanel from '@features/settings/PersonalSettingsPanel.vue'
import {
  SETTINGS_QUERY_KEY,
  SETTINGS_SECTION_LABELS,
  getAvailableSettingsSections,
  resolveAuthorizedSettingsSection,
  type SettingsSection,
} from '@shared/types/common/settings'

defineOptions({
  name: 'SettingsView',
})

const route = useRoute()
const router = useRouter()
const accessStore = useAccessStore()

const availableSettingsSections = computed(() => {
  return getAvailableSettingsSections({
    isPlatformAdmin: accessStore.isPlatformAdmin,
  })
})

const activeSection = computed(() => {
  const candidate = typeof route.query[SETTINGS_QUERY_KEY] === 'string'
    ? route.query[SETTINGS_QUERY_KEY]
    : Array.isArray(route.query[SETTINGS_QUERY_KEY])
      ? route.query[SETTINGS_QUERY_KEY][0] ?? ''
      : ''

  return resolveAuthorizedSettingsSection(candidate, {
    isPlatformAdmin: accessStore.isPlatformAdmin,
  })
})

const currentSectionProps = computed(() => {
  const section = activeSection.value

  if (section === 'account' || section === 'platformWorkflowTemplates') {
    return {
      externalTab: 'profile' as const,
    }
  }

  return {
    externalTab: section,
  }
})

const selectSection = (section: SettingsSection) => {
  if (section === activeSection.value) {
    return
  }

  void router.replace({
    path: '/settings',
    query: {
      ...route.query,
      [SETTINGS_QUERY_KEY]: section,
    },
  })
}

const closeSettingsPage = () => {
  void router.push({ name: 'home' })
}
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col">
    <section
      aria-labelledby="settings-page-title"
      class="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
    >
      <div class="grid min-h-0 flex-1 grid-cols-1 lg:h-full lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside class="flex min-h-0 flex-col border-b border-border bg-muted/30 lg:border-r lg:border-b-0">
          <header class="flex h-16 items-center border-b border-border px-4">
            <h2 class="text-sm font-semibold">设置</h2>
          </header>

          <nav class="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            <button
              v-for="section in availableSettingsSections"
              :key="section"
              type="button"
              class="w-full rounded-xl border px-3 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :class="
                section === activeSection
                  ? 'border-primary/45 bg-primary/8 shadow-sm'
                  : 'border-border bg-background hover:bg-muted/40'
              "
              @click="selectSection(section)"
            >
              {{ SETTINGS_SECTION_LABELS[section] }}
            </button>
          </nav>
        </aside>

        <div class="flex min-h-0 flex-1 flex-col">
          <header class="flex h-16 items-center justify-between border-b border-border px-5">
            <div>
              <p class="text-xs font-semibold tracking-wide text-muted-foreground">系统设置</p>
              <h1 id="settings-page-title" class="text-sm font-semibold">
                {{ SETTINGS_SECTION_LABELS[activeSection] }}
              </h1>
            </div>
            <button
              type="button"
              aria-label="返回主页面"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
              @click="closeSettingsPage"
            >
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
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </header>

          <main class="min-h-0 flex-1 overflow-auto px-4 py-4">
            <PlatformWorkflowTemplatesPanel v-if="activeSection === 'platformWorkflowTemplates'" />
            <PersonalSettingsPanel v-else v-bind="currentSectionProps" />
          </main>
        </div>
      </div>
    </section>
  </div>
</template>
