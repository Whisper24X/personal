<script setup lang="ts">
import { computed, inject, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import type { BusinessLineItem } from '@/hooks/core/useLayout'
import { layoutWorkspaceKey } from '@/keys/layout-workspace'
import { useAccessStore } from '@/stores/modules/access'

defineOptions({
  name: 'HomeView',
})

const router = useRouter()
const workspace = inject(layoutWorkspaceKey, null)
const accessStore = useAccessStore()
const { capabilities, loading: accessLoading } = storeToRefs(accessStore)

const needsBusinessLineChoice = computed(() => {
  if (!workspace) {
    return false
  }

  return (
    workspace.hasAnyBusinessLine.value &&
    !workspace.activeBusinessLineId.value.trim() &&
    !workspace.layoutDataLoading.value
  )
})

const hasNoProjectsInCurrentLine = computed(() => {
  if (!workspace) {
    return false
  }

  if (workspace.layoutDataLoading.value) {
    return false
  }

  if (!workspace.hasAnyBusinessLine.value || !workspace.activeBusinessLineId.value.trim()) {
    return false
  }

  return workspace.projectItems.value.length === 0
})

const pickBusinessLine = async (item: BusinessLineItem) => {
  if (!workspace) {
    return
  }

  await workspace.selectBusinessLine(item.id)
  await router.replace('/dashboard')
}

watch(
  () =>
    [
      workspace?.layoutDataLoading.value,
      workspace?.hasAnyBusinessLine.value,
      workspace?.activeBusinessLineId.value,
      capabilities.value.join(','),
      accessLoading.value,
    ] as const,
  () => {
    if (!workspace) {
      return
    }

    if (workspace.layoutDataLoading.value) {
      return
    }

    if (accessLoading.value) {
      return
    }

    if (
      workspace.hasAnyBusinessLine.value &&
      workspace.activeBusinessLineId.value.trim() &&
      accessStore.hasCapability('project.dashboard.read')
    ) {
      void router.replace('/dashboard')
    }
  },
  { immediate: true },
)

const businessLineChoices = computed(() => workspace?.businessLineItems.value ?? [])

const canCreateBl = computed(() => workspace?.canCreateBusinessLine.value ?? false)
const openCreateBl = () => workspace?.openBusinessLineModal()
</script>

<template>
  <div class="fade-up">
    <div v-if="workspace?.layoutDataLoading.value" class="panel-card p-8 text-sm text-muted-foreground">
      加载工作区…
    </div>

    <template v-else-if="!workspace?.hasAnyBusinessLine.value">
      <div
        class="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-muted/50 via-background to-muted/30 p-6 shadow-sm md:p-10"
      >
        <div
          class="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          class="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-400/10"
          aria-hidden="true"
        />

        <div class="relative grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(260px,380px)] md:items-center">
          <div class="space-y-5">
            <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">工作区</p>
            <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">欢迎来到 AI Native</h1>
            <p class="max-w-xl text-sm leading-relaxed text-muted-foreground">
              当前账号下还没有业务线。创建业务线后，即可新建项目、绑定仓库，并在左侧使用任务、看板与自动化能力。
            </p>

            <div class="flex flex-wrap items-center gap-3 pt-1">
              <Button v-if="canCreateBl" size="lg" @click="openCreateBl"> 创建业务线 </Button>
              <Button v-else variant="outline" size="lg" disabled title="暂无创建业务线权限">
                创建业务线
              </Button>
              <span class="text-xs text-muted-foreground">也可从侧栏底部「业务线」入口管理</span>
            </div>
          </div>

          <div class="flex justify-center md:justify-end">
            <div
              class="relative w-full max-w-[380px] rounded-xl border border-border/40 bg-background/60 p-4 text-primary shadow-inner backdrop-blur-sm"
            >
              <svg
                class="h-auto w-full select-none"
                viewBox="0 0 480 320"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="home-hero-a" x1="48" y1="32" x2="432" y2="288" gradientUnits="userSpaceOnUse">
                    <stop stop-color="currentColor" stop-opacity="0.14" />
                    <stop offset="1" stop-color="currentColor" stop-opacity="0.04" />
                  </linearGradient>
                  <linearGradient id="home-hero-b" x1="120" y1="200" x2="380" y2="80" gradientUnits="userSpaceOnUse">
                    <stop stop-color="currentColor" stop-opacity="0.22" />
                    <stop offset="1" stop-color="currentColor" stop-opacity="0.06" />
                  </linearGradient>
                </defs>
                <rect x="24" y="24" width="432" height="272" rx="28" fill="url(#home-hero-a)" />
                <circle cx="120" cy="112" r="52" fill="url(#home-hero-b)" />
                <rect x="220" y="72" width="200" height="18" rx="9" class="text-foreground" fill="currentColor" fill-opacity="0.12" />
                <rect x="220" y="108" width="160" height="14" rx="7" class="text-foreground" fill="currentColor" fill-opacity="0.08" />
                <rect x="220" y="138" width="180" height="14" rx="7" class="text-foreground" fill="currentColor" fill-opacity="0.08" />
                <rect
                  x="64"
                  y="200"
                  width="352"
                  height="72"
                  rx="16"
                  class="text-foreground"
                  stroke="currentColor"
                  stroke-opacity="0.12"
                  stroke-width="1.5"
                />
                <path
                  d="M96 236h88M96 252h140"
                  class="text-foreground"
                  stroke="currentColor"
                  stroke-opacity="0.15"
                  stroke-width="8"
                  stroke-linecap="round"
                />
                <circle cx="368" cy="236" r="22" fill="currentColor" fill-opacity="0.35" />
                <path
                  d="M360 236l6 6 14-16"
                  class="text-background"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <p class="mt-3 text-center text-xs text-muted-foreground">从空画布开始，搭建你的第一条业务线</p>
            </div>
          </div>
        </div>
      </div>

      <section class="panel-card mt-8 p-5 md:p-6">
        <p class="text-sm font-semibold">接下来你可以</p>
        <ul class="mt-3 space-y-2.5 text-sm text-muted-foreground">
          <li class="flex gap-2">
            <span class="font-medium text-foreground">1.</span>
            <span>创建业务线，确定协作范围与成员。</span>
          </li>
          <li class="flex gap-2">
            <span class="font-medium text-foreground">2.</span>
            <span>在业务线下新建项目并绑定 Git 仓库。</span>
          </li>
          <li class="flex gap-2">
            <span class="font-medium text-foreground">3.</span>
            <span>选择项目后，从左侧项目菜单进入仪表盘、任务与知识库。</span>
          </li>
        </ul>
      </section>
    </template>

    <template v-else-if="needsBusinessLineChoice">
      <div
        class="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-muted/50 via-background to-muted/30 p-6 shadow-sm md:p-10"
      >
        <div
          class="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />
        <div class="relative space-y-5">
          <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">工作区</p>
          <h1 class="text-2xl font-semibold tracking-tight md:text-3xl">选择业务线</h1>
          <p class="max-w-xl text-sm leading-relaxed text-muted-foreground">
            当前账号下有多个业务线，请先选择一个以加载对应项目。之后可在侧栏底部「业务线」切换。
          </p>
          <ul class="grid gap-2 sm:grid-cols-2">
            <li v-for="line in businessLineChoices" :key="line.id">
              <Button
                variant="outline"
                class="h-auto w-full justify-start gap-3 py-3 text-left"
                @click="pickBusinessLine(line)"
              >
                <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="truncate font-medium">{{ line.name }}</span>
                  <span class="text-xs text-muted-foreground">{{ line.projectCount }} 个项目</span>
                </span>
              </Button>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template v-else-if="hasNoProjectsInCurrentLine">
      <div class="panel-card space-y-4 p-8 text-sm text-muted-foreground">
        <p>当前业务线下还没有项目，请先创建项目后再使用工作台。</p>
        <Button size="sm" @click="workspace?.openBusinessLineModal()">打开业务线管理</Button>
      </div>
    </template>

    <template v-else>
      <div v-if="accessLoading" class="panel-card p-8 text-sm text-muted-foreground">正在加载权限…</div>
      <div
        v-else-if="!accessStore.hasCapability('project.dashboard.read')"
        class="panel-card p-8 text-sm text-muted-foreground"
      >
        当前业务线下暂无工作台访问权限，请从侧栏选择项目或联系管理员。
      </div>
      <div v-else class="panel-card p-8 text-sm text-muted-foreground">正在进入工作台…</div>
    </template>
  </div>
</template>
