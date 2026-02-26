<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { BusinessLineItem, ProjectItem } from '@/hooks/core/useLayout'

const props = defineProps<{
  open: boolean
  lines: BusinessLineItem[]
  projects: ProjectItem[]
  activeBusinessLineId: string
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'select-line', businessLineId: string): void
  (
    event: 'create-project',
    payload: { businessLineId: string; name: string; short: string; gitUrl: string },
  ): void
  (event: 'update-project', payload: { businessLineId: string; projectId: string; name: string; short: string }): void
  (event: 'delete-project', payload: { businessLineId: string; projectId: string }): void
}>()

const activeLineId = ref('')
const projectQuery = ref('')
const formName = ref('')
const formShort = ref('')
const formGitUrl = ref('')
const editingProjectId = ref('')

const selectedLine = computed(() => {
  return props.lines.find((line) => line.id === activeLineId.value)
})

const filteredProjects = computed(() => {
  const query = projectQuery.value.trim().toLowerCase()
  if (!query) return props.projects

  return props.projects.filter((project) => {
    return (
      project.name.toLowerCase().includes(query) ||
      project.id.toLowerCase().includes(query) ||
      project.short.toLowerCase().includes(query)
    )
  })
})

const isEditing = computed(() => Boolean(editingProjectId.value))

const resetProjectForm = () => {
  formName.value = ''
  formShort.value = ''
  formGitUrl.value = ''
  editingProjectId.value = ''
}

const closeModal = () => {
  emit('update:open', false)
}

const selectLine = (businessLineId: string) => {
  activeLineId.value = businessLineId
  resetProjectForm()
  emit('select-line', businessLineId)
}

const startEditProject = (project: ProjectItem) => {
  editingProjectId.value = project.id
  formName.value = project.name
  formShort.value = project.short
  formGitUrl.value = ''
}

const cancelEditProject = () => {
  resetProjectForm()
}

const submitProject = () => {
  const businessLineId = activeLineId.value
  const projectName = formName.value.trim()
  const projectGitUrl = formGitUrl.value.trim()

  if (!businessLineId || !projectName) return

  if (editingProjectId.value) {
    emit('update-project', {
      businessLineId,
      projectId: editingProjectId.value,
      name: projectName,
      short: formShort.value,
    })
    resetProjectForm()
    return
  }

  if (!projectGitUrl) return

  emit('create-project', {
    businessLineId,
    name: projectName,
    short: formShort.value,
    gitUrl: projectGitUrl,
  })

  resetProjectForm()
}

const deleteProject = (projectId: string) => {
  const businessLineId = activeLineId.value
  if (!businessLineId) return

  emit('delete-project', {
    businessLineId,
    projectId,
  })

  if (editingProjectId.value === projectId) {
    resetProjectForm()
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (!props.open) return
  if (event.key !== 'Escape') return
  closeModal()
}

let previousBodyOverflow = ''

watch(
  () => props.open,
  (open) => {
    if (open) {
      activeLineId.value = props.activeBusinessLineId
      projectQuery.value = ''
      resetProjectForm()
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKeydown)
      return
    }

    document.body.style.overflow = previousBodyOverflow
    window.removeEventListener('keydown', onKeydown)
  },
)

watch(
  () => props.activeBusinessLineId,
  (businessLineId) => {
    activeLineId.value = businessLineId
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-6" aria-live="polite">
      <button
        type="button"
        aria-label="关闭业务线弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-sm"
        @click="closeModal"
      />

      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="business-line-modal-title"
        class="relative z-10 h-[min(760px,92vh)] w-full max-w-6xl overflow-hidden rounded-3xl border border-border bg-background shadow-2xl"
      >
        <div class="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside class="flex min-h-0 flex-col border-b border-border bg-muted/30 lg:border-r lg:border-b-0">
            <header class="flex h-16 items-center border-b border-border px-4">
              <h2 class="text-sm font-semibold">业务线</h2>
            </header>

            <div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              <button
                v-for="line in props.lines"
                :key="line.id"
                type="button"
                class="w-full rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="line.id === activeLineId ? 'border-primary/45 bg-primary/8 shadow-sm' : 'border-border bg-background hover:bg-muted/40'"
                @click="selectLine(line.id)"
              >
                <p class="text-sm font-semibold text-foreground">{{ line.name }}</p>
                <p class="mt-1 text-xs text-muted-foreground">负责人：{{ line.owner }}</p>
                <p class="mt-2 text-xs text-muted-foreground">项目 {{ line.projectCount }}</p>
              </button>
            </div>
          </aside>

          <div class="flex min-h-0 flex-1 flex-col">
            <header class="flex h-16 items-center justify-between border-b border-border px-5">
              <div>
                <p class="text-xs font-semibold tracking-wide text-muted-foreground">项目管理</p>
                <h2 id="business-line-modal-title" class="text-sm font-semibold">{{ selectedLine?.name ?? '业务线' }}</h2>
              </div>
              <button
                type="button"
                aria-label="关闭"
                class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
                @click="closeModal"
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

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <section class="panel-card p-4">
                <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_auto]">
                  <label class="space-y-1">
                    <span class="text-xs text-muted-foreground">项目名称</span>
                    <input
                      v-model="formName"
                      type="text"
                      class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                      placeholder="输入项目名称"
                    />
                  </label>
                  <label class="space-y-1">
                    <span class="text-xs text-muted-foreground">简称</span>
                    <input
                      v-model="formShort"
                      type="text"
                      class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                      placeholder="可选"
                    />
                  </label>
                  <label class="space-y-1">
                    <span class="text-xs text-muted-foreground">Git 仓库地址</span>
                    <input
                      v-model="formGitUrl"
                      type="text"
                      class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                      placeholder="git@gitlab.example.com:group/project.git"
                      :disabled="isEditing"
                    />
                  </label>
                  <div class="flex items-end gap-2">
                    <button
                      type="button"
                      class="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
                      @click="submitProject"
                    >
                      {{ isEditing ? '保存修改' : '新增项目' }}
                    </button>
                    <button
                      v-if="isEditing"
                      type="button"
                      class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
                      @click="cancelEditProject"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </section>

              <section class="panel-card overflow-hidden">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <p class="text-sm font-semibold">项目列表（{{ filteredProjects.length }}）</p>
                  <input
                    v-model="projectQuery"
                    type="search"
                    class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm sm:w-72"
                    placeholder="按项目名 / ID / 简称查询"
                  />
                </div>

                <div v-if="filteredProjects.length > 0" class="min-h-0 divide-y divide-border">
                  <article
                    v-for="project in filteredProjects"
                    :key="project.id"
                    class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div class="space-y-1">
                      <p class="text-sm font-semibold text-foreground">{{ project.name }}</p>
                      <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span class="rounded-full border border-border bg-background px-2 py-1">{{ project.id }}</span>
                        <span class="rounded-full border border-border bg-background px-2 py-1">{{ project.short }}</span>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                        @click="startEditProject(project)"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
                        @click="deleteProject(project.id)"
                      >
                        删除
                      </button>
                    </div>
                  </article>
                </div>

                <div v-else class="px-4 py-8 text-center text-sm text-muted-foreground">暂无项目，先新增一个项目吧。</div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
