<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { projectsApi } from '@/api/projects'
import {
  findDuplicateRepoUrlMessage,
  getDuplicateRepoUrlError as getDuplicateRepoUrlErrorForRepos,
} from '@features/business-lines/utils/project-form-repo'
import { buildProjectWorkspaceBranch } from '@shared/utils/git-ref-name'

type RepoEntry = {
  url: string
  prefix: string
  branch: string
}

type RepoBranchState = {
  key: string
  loading: boolean
  branches: string[]
  error: string
}

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  businessLineId?: string
  businessLineSlug?: string
  submitting: boolean
  initialName: string
  initialSlug?: string
  initialDescription: string
  initialGitUrl: string
  initialDefaultBranch: string
  initialSubRepos?: {
    url: string
    prefix: string
    branch: string
    command?: string
    port?: number
    installCommand?: string
  }[]
  errorMessage?: string
  size?: 'default' | 'large'
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (
    event: 'submit',
    payload: {
      name: string
      slug?: string
      description: string
      gitUrl: string
      defaultBranch: string
      subRepos: { url: string; prefix: string; branch: string }[]
    },
  ): void
}>()

const name = ref('')
const slug = ref('')
const description = ref('')
const repos = ref<RepoEntry[]>([])
const validationMessage = ref('')
const repoBranchStates = reactive<Record<number, RepoBranchState>>({})
const repoLastInspectedUrl = reactive<Record<number, string>>({})
const branchLoadTimers = new Map<number, ReturnType<typeof setTimeout>>()
let branchRequestSeq = 0

const REPO_URL_BRANCH_DEBOUNCE_MS = 400

const modalTitle = computed(() => {
  return props.mode === 'edit' ? '编辑项目' : '新建项目'
})

const sectionClass = computed(() => {
  return props.size === 'large'
    ? 'relative z-10 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl'
    : 'relative z-10 w-full max-w-xl rounded-2xl border border-border bg-background shadow-2xl'
})

const formClass = computed(() => {
  return props.size === 'large'
    ? 'max-h-[calc(95vh-56px)] space-y-3 overflow-y-auto px-4 py-4'
    : 'space-y-3 px-4 py-4'
})

const workspaceBranchPreview = computed(() => {
  if (props.mode !== 'create' || !props.businessLineSlug?.trim()) {
    return null
  }
  return buildProjectWorkspaceBranch(props.businessLineSlug, slug.value)
})

function derivePrefix(gitUrl: string): string {
  const trimmed = gitUrl.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/\/([^/]+?)(?:\.git)?$/)
  return match?.[1] ?? ''
}

const getDuplicateRepoUrlError = (index: number) =>
  getDuplicateRepoUrlErrorForRepos(repos.value, index)

const syncFormValues = () => {
  name.value = props.initialName
  slug.value = props.initialSlug ?? ''
  description.value = props.initialDescription
  repos.value = (props.initialSubRepos ?? []).map((r) => ({
    url: r.url,
    prefix: r.prefix,
    branch: r.branch || 'main',
  }))
  if (repos.value.length === 0 && props.initialGitUrl) {
    repos.value = [{ url: props.initialGitUrl, prefix: '', branch: 'main' }]
  }
  for (const key of Object.keys(repoBranchStates)) {
    delete repoBranchStates[Number(key)]
  }
  for (const key of Object.keys(repoLastInspectedUrl)) {
    delete repoLastInspectedUrl[Number(key)]
  }
  validationMessage.value = ''
  loadBranchesForExistingRepos()
}

const clearBranchLoadTimer = (index: number) => {
  const timer = branchLoadTimers.get(index)
  if (timer) {
    clearTimeout(timer)
    branchLoadTimers.delete(index)
  }
}

const loadBranchesForExistingRepos = () => {
  repos.value.forEach((repo, index) => {
    if (repo.url.trim()) {
      scheduleLoadBranchesForRepo(index)
    }
  })
}

const scheduleLoadBranchesForRepo = (index: number, options?: { force?: boolean }) => {
  clearBranchLoadTimer(index)
  branchLoadTimers.set(
    index,
    setTimeout(() => {
      branchLoadTimers.delete(index)
      void loadBranchesForRepo(index, options)
    }, REPO_URL_BRANCH_DEBOUNCE_MS),
  )
}

const addRepo = () => {
  repos.value.push({ url: '', prefix: '', branch: 'main' })
}

const removeRepo = (index: number) => {
  clearBranchLoadTimer(index)
  repos.value.splice(index, 1)
  delete repoBranchStates[index]
  delete repoLastInspectedUrl[index]
  const entries = Object.entries(repoBranchStates)
  const inspectedEntries = Object.entries(repoLastInspectedUrl)
  for (const key of Object.keys(repoBranchStates)) {
    delete repoBranchStates[Number(key)]
  }
  for (const key of Object.keys(repoLastInspectedUrl)) {
    delete repoLastInspectedUrl[Number(key)]
  }
  for (const [rawIndex, state] of entries) {
    const oldIndex = Number(rawIndex)
    const nextIndex = oldIndex > index ? oldIndex - 1 : oldIndex
    if (oldIndex !== index) {
      repoBranchStates[nextIndex] = state
    }
  }
  for (const [rawIndex, url] of inspectedEntries) {
    const oldIndex = Number(rawIndex)
    const nextIndex = oldIndex > index ? oldIndex - 1 : oldIndex
    if (oldIndex !== index) {
      repoLastInspectedUrl[nextIndex] = url
    }
  }
}

