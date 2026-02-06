<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

type SettingsSectionId =
  | 'account'
  | 'general'
  | 'sound'
  | 'notification'
  | 'editor'
  | 'agent-cli'
  | 'git'
  | 'workflow'
  | 'mcp'
  | 'skills'
  | 'data'
  | 'about'

type SettingsSection = {
  id: SettingsSectionId
  label: string
  hint: string
  badge: string
}

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
}>()

const sections: SettingsSection[] = [
  { id: 'account', label: '账号', hint: '登录状态与身份信息', badge: 'AC' },
  { id: 'general', label: '通用', hint: '界面偏好与默认行为', badge: 'GN' },
  { id: 'sound', label: '提示音', hint: '任务提示与音量', badge: 'SD' },
  { id: 'notification', label: '通知', hint: '桌面与邮件提醒', badge: 'NT' },
  { id: 'editor', label: '编辑器', hint: '编码体验参数', badge: 'ED' },
  { id: 'agent-cli', label: 'Agent CLI', hint: '执行引擎与审批模式', badge: 'CL' },
  { id: 'git', label: 'Git', hint: '分支与提交策略', badge: 'GT' },
  { id: 'workflow', label: '工作流', hint: '模板与节点规则', badge: 'WF' },
  { id: 'mcp', label: 'MCP', hint: '服务连接与发现', badge: 'MP' },
  { id: 'skills', label: 'Skills', hint: '技能能力开关', badge: 'SK' },
  { id: 'data', label: '数据', hint: '缓存、日志与保留策略', badge: 'DT' },
  { id: 'about', label: '关于', hint: '版本与许可证信息', badge: 'AB' },
]

const activeSection = ref<SettingsSectionId>('account')

const state = reactive({
  accountName: 'fuzhifei',
  accountEmail: 'fuzhifei@example.com',
  compactMode: false,
  startupTips: true,
  soundEnabled: true,
  soundVolume: 65,
  desktopNotify: true,
  emailNotify: false,
  editorFontSize: 14,
  editorWordWrap: true,
  agentModel: 'GPT-5.3-Codex',
  agentApprovalMode: '按需申请',
  gitDefaultBranch: 'main',
  gitAutoFetch: true,
  workflowTemplate: 'Default Runner',
  workflowNeedApproval: true,
  mcpAutoConnect: true,
  skillsAutoUpdate: false,
  dataRetentionDays: 30,
})

const activeConfig = computed<SettingsSection>(() => {
  return sections.find((section) => section.id === activeSection.value) ?? sections[0]!
})

