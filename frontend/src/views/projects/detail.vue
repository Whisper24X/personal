<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useMessage } from '@/hooks'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import { usersApi } from '@/api/users'
import type { ProjectContext } from '@/types/api/project-context'
import type { Project, ProjectMember } from '@/types/api/projects'
import type { Task } from '@/types/api/tasks'
import type { User } from '@/types/api/users'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'

defineOptions({
  name: 'ProjectsDetailView',
})

const route = useRoute()
const projectId = computed(() => String(route.params.id ?? ''))

type TabKey = 'overview' | 'context' | 'members' | 'config'
const tab = ref<TabKey>('overview')

const loading = ref(false)
const validationMessage = ref('')
const message = useMessage()

const project = ref<Project | null>(null)
const projectMembers = ref<ProjectMember[]>([])
const recentTasks = ref<Task[]>([])
const projectContext = ref<ProjectContext | null>(null)
const users = ref<User[]>([])
const contextLoading = ref(false)

const creatingMember = ref(false)
const updatingMemberId = ref<string | null>(null)
const removingMemberId = ref<string | null>(null)
const savingConfig = ref(false)
const memberFormModalOpen = ref(false)
const configFormModalOpen = ref(false)

const memberRoleDrafts = ref<Record<string, ProjectMember['role']>>({})

const newMemberForm = reactive({
  userId: '',
  role: 'developer' as ProjectMember['role'],
})

const configForm = reactive({
  name: '',
  description: '',
  gitUrl: '',
  defaultBranch: 'main',
  agentAdapter: 'codex',
  agentRunnerEnabled: false,
  gitRuntimeEnabled: false,
  repoLocalPath: '',
  repoCacheBaseDir: '',
  worktreeBaseDir: '',
  skills: '',
  mcp: '',
  maxConcurrency: '2',
  priority: 'normal',
  runnerCommand: '',
  runnerArgs: '',
  runnerTimeoutSeconds: '600',
})

const formatDate = (value?: string) => {
  if (!value) return '-'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value
  return parsedDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusLabelMap: Record<Task['status'], string> = {
  todo: '待执行',
  in_progress: '执行中',
  in_review: '待处理',
  done: '已完成',
}

const statusClassMap: Record<Task['status'], string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  in_review: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}

const contextSourceLabelMap: Record<ProjectContext['source'], string> = {
  local_repository: '本地仓库',
  project_config: '项目配置',
  empty: '未找到上下文',
}

const formatContextLength = (length: number) => {
  if (length >= 1024 * 1024) {
    return `${(length / (1024 * 1024)).toFixed(2)} MB`
  }

  if (length >= 1024) {
    return `${(length / 1024).toFixed(1)} KB`
  }

  return `${length} B`
}

const tabClass = (key: TabKey) =>
  key === tab.value
    ? 'bg-background text-foreground shadow-sm'
    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'

const userMap = computed(() => {
  return new Map(users.value.map((user) => [user.id, user]))
})

const displayUserName = (userId: string) => {
  const user = userMap.value.get(userId)
  if (!user) {
    return userId
  }

  return user.nickname?.trim() || user.username
}

const displayUserMeta = (userId: string) => {
  const user = userMap.value.get(userId)
  if (!user) {
    return ''
  }

  return user.username
}

const runningTaskCount = computed(() => {
  return recentTasks.value.filter((task) => task.status === 'in_progress').length
})

const doneTaskCount = computed(() => {
  return recentTasks.value.filter((task) => task.status === 'done').length
})

const openMemberFormModal = () => {
  validationMessage.value = ''
  memberFormModalOpen.value = true
}

const closeMemberFormModal = () => {
  memberFormModalOpen.value = false
  validationMessage.value = ''
}

const openConfigFormModal = () => {
  validationMessage.value = ''
  configFormModalOpen.value = true
}

const closeConfigFormModal = () => {
  configFormModalOpen.value = false
  validationMessage.value = ''
}

