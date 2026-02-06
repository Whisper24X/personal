<script setup lang="ts">
const props = defineProps<{
  mobileNavOpen: boolean
  pageTitle: string
  breadcrumbs: string[]
  toggleMobileNav: () => void
}>()
</script>

<template>
  <header class="border-b border-border bg-background/85 backdrop-blur">
    <div class="flex h-16 items-center justify-between px-4 md:px-6">
      <div class="flex items-center gap-3">
        <button
          class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:shadow-sm 2xl:hidden"
          type="button"
          aria-controls="workspace-nav"
          :aria-expanded="props.mobileNavOpen"
          :aria-label="props.mobileNavOpen ? '收起导航' : '展开导航'"
          @click="props.toggleMobileNav"
        >
          <svg
            v-if="!props.mobileNavOpen"
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6h16" />
            <path d="M4 12h16" />
            <path d="M4 18h16" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>

        <div class="hidden h-9 items-center justify-center rounded-lg bg-muted px-3 text-xs font-semibold text-muted-foreground sm:inline-flex">
          工作台
        </div>

        <div>
          <p class="text-sm font-semibold leading-none">{{ props.pageTitle }}</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ props.breadcrumbs.join(' / ') }}</p>
        </div>
      </div>
    </div>
  </header>
</template>