const closeModal = () => {
  emit('update:open', false)
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
      activeSection.value = 'account'
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKeydown)
      return
    }

    document.body.style.overflow = previousBodyOverflow
    window.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6" aria-live="polite">
      <button
        type="button"
        aria-label="关闭设置弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-sm"
        @click="closeModal"
      />

      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="settings-modal-title"
        class="relative z-10 flex h-[min(720px,90vh)] w-full max-w-6xl overflow-hidden rounded-3xl border border-border bg-background shadow-2xl"
      >
        <aside class="flex w-64 min-h-0 flex-col border-r border-border bg-muted/30">
          <div class="border-b border-border px-4 py-4">
            <div class="inline-flex items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-sm">
              <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground">AI</span>
              <div>
                <p class="text-sm font-semibold text-foreground">AINative</p>
                <p class="text-[11px] text-muted-foreground">Settings</p>
              </div>
            </div>
          </div>

          <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            <button
              v-for="section in sections"
              :key="section.id"
              type="button"
              class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :class="
                activeSection === section.id
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-foreground/75 hover:bg-accent/50 hover:text-foreground'
              "
              @click="activeSection = section.id"
            >
              <span class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-[10px] font-semibold tracking-wide">
                {{ section.badge }}
              </span>
              <span class="text-sm font-medium">{{ section.label }}</span>
            </button>
          </nav>
        </aside>

        <div class="flex min-h-0 flex-1 flex-col">
          <header class="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
            <div>
              <h2 id="settings-modal-title" class="text-xl font-semibold tracking-tight">{{ activeConfig.label }}</h2>
              <p class="mt-1 text-sm text-muted-foreground">{{ activeConfig.hint }}</p>
            </div>
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="关闭"
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

          <div class="min-h-0 flex-1 overflow-y-auto p-6">
            <div v-if="activeSection === 'account'" class="space-y-4">
              <article class="panel-card p-4">
                <p class="text-sm font-semibold">账号信息</p>
                <div class="mt-4 grid gap-3 md:grid-cols-2">
                  <label class="space-y-1">
                    <span class="text-xs text-muted-foreground">用户名</span>
                    <input
                      v-model="state.accountName"
                      class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                      type="text"
                    />
                  </label>
                  <label class="space-y-1">
                    <span class="text-xs text-muted-foreground">邮箱</span>
                    <input
                      v-model="state.accountEmail"
                      class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                      type="email"
                    />
                  </label>
                </div>
              </article>
              <article class="panel-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p class="text-sm font-semibold">会话管理</p>
                  <p class="mt-1 text-xs text-muted-foreground">可退出当前账号并返回登录页。</p>
                </div>
                <RouterLink
                  to="/login"
                  class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
                  @click="closeModal"
                >
                  退出登录
                </RouterLink>
              </article>
            </div>

            <div v-else-if="activeSection === 'general'" class="space-y-4">
              <article class="panel-card p-4">
                <p class="text-sm font-semibold">界面偏好</p>
                <div class="mt-4 grid gap-4 md:grid-cols-2">
                  <label class="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
                    紧凑布局
                    <input v-model="state.compactMode" type="checkbox" class="h-4 w-4" />
                  </label>
                  <label class="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
                    启动提示
                    <input v-model="state.startupTips" type="checkbox" class="h-4 w-4" />
                  </label>
                </div>
              </article>
            </div>

            <div v-else-if="activeSection === 'sound'" class="space-y-4">
              <article class="panel-card p-4">
                <label class="flex items-center justify-between text-sm font-semibold">
                  启用提示音
                  <input v-model="state.soundEnabled" type="checkbox" class="h-4 w-4" />
                </label>
                <label class="mt-4 block space-y-1">
                  <span class="text-xs text-muted-foreground">音量（{{ state.soundVolume }}%）</span>
                  <input v-model.number="state.soundVolume" type="range" min="0" max="100" class="w-full" />
                </label>
              </article>
            </div>

            <div v-else-if="activeSection === 'notification'" class="space-y-4">
              <article class="panel-card space-y-3 p-4">
                <label class="flex items-center justify-between text-sm">
                  桌面通知
                  <input v-model="state.desktopNotify" type="checkbox" class="h-4 w-4" />
                </label>
                <label class="flex items-center justify-between text-sm">
                  邮件通知
                  <input v-model="state.emailNotify" type="checkbox" class="h-4 w-4" />
                </label>
              </article>
            </div>

            <div v-else-if="activeSection === 'editor'" class="space-y-4">
              <article class="panel-card p-4">
                <label class="block space-y-1">
                  <span class="text-xs text-muted-foreground">字体大小</span>
                  <input v-model.number="state.editorFontSize" type="number" min="12" max="22" class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                </label>
                <label class="mt-4 flex items-center justify-between text-sm">
                  自动换行
                  <input v-model="state.editorWordWrap" type="checkbox" class="h-4 w-4" />
                </label>
              </article>
            </div>

            <div v-else-if="activeSection === 'agent-cli'" class="space-y-4">
              <article class="panel-card grid gap-3 p-4 md:grid-cols-2">
                <label class="space-y-1">
                  <span class="text-xs text-muted-foreground">默认模型</span>
                  <select v-model="state.agentModel" class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option>GPT-5.3-Codex</option>
                    <option>Claude Code</option>
                    <option>Gemini CLI</option>
                  </select>
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-muted-foreground">审批模式</span>
                  <select v-model="state.agentApprovalMode" class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option>按需申请</option>
                    <option>只读模式</option>
                    <option>完全放行</option>
                  </select>
                </label>
              </article>
            </div>

            <div v-else-if="activeSection === 'git'" class="space-y-4">
              <article class="panel-card p-4">
                <label class="block space-y-1">
                  <span class="text-xs text-muted-foreground">默认分支</span>
                  <input
                    v-model="state.gitDefaultBranch"
                    class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    type="text"
                  />
                </label>
                <label class="mt-4 flex items-center justify-between text-sm">
                  自动拉取远程变更
                  <input v-model="state.gitAutoFetch" type="checkbox" class="h-4 w-4" />
                </label>
              </article>
            </div>

            <div v-else-if="activeSection === 'workflow'" class="space-y-4">
              <article class="panel-card grid gap-3 p-4 md:grid-cols-2">
                <label class="space-y-1">
                  <span class="text-xs text-muted-foreground">默认模板</span>
                  <input v-model="state.workflowTemplate" class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" type="text" />
                </label>
                <label class="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  执行前需要审批
                  <input v-model="state.workflowNeedApproval" type="checkbox" class="h-4 w-4" />
                </label>
              </article>
            </div>

            <div v-else-if="activeSection === 'mcp'" class="space-y-4">
              <article class="panel-card p-4">
                <label class="flex items-center justify-between text-sm">
                  自动连接 MCP 服务
                  <input v-model="state.mcpAutoConnect" type="checkbox" class="h-4 w-4" />
                </label>
                <div class="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div class="rounded-lg border border-border bg-background px-3 py-2">filesystem · Connected</div>
                  <div class="rounded-lg border border-border bg-background px-3 py-2">shadcn-ui · Ready</div>
                </div>
              </article>
            </div>

            <div v-else-if="activeSection === 'skills'" class="space-y-4">
              <article class="panel-card p-4">
                <label class="flex items-center justify-between text-sm">
                  自动更新 Skills
                  <input v-model="state.skillsAutoUpdate" type="checkbox" class="h-4 w-4" />
                </label>
                <p class="mt-3 text-xs text-muted-foreground">当前工作区已加载 12 个技能包。</p>
              </article>
            </div>

            <div v-else-if="activeSection === 'data'" class="space-y-4">
              <article class="panel-card p-4">
                <label class="block space-y-1">
                  <span class="text-xs text-muted-foreground">日志保留天数</span>
                  <input
                    v-model.number="state.dataRetentionDays"
                    type="number"
                    min="1"
                    max="365"
                    class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>
                <div class="mt-4 flex gap-2">
                  <button class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm transition hover:shadow-md" type="button">
                    清理缓存
                  </button>
                  <button class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm transition hover:shadow-md" type="button">
                    导出日志
                  </button>
                </div>
              </article>
            </div>

            <div v-else class="space-y-4">
              <article class="panel-card space-y-2 p-4">
                <p class="text-sm font-semibold">AINative</p>
                <p class="text-sm text-muted-foreground">Version 0.1.0-beta</p>
                <p class="text-xs text-muted-foreground">AI Native 前端控制台，聚合项目、任务、Agent CLI 与工作流能力。</p>
              </article>
            </div>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