const syncConfigForm = (currentProject: Project) => {
  const configJson = (currentProject.configJson ?? {}) as Record<string, unknown>
  const runnerConfig =
    configJson.agentRunner && typeof configJson.agentRunner === 'object'
      ? (configJson.agentRunner as Record<string, unknown>)
      : {}

  configForm.name = currentProject.name
  configForm.description = currentProject.description ?? ''
  configForm.gitUrl = currentProject.gitUrl
  configForm.defaultBranch = currentProject.defaultBranch
  configForm.agentAdapter = typeof configJson.agentAdapter === 'string' ? configJson.agentAdapter : 'codex'
  configForm.agentRunnerEnabled = configJson.agentRunnerEnabled === true
  configForm.gitRuntimeEnabled = configJson.gitRuntimeEnabled === true
  configForm.repoLocalPath = typeof configJson.repoLocalPath === 'string' ? configJson.repoLocalPath : ''
  configForm.repoCacheBaseDir =
    typeof configJson.repoCacheBaseDir === 'string' ? configJson.repoCacheBaseDir : ''
  configForm.worktreeBaseDir =
    typeof configJson.worktreeBaseDir === 'string' ? configJson.worktreeBaseDir : ''
  configForm.skills = Array.isArray(configJson.allowedSkills)
    ? configJson.allowedSkills.map((item) => String(item)).join(', ')
    : ''
  configForm.mcp = Array.isArray(configJson.allowedMcp)
    ? configJson.allowedMcp.map((item) => String(item)).join(', ')
    : ''
  configForm.maxConcurrency =
    typeof configJson.maxConcurrency === 'number' && configJson.maxConcurrency > 0
      ? String(configJson.maxConcurrency)
      : '2'
  configForm.priority = typeof configJson.priority === 'string' ? configJson.priority : 'normal'
  configForm.runnerCommand = typeof runnerConfig.command === 'string' ? runnerConfig.command : ''
  configForm.runnerArgs = Array.isArray(runnerConfig.args)
    ? runnerConfig.args.map((item) => String(item)).join(', ')
    : ''
  configForm.runnerTimeoutSeconds =
    typeof runnerConfig.timeoutSeconds === 'number' && runnerConfig.timeoutSeconds > 0
      ? String(runnerConfig.timeoutSeconds)
      : '600'
}

const loadProjectContext = async () => {
  if (!projectId.value) {
    return
  }

  contextLoading.value = true

  try {
    projectContext.value = await projectsApi.context(projectId.value)
  } catch (error) {
    projectContext.value = null
    message.error(toErrorMessage(error, '加载项目上下文失败'))
  } finally {
    contextLoading.value = false
  }
}

const loadUsers = async () => {
  users.value = await fetchAllPages((page, limit) => usersApi.list({ page, limit }))
}

const loadProjectData = async () => {
  if (!projectId.value) {
    return
  }

  loading.value = true
  validationMessage.value = ''

  try {
    const [projectResponse, memberResponse, taskResponse] = await Promise.all([
      projectsApi.detail(projectId.value),
      projectsApi.listMembers(projectId.value),
      tasksApi.list({ projectId: projectId.value, page: 1, limit: 20 }),
    ])

    project.value = projectResponse
    projectMembers.value = memberResponse
    recentTasks.value = taskResponse.data

    memberRoleDrafts.value = memberResponse.reduce<Record<string, ProjectMember['role']>>((result, member) => {
      result[member.userId] = member.role
      return result
    }, {})

    syncConfigForm(projectResponse)
    await loadProjectContext()
  } catch (error) {
    message.error(toErrorMessage(error, '加载项目详情失败'))
  } finally {
    loading.value = false
  }
}

const createMember = async () => {
  if (!projectId.value || !newMemberForm.userId.trim()) {
    return
  }

  const normalizedUserId = newMemberForm.userId.trim()
  const duplicatedMember = projectMembers.value.find((member) => member.userId === normalizedUserId)
  if (duplicatedMember) {
    validationMessage.value = '该用户已在当前项目成员列表中'
    return
  }

  creatingMember.value = true
  validationMessage.value = ''

  try {
    await projectsApi.addMember(projectId.value, {
      userId: normalizedUserId,
      role: newMemberForm.role,
    })

    newMemberForm.userId = ''
    newMemberForm.role = 'developer'
    closeMemberFormModal()
    await loadProjectData()
    message.success('添加项目成员成功')
  } catch (error) {
    message.error(toErrorMessage(error, '添加项目成员失败'))
  } finally {
    creatingMember.value = false
  }
}