const close = () => {
  emit('update:open', false)
}

const loadBranchesForRepo = async (index: number, options?: { force?: boolean }) => {
  const repo = repos.value[index]
  const gitUrl = repo?.url.trim()
  if (!repo || !gitUrl || !props.businessLineId || getDuplicateRepoUrlError(index)) {
    return
  }

  if (
    !options?.force &&
    repoLastInspectedUrl[index] === gitUrl &&
    (repoBranchStates[index]?.branches.length ?? 0) > 0
  ) {
    return
  }

  const requestKey = `${++branchRequestSeq}:${gitUrl}`
  repoBranchStates[index] = {
    key: requestKey,
    loading: true,
    branches: repoBranchStates[index]?.branches ?? [],
    error: '',
  }

  try {
    const inspection = await projectsApi.inspectRepository({
      businessLineId: props.businessLineId,
      gitUrl,
    })
    if (repoBranchStates[index]?.key !== requestKey) {
      return
    }

    repoBranchStates[index] = {
      key: requestKey,
      loading: false,
      branches: inspection.branches,
      error: '',
    }
    repoLastInspectedUrl[index] = gitUrl

    const currentBranch = repo.branch.trim()
    if (!currentBranch || !inspection.branches.includes(currentBranch)) {
      repo.branch = inspection.recommendedDefaultBranch ?? inspection.branches[0] ?? currentBranch
    }
  } catch (error) {
    if (repoBranchStates[index]?.key !== requestKey) {
      return
    }
    repoBranchStates[index] = {
      key: requestKey,
      loading: false,
      branches: [],
      error: error instanceof Error ? error.message : '分支加载失败，可手动填写',
    }
  }
}

const branchOptionsForRepo = (index: number) => {
  const branches = repoBranchStates[index]?.branches ?? []
  return branches.map((branch) => ({ label: branch, value: branch }))
}

const submit = () => {
  if (!name.value.trim()) {
    validationMessage.value = '项目名称不能为空'
    return
  }

  if (props.mode === 'create') {
    const branchPreview = workspaceBranchPreview.value
    if (!slug.value.trim()) {
      validationMessage.value = '项目标识不能为空'
      return
    }
    if (branchPreview?.error) {
      validationMessage.value = branchPreview.error
      return
    }
  }

  const validRepos = repos.value.filter((r) => r.url.trim())
  if (validRepos.length === 0) {
    validationMessage.value = '至少需要添加一个仓库'
    return
  }

  const duplicateRepoMessage = findDuplicateRepoUrlMessage(validRepos)
  if (duplicateRepoMessage) {
    validationMessage.value = duplicateRepoMessage
    return
  }

  for (const r of validRepos) {
    if (!r.branch.trim()) {
      validationMessage.value = `仓库 "${r.url}" 的分支不能为空`
      return
    }
  }

  const prefixCount = new Map<string, number>()
  const subRepos = validRepos.map((r) => {
    let prefix = r.prefix.trim() || derivePrefix(r.url)
    if (!prefix) prefix = 'repo'
    const count = (prefixCount.get(prefix) ?? 0) + 1
    prefixCount.set(prefix, count)
    const finalPrefix = count > 1 ? `${prefix}-${count}` : prefix
    return {
      url: r.url.trim(),
      prefix: finalPrefix,
      branch: r.branch.trim(),
    }
  })

  validationMessage.value = ''
  emit('submit', {
    name: name.value.trim(),
    slug: props.mode === 'create' ? slug.value.trim() : undefined,
    description: description.value,
    gitUrl: '',
    defaultBranch: workspaceBranchPreview.value?.branch ?? props.initialDefaultBranch,
    subRepos,
  })
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    syncFormValues()
  },
)

watch(
  () => [
    props.initialName,
    props.initialSlug,
    props.initialDescription,
    props.initialGitUrl,
    props.initialDefaultBranch,
    props.initialSubRepos,
    props.mode,
  ],
  () => {
    if (!props.open) return
    syncFormValues()
  },
)

watch(
  () => repos.value.map((repo) => repo.url),
  (urls, oldUrls) => {
    if (!props.open) return
    urls.forEach((url, index) => {
      const trimmed = url.trim()
      const oldTrimmed = oldUrls?.[index]?.trim() ?? ''
      if (trimmed === oldTrimmed) return

      delete repoLastInspectedUrl[index]
      if (!trimmed) {
        clearBranchLoadTimer(index)
        delete repoBranchStates[index]
        return
      }

      if (getDuplicateRepoUrlError(index)) {
        clearBranchLoadTimer(index)
        delete repoBranchStates[index]
        return
      }

      repoBranchStates[index] = {
        key: repoBranchStates[index]?.key ?? '',
        loading: true,
        branches: [],
        error: '',
      }
      scheduleLoadBranchesForRepo(index)
    })
  },
)