const updateMemberRole = async (member: ProjectMember) => {
  if (!projectId.value) {
    return
  }

  const nextRole = memberRoleDrafts.value[member.userId]
  if (!nextRole || nextRole === member.role) {
    return
  }

  updatingMemberId.value = member.userId

  try {
    await projectsApi.updateMember(projectId.value, member.userId, {
      role: nextRole,
    })

    await loadProjectData()
    message.success('更新成员角色成功')
  } catch (error) {
    message.error(toErrorMessage(error, '更新成员角色失败'))
  } finally {
    updatingMemberId.value = null
  }
}

const removeMember = async (member: ProjectMember) => {
  if (!projectId.value) {
    return
  }

  if (!window.confirm(`确认移除成员 ${member.userId} 吗？`)) {
    return
  }

  removingMemberId.value = member.userId

  try {
    await projectsApi.removeMember(projectId.value, member.userId)
    await loadProjectData()
    message.success('移除成员成功')
  } catch (error) {
    message.error(toErrorMessage(error, '移除成员失败'))
  } finally {
    removingMemberId.value = null
  }
}

const saveConfig = async () => {
  if (!project.value || !projectId.value || !configForm.name.trim() || !configForm.gitUrl.trim()) {
    validationMessage.value = '项目名称和仓库地址不能为空'
    return
  }

  savingConfig.value = true
  validationMessage.value = ''

  try {
    const allowedSkills = configForm.skills
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const allowedMcp = configForm.mcp
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const runnerArgs = configForm.runnerArgs
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const configJson: Record<string, unknown> = {
      agentAdapter: configForm.agentAdapter.trim() || 'codex',
      allowedSkills,
      allowedMcp,
      maxConcurrency: Math.max(1, Number(configForm.maxConcurrency) || 1),
      priority: configForm.priority.trim() || 'normal',
      agentRunnerEnabled: configForm.agentRunnerEnabled,
      gitRuntimeEnabled: configForm.gitRuntimeEnabled,
      ...(configForm.repoLocalPath.trim() ? { repoLocalPath: configForm.repoLocalPath.trim() } : {}),
      ...(configForm.repoCacheBaseDir.trim()
        ? { repoCacheBaseDir: configForm.repoCacheBaseDir.trim() }
        : {}),
      ...(configForm.worktreeBaseDir.trim() ? { worktreeBaseDir: configForm.worktreeBaseDir.trim() } : {}),
      agentRunner: {
        ...(configForm.runnerCommand.trim() ? { command: configForm.runnerCommand.trim() } : {}),
        ...(runnerArgs.length ? { args: runnerArgs } : {}),
        timeoutSeconds: Math.max(5, Number(configForm.runnerTimeoutSeconds) || 600),
      },
    }

    await projectsApi.update(projectId.value, {
      name: configForm.name.trim(),
      description: configForm.description.trim() || undefined,
      gitUrl: configForm.gitUrl.trim(),
      defaultBranch: configForm.defaultBranch.trim() || 'main',
      configJson,
    })

    await loadProjectData()
    closeConfigFormModal()
    message.success('保存项目配置成功')
  } catch (error) {
    message.error(toErrorMessage(error, '保存项目配置失败'))
  } finally {
    savingConfig.value = false
  }
}

watch(
  () => projectId.value,
  () => {
    void loadProjectData()
  },
)

onMounted(() => {
  void loadProjectData()
  void loadUsers().catch((error) => {
    message.error(toErrorMessage(error, '加载用户列表失败'))
  })
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <RouterLink to="/projects" class="hover:text-foreground hover:underline">项目列表</RouterLink>
        <span>/</span>
        <span class="font-mono">{{ projectId }}</span>
      </div>

      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="space-y-1">
          <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">{{ project?.name ?? '项目详情' }}</h1>
          <p class="text-sm text-muted-foreground">
            <span class="font-mono text-xs">{{ project?.gitUrl ?? '-' }}</span>
            <span class="mx-2">•</span>
            <span class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
              {{ project?.defaultBranch ?? '-' }}
            </span>
            <span class="mx-2">•</span>
            <span>更新于 {{ formatDate(project?.updatedAt) }}</span>
          </p>
        </div>

        <RouterLink
          to="/tasks"
          class="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
        >
          新建任务
        </RouterLink>
      </div>

      <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
    </section>

    <section v-if="loading" class="panel-card p-6 text-sm text-muted-foreground">加载中...</section>

    <template v-else-if="project">
      <section class="panel-card flex flex-wrap gap-2 p-2">
        <button
          class="rounded-xl px-4 py-2 text-sm font-semibold transition"
          :class="tabClass('overview')"
          type="button"
          @click="tab = 'overview'"
        >
          概览
        </button>
        <button
          class="rounded-xl px-4 py-2 text-sm font-semibold transition"
          :class="tabClass('context')"
          type="button"
          @click="tab = 'context'"
        >
          项目上下文
        </button>
        <button
          class="rounded-xl px-4 py-2 text-sm font-semibold transition"
          :class="tabClass('members')"
          type="button"
          @click="tab = 'members'"
        >
          成员管理
        </button>
        <button
          class="rounded-xl px-4 py-2 text-sm font-semibold transition"
          :class="tabClass('config')"
          type="button"
          @click="tab = 'config'"
        >
          项目配置
        </button>
      </section>

      <section v-if="tab === 'overview'" class="space-y-6">
        <div class="grid gap-4 md:grid-cols-3">
          <div class="panel-card p-4">
            <p class="text-xs text-muted-foreground">任务总数</p>
            <p class="mt-2 text-2xl font-semibold">{{ recentTasks.length }}</p>
          </div>
          <div class="panel-card p-4">
            <p class="text-xs text-muted-foreground">执行中</p>
            <p class="mt-2 text-2xl font-semibold">{{ runningTaskCount }}</p>
          </div>
          <div class="panel-card p-4">
            <p class="text-xs text-muted-foreground">已完成</p>
            <p class="mt-2 text-2xl font-semibold">{{ doneTaskCount }}</p>
          </div>
        </div>

        <div class="panel-card p-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold">最近任务</p>
              <p class="text-xs text-muted-foreground">按任务状态快速查看执行进度</p>
            </div>
            <RouterLink
              :to="`/tasks?projectId=${project.id}`"
              class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            >
              查看全部
            </RouterLink>
          </div>

          <div class="mt-4 space-y-2">
            <RouterLink
              v-for="task in recentTasks"
              :key="task.id"
              :to="{
                name: 'task-detail',
                params: { id: task.id },
                query: { projectId: task.projectId || project?.id || '' },
              }"
              class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 hover:bg-background"
            >
              <div>
                <p class="font-semibold">{{ task.title }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ task.id }} · {{ formatDate(task.updatedAt) }}</p>
              </div>
              <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold" :class="statusClassMap[task.status]">
                {{ statusLabelMap[task.status] }}
              </span>
            </RouterLink>

            <div v-if="recentTasks.length === 0" class="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              暂无任务，点击右上角“新建任务”开始。
            </div>
          </div>
        </div>
      </section>


      <section v-else-if="tab === 'context'" class="space-y-4">
        <div class="panel-card p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">项目上下文</p>
              <p class="mt-1 text-xs text-muted-foreground">自动读取 README / docs / spec 目录内容，供任务执行时参考。</p>
            </div>
            <button
              class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="contextLoading"
              type="button"
              @click="loadProjectContext"
            >
              {{ contextLoading ? '刷新中...' : '刷新上下文' }}
            </button>
          </div>

          <div v-if="contextLoading" class="mt-4 text-sm text-muted-foreground">上下文加载中...</div>

          <template v-else-if="projectContext">
            <div class="mt-4 grid gap-3 md:grid-cols-3">
              <div class="rounded-lg border border-border bg-background/70 px-4 py-3">
                <p class="text-xs text-muted-foreground">来源</p>
                <p class="mt-1 text-sm font-semibold">{{ contextSourceLabelMap[projectContext.source] }}</p>
              </div>
              <div class="rounded-lg border border-border bg-background/70 px-4 py-3">
                <p class="text-xs text-muted-foreground">文档数量</p>
                <p class="mt-1 text-sm font-semibold">{{ projectContext.documents.length }}</p>
              </div>
              <div class="rounded-lg border border-border bg-background/70 px-4 py-3">
                <p class="text-xs text-muted-foreground">快照时间</p>
                <p class="mt-1 text-sm font-semibold">{{ formatDate(projectContext.generatedAt) }}</p>
              </div>
            </div>

            <div
              v-if="projectContext.warnings.length > 0"
              class="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-300"
            >
              <p class="text-xs font-semibold uppercase tracking-wide">读取提示</p>
              <ul class="mt-2 list-disc space-y-1 pl-5 text-xs">
                <li v-for="warning in projectContext.warnings" :key="warning">{{ warning }}</li>
              </ul>
            </div>

            <div class="mt-4 space-y-3">
              <article
                v-for="document in projectContext.documents"
                :key="document.path"
                class="rounded-xl border border-border bg-background/70 px-4 py-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold">{{ document.title }}</p>
                    <p class="mt-1 font-mono text-xs text-muted-foreground">{{ document.path }}</p>
                  </div>
                  <span class="text-xs text-muted-foreground">{{ formatContextLength(document.length) }}</span>
                </div>

                <pre class="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">{{ document.preview }}</pre>
              </article>

              <div
                v-if="projectContext.documents.length === 0"
                class="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground"
              >
                当前没有可展示的上下文文档。
              </div>
            </div>
          </template>
        </div>
      </section>

      <section v-else-if="tab === 'members'" class="space-y-4">
        <div class="panel-card p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">成员管理</p>
              <p class="mt-1 text-xs text-muted-foreground">
                新增成员已迁移为弹窗表单，支持输入用户 ID 或从已加载用户列表中选择。
              </p>
            </div>
            <button
              class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              type="button"
              @click="openMemberFormModal"
            >
              添加成员
            </button>
          </div>
        </div>

        <div class="panel-card overflow-hidden">
          <table class="w-full min-w-[680px] text-left text-sm">
            <thead class="border-b border-border bg-background/60">
              <tr class="text-xs font-semibold text-muted-foreground">
                <th class="px-5 py-3">用户</th>
                <th class="px-5 py-3">角色</th>
                <th class="px-5 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="member in projectMembers" :key="member.id" class="transition hover:bg-background/70">
                <td class="px-5 py-4">
                  <p class="text-sm font-semibold">{{ displayUserName(member.userId) }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ displayUserMeta(member.userId) }}</p>
                  <p class="mt-1 font-mono text-[11px] text-muted-foreground">{{ member.userId }}</p>
                </td>
                <td class="px-5 py-4">
                  <select
                    v-model="memberRoleDrafts[member.userId]"
                    class="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  >
                    <option value="owner">owner</option>
                    <option value="maintainer">maintainer</option>
                    <option value="developer">developer</option>
                    <option value="viewer">viewer</option>
                  </select>
                </td>
                <td class="px-5 py-4">
                  <div class="flex justify-end gap-2">
                    <button
                      class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="updatingMemberId === member.userId"
                      type="button"
                      @click="updateMemberRole(member)"
                    >
                      {{ updatingMemberId === member.userId ? '保存中...' : '保存角色' }}
                    </button>
                    <button
                      class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="removingMemberId === member.userId"
                      type="button"
                      @click="removeMember(member)"
                    >
                      {{ removingMemberId === member.userId ? '移除中...' : '移除' }}
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="projectMembers.length === 0">
                <td class="px-5 py-6 text-sm text-muted-foreground" colspan="3">暂无成员，请先添加。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else class="space-y-4">
        <div class="panel-card p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">项目配置</p>
              <p class="mt-1 text-xs text-muted-foreground">
                配置编辑已迁移为弹窗表单，避免在页面中直接展示创建和编辑区域。
              </p>
            </div>
            <button
              class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              type="button"
              @click="openConfigFormModal"
            >
              编辑配置
            </button>
          </div>

          <dl class="mt-4 grid gap-3 rounded-xl border border-border bg-background/70 p-4 text-xs md:grid-cols-2">
            <div>
              <dt class="text-muted-foreground">项目名称</dt>
              <dd class="mt-1 font-semibold text-foreground">{{ configForm.name || '-' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">默认分支</dt>
              <dd class="mt-1 text-foreground">{{ configForm.defaultBranch || '-' }}</dd>
            </div>
            <div class="md:col-span-2">
              <dt class="text-muted-foreground">仓库地址</dt>
              <dd class="mt-1 break-all text-foreground">{{ configForm.gitUrl || '-' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Agent 执行器</dt>
              <dd class="mt-1 text-foreground">{{ configForm.agentAdapter || '-' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">并发上限</dt>
              <dd class="mt-1 text-foreground">{{ configForm.maxConcurrency || '-' }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </template>

    <Teleport to="body">
      <div
        v-if="memberFormModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-member-form-modal-title"
        @click.self="closeMemberFormModal"
      >
        <section class="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="project-member-form-modal-title" class="text-sm font-semibold">添加成员</h2>
            <button
              class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              type="button"
              aria-label="关闭成员弹窗"
              @click="closeMemberFormModal"
            >
              关闭
            </button>
          </header>

          <form class="grid gap-3 px-4 py-4 md:grid-cols-[1fr_200px]" @submit.prevent="createMember">
            <input
              v-model="newMemberForm.userId"
              class="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              list="project-member-user-options"
              placeholder="输入或选择用户"
              type="text"
            />
            <datalist id="project-member-user-options">
              <option v-for="user in users" :key="user.id" :value="user.id">
                {{ user.nickname?.trim() || user.username }}
              </option>
            </datalist>
            <select
              v-model="newMemberForm.role"
              class="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="owner">owner</option>
              <option value="maintainer">maintainer</option>
              <option value="developer">developer</option>
              <option value="viewer">viewer</option>
            </select>
            <div class="md:col-span-2 flex justify-end gap-2">
              <button
                class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
                type="button"
                @click="closeMemberFormModal"
              >
                取消
              </button>
              <button
                class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="creatingMember"
                type="submit"
              >
                {{ creatingMember ? '添加中...' : '添加成员' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="configFormModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-config-form-modal-title"
        @click.self="closeConfigFormModal"
      >
        <section class="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="project-config-form-modal-title" class="text-sm font-semibold">编辑项目配置</h2>
            <button
              class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              type="button"
              aria-label="关闭配置弹窗"
              @click="closeConfigFormModal"
            >
              关闭
            </button>
          </header>

          <form class="grid max-h-[calc(92vh-56px)] gap-4 overflow-auto px-4 py-4 md:grid-cols-2" @submit.prevent="saveConfig">
            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">项目名称</span>
              <input
                v-model="configForm.name"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">默认分支</span>
              <input
                v-model="configForm.defaultBranch"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">仓库地址</span>
              <input
                v-model="configForm.gitUrl"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">描述</span>
              <input
                v-model="configForm.description"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Agent 执行器</span>
              <input
                v-model="configForm.agentAdapter"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如 codex"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">并发上限</span>
              <input
                v-model="configForm.maxConcurrency"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                min="1"
                type="number"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Agent Runner 开关</span>
              <select
                v-model="configForm.agentRunnerEnabled"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option :value="true">开启（真实执行）</option>
                <option :value="false">关闭（模拟执行）</option>
              </select>
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Git Runtime 开关</span>
              <select
                v-model="configForm.gitRuntimeEnabled"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option :value="true">开启（clone/worktree）</option>
                <option :value="false">关闭（目录沙箱）</option>
              </select>
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Skills 白名单（逗号分隔）</span>
              <input
                v-model="configForm.skills"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="code-review, test-generator"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">MCP 白名单（逗号分隔）</span>
              <input
                v-model="configForm.mcp"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="filesystem, jira"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">Repo 本地路径（可选）</span>
              <input
                v-model="configForm.repoLocalPath"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="/path/to/existing/repo"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">Repo 缓存目录（可选）</span>
              <input
                v-model="configForm.repoCacheBaseDir"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="/path/to/repo-cache"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">Worktree 基础目录（可选）</span>
              <input
                v-model="configForm.worktreeBaseDir"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="/path/to/worktrees"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">Runner 命令（可选）</span>
              <input
                v-model="configForm.runnerCommand"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如 codex"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Runner 参数（逗号分隔）</span>
              <input
                v-model="configForm.runnerArgs"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="exec, --skip-git-repo-check, -"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Runner 超时秒数</span>
              <input
                v-model="configForm.runnerTimeoutSeconds"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                min="5"
                type="number"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">优先级策略</span>
              <input
                v-model="configForm.priority"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="normal"
                type="text"
              />
            </label>

            <div class="md:col-span-2 flex justify-end gap-2">
              <button
                class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
                type="button"
                @click="closeConfigFormModal"
              >
                取消
              </button>
              <button
                class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="savingConfig"
                type="submit"
              >
                {{ savingConfig ? '保存中...' : '保存配置' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