onBeforeUnmount(() => {
  for (const index of branchLoadTimers.keys()) {
    clearBranchLoadTimer(index)
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭项目表单弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section aria-modal="true" role="dialog" :class="sectionClass">
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="text-sm font-semibold">{{ modalTitle }}</h2>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="close"
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

        <form :class="formClass" @submit.prevent="submit">
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">项目名称</span>
            <input
              v-model="name"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="输入项目名称"
            />
          </label>

          <label v-if="props.mode === 'create'" class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">项目标识</span>
            <input
              v-model="slug"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm text-foreground"
              placeholder="例如：ainative-app"
            />
            <p
              v-if="workspaceBranchPreview?.branch"
              class="text-[11px] text-muted-foreground"
            >
              分支名预览：<span class="font-mono">{{ workspaceBranchPreview.branch }}</span>
            </p>
            <p
              v-else-if="workspaceBranchPreview?.error"
              class="text-[11px] text-destructive"
            >
              {{ workspaceBranchPreview.error }}
            </p>
          </label>

          <label v-else-if="props.initialSlug" class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">标识</span>
            <input
              :value="props.initialSlug"
              type="text"
              readonly
              disabled
              class="h-10 w-full cursor-not-allowed rounded-lg border border-border bg-muted/40 px-3 font-mono text-sm text-muted-foreground"
            />
            <p class="text-[11px] text-muted-foreground">创建后不可修改</p>
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">描述（可选）</span>
            <input
              v-model="description"
              type="text"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="输入项目描述"
            />
          </label>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-muted-foreground">仓库配置</span>
              <button
                type="button"
                class="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition hover:bg-muted"
                @click="addRepo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                添加仓库
              </button>
            </div>

            <div
              v-for="(repo, index) in repos"
              :key="index"
              class="rounded-lg border border-border bg-muted/30"
            >
              <div class="flex items-start gap-2 p-2.5">
                <div class="grid flex-1 gap-2" style="grid-template-columns: 3fr 1fr">
                  <input
                    v-model="repo.url"
                    type="text"
                    class="h-9 w-full rounded-md border px-2.5 text-xs text-foreground"
                    :class="
                      getDuplicateRepoUrlError(index)
                        ? 'border-destructive bg-destructive/5'
                        : 'border-border bg-background'
                    "
                    placeholder="仓库地址 git@gitlab.example.com:group/repo.git"
                    @blur="loadBranchesForRepo(index)"
                  />
                  <select
                    v-if="branchOptionsForRepo(index).length > 0"
                    v-model="repo.branch"
                    class="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground"
                  >
                    <option
                      v-for="option in branchOptionsForRepo(index)"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                  <input
                    v-else
                    v-model="repo.branch"
                    type="text"
                    class="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground"
                    :placeholder="repoBranchStates[index]?.loading ? '加载分支中...' : '分支'"
                  />
                </div>
                <button
                  type="button"
                  class="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  aria-label="删除仓库"
                  @click="removeRepo(index)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
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
              </div>
              <div class="flex items-center justify-end gap-2 px-2.5 pb-2.5">
                <span
                  v-if="getDuplicateRepoUrlError(index)"
                  class="mr-auto text-[11px] text-destructive"
                >
                  {{ getDuplicateRepoUrlError(index) }}
                </span>
                <span
                  v-else-if="repoBranchStates[index]?.error"
                  class="mr-auto text-[11px] text-destructive"
                >
                  {{ repoBranchStates[index]?.error }}
                </span>
                <span
                  v-else-if="repoBranchStates[index]?.loading"
                  class="mr-auto text-[11px] text-muted-foreground"
                >
                  正在拉取远端分支...
                </span>
                <button
                  type="button"
                  class="inline-flex h-7 items-center rounded-md border border-border bg-background px-2 text-[11px] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="
                    !repo.url.trim() ||
                    repoBranchStates[index]?.loading ||
                    !!getDuplicateRepoUrlError(index)
                  "
                  @click="loadBranchesForRepo(index, { force: true })"
                >
                  {{ repoBranchStates[index]?.branches?.length ? '刷新分支' : '拉取分支' }}
                </button>
              </div>
            </div>

            <p v-if="repos.length === 0" class="text-[11px] text-muted-foreground">
              点击"添加仓库"配置代码仓库，任务创建时会自动同步最新代码。
            </p>
          </div>

          <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
          <p v-else-if="props.errorMessage" class="text-sm text-destructive">
            {{ props.errorMessage }}
          </p>

          <div class="flex justify-end gap-2 pt-1">
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
              {{ props.submitting ? '保存中...' : props.mode === 'edit' ? '保存修改' : '保存配置' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
