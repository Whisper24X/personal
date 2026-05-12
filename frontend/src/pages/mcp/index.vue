<script setup lang="ts">
import { McpJsonImportModal } from '@features/business-lines'
import { useMcpPage } from './use-mcp-page'

defineOptions({
  name: 'McpManagementView',
})

const vm = useMcpPage()
</script>

<template>
  <div class="space-y-6 fade-up">
    <section v-if="!vm.activeProjectId" class="panel-card p-6 text-sm text-muted-foreground">
      请先在左侧选择项目后再查看 MCP。
    </section>

    <section v-if="vm.activeProjectId" class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-1 flex-wrap items-center gap-2">
          <input
            v-model="vm.keyword"
            class="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 版本 / 说明"
            type="search"
            @keydown.enter.prevent="void vm.loadProjectMcps()"
          />
        </div>

        <div class="flex items-center gap-2">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="void vm.loadProjectMcps()"
          >
            刷新
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="void vm.loadProjectMcps()"
          >
            搜索
          </button>
          <div :ref="(el) => vm.setAddMenuAnchorEl(el)" class="relative">
            <button
              type="button"
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
              :disabled="!vm.activeProjectId"
              @click="vm.toggleAddMenu"
            >
              添加 MCP
            </button>

            <div
              v-if="vm.addMenuOpen"
              class="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border bg-background p-1 shadow-lg"
            >
              <button
                type="button"
                class="flex w-full items-center rounded-md bg-primary/5 px-3 py-2 text-left text-sm text-foreground transition hover:bg-primary/10"
                @click="vm.openCopyMcpModal"
              >
                从业务线复制
              </button>
              <div class="my-1 border-t border-border" />
              <button
                type="button"
                class="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="vm.openImportMcpJsonModal('cursor')"
              >
                添加到 Cursor
              </button>
              <button
                type="button"
                class="mt-1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="vm.openImportMcpJsonModal('gemini')"
              >
                添加到 Gemini
              </button>
              <button
                type="button"
                class="mt-1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="vm.openImportMcpJsonModal('opencode')"
              >
                添加到 OpenCode
              </button>
              <button
                type="button"
                class="mt-1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="vm.openImportMcpJsonModal('claude-code')"
              >
                添加到 Claude Code
              </button>
              <button
                type="button"
                class="mt-1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="vm.openImportMcpJsonModal('codex')"
              >
                添加到 Codex
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="vm.activeProjectId && vm.loading"
      class="panel-card p-6 text-sm text-muted-foreground"
    >
      加载中...
    </section>

    <section v-else-if="vm.activeProjectId" class="space-y-4">
      <article v-if="!vm.hasAnyProjectMcp" class="panel-card p-6 text-sm text-muted-foreground">
        当前项目没有可读取的 MCP 本地配置。
      </article>

      <article v-for="group in vm.groupedProjectMcps" :key="group.id" class="panel-card p-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold">{{ group.label }}</p>
          <span
            class="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground"
          >
            {{ group.serverCount }} 项
          </span>
        </div>

        <div
          v-if="group.serverCount > 0 && vm.activeProjectId && vm.projectBusinessLineId"
          class="mt-3 flex flex-wrap items-center gap-2 border-b border-border pb-3"
        >
          <template v-if="vm.hasMcpProbeMappingForProvider(group.id)">
            <span class="text-xs font-medium text-muted-foreground">
              用于探测的 Agent CLI 配置（{{ group.label }}）
            </span>
            <select
              class="h-9 max-w-full min-w-[200px] flex-1 rounded-lg border border-border bg-background px-2 text-xs text-foreground md:max-w-md"
              :disabled="
                vm.loading ||
                vm.filterAgentToolConfigsForMcpProvider(group.id, vm.allAgentToolConfigs).length ===
                  0
              "
              :value="vm.getProbeAgentToolConfigId(group.id)"
              @change="
                vm.setProbeAgentToolConfigId(group.id, ($event.target as HTMLSelectElement).value)
              "
            >
              <option
                v-for="cfg in vm.filterAgentToolConfigsForMcpProvider(
                  group.id,
                  vm.allAgentToolConfigs,
                )"
                :key="cfg.id"
                :value="cfg.id"
              >
                {{ cfg.name }}（{{ cfg.toolId }}）
              </option>
            </select>
            <p
              v-if="
                !vm.loading &&
                vm.filterAgentToolConfigsForMcpProvider(group.id, vm.allAgentToolConfigs).length ===
                  0
              "
              class="w-full text-xs text-amber-700 dark:text-amber-400"
            >
              请先在业务线「Agent CLI」中为 {{ group.label }} 创建对应类型的配置后再探测。
            </p>
          </template>
          <p v-else class="w-full text-xs text-amber-700 dark:text-amber-400">
            该 MCP 来源无法匹配 Agent CLI 探测类型，「测试」已禁用。
          </p>
        </div>

        <div v-if="group.serverCount > 0" class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="item in group.servers"
            :key="item.id"
            class="flex min-h-[8rem] flex-col gap-2 rounded-xl border border-border bg-background/70 px-4 py-3 transition-colors hover:border-foreground/20"
          >
            <div
              class="min-w-0 flex-1 cursor-pointer"
              role="button"
              tabindex="0"
              @click="void vm.openMcpJsonPreview(item)"
              @keydown.enter.prevent="void vm.openMcpJsonPreview(item)"
              @keydown.space.prevent="void vm.openMcpJsonPreview(item)"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold">{{ item.name }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">版本：{{ item.version }}</p>
                </div>
              </div>

              <p class="mt-3 break-all font-mono text-[10px] text-muted-foreground">
                {{ vm.resolveSourcePath(item) || '-' }}
              </p>
            </div>
            <div
              class="grid gap-2"
              :class="vm.canAuthorizeLocalMcpOAuth(item) ? 'grid-cols-2' : 'grid-cols-1'"
            >
              <button
                type="button"
                class="inline-flex h-8 w-full items-center justify-center rounded-md border border-border bg-background text-xs font-semibold text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!vm.groupProbeTestReady(group.id) || vm.testingProjectMcpId === item.id"
                @click.stop="void vm.testProjectLocalMcp(item)"
              >
                {{ vm.testingProjectMcpId === item.id ? '探测中…' : '测试' }}
              </button>
              <button
                v-if="vm.canAuthorizeLocalMcpOAuth(item)"
                type="button"
                class="inline-flex h-8 w-full items-center justify-center rounded-md border text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                :class="
                  vm.getLocalMcpOAuthStatus(item) === 'connected'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
                    : 'border-border bg-background text-foreground hover:bg-muted/50'
                "
                :disabled="vm.isAuthorizingLocalMcpOAuth(item)"
                @click.stop="void vm.startLocalMcpOAuthLogin(item)"
              >
                {{ vm.getLocalMcpOAuthButtonLabel(item) }}
              </button>
            </div>
          </article>
        </div>

        <div
          v-else
          class="mt-4 flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
        >
          当前来源未发现 MCP 配置
        </div>
      </article>
    </section>

    <section v-if="vm.activeProjectId && vm.activeOAuthSession" class="panel-card p-5">
      <p class="text-sm font-semibold">完成 {{ vm.activeOAuthSession.provider }} 授权</p>
      <p class="mt-2 text-xs text-muted-foreground">
        点击打开授权页面并完成授权。浏览器跳到 127.0.0.1 失败页后，复制地址栏完整
        URL，回到这里读取剪贴板或手动粘贴。
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-md"
          @click="vm.openOAuthAuthorizationUrl"
        >
          打开授权页面
        </button>
        <button
          type="button"
          class="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted/50"
          @click="void vm.readClipboardForOAuthCallback()"
        >
          读取剪贴板
        </button>
      </div>
      <textarea
        v-model="vm.oauthCallbackUrl"
        class="mt-3 h-24 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
        placeholder="粘贴 http://127.0.0.1:<port>/callback?code=...&state=..."
      />
      <button
        type="button"
        class="mt-3 h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="vm.relayingOAuthCallback"
        @click="void vm.relayProjectOAuthCallback()"
      >
        {{ vm.relayingOAuthCallback ? '完成中…' : '完成登录' }}
      </button>
    </section>

    <McpJsonImportModal
      :open="vm.mcpJsonImportModalOpen"
      :submitting="vm.importingProjectMcps"
      :error-message="vm.mcpJsonImportError"
      @update:open="vm.mcpJsonImportModalOpen = $event"
      @submit="vm.submitImportMcpJson"
    />

    <Teleport to="body">
      <div
        v-if="vm.copyMcpModalOpen"
        class="fixed inset-0 z-[121] flex items-center justify-center p-3 sm:p-6"
        @keydown.esc.prevent.stop="vm.closeCopyMcpModal"
      >
        <button
          type="button"
          aria-label="关闭复制 MCP 弹窗"
          class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          @click="vm.closeCopyMcpModal"
        />

        <section
          aria-modal="true"
          role="dialog"
          class="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-background shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 class="text-base font-semibold">
              从业务线复制 MCP 到 {{ vm.projectName || '当前项目' }}
            </h2>
            <button
              type="button"
              aria-label="关闭"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
              @click="vm.closeCopyMcpModal"
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

          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div class="mb-3">
              <div class="mb-2 flex items-center justify-between">
                <label class="text-xs font-medium text-muted-foreground">复制到</label>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="text-xs text-muted-foreground underline hover:text-foreground"
                    @click="vm.selectAllCopyMcpProviders"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    class="text-xs text-muted-foreground underline hover:text-foreground"
                    @click="vm.clearAllCopyMcpProviders"
                  >
                    取消全选
                  </button>
                </div>
              </div>
              <div class="flex flex-wrap gap-x-4 gap-y-2">
                <label
                  v-for="p in vm.PROJECT_PROVIDER_ORDER"
                  :key="p"
                  class="flex cursor-pointer items-center gap-2"
                >
                  <input
                    v-model="vm.copyMcpTargetProviders"
                    type="checkbox"
                    :value="p"
                    class="h-4 w-4 rounded border-border"
                  />
                  <span class="text-sm">{{ vm.PROVIDER_LABEL_MAP[p] ?? p }}</span>
                </label>
              </div>
            </div>

            <input
              v-model="vm.copyMcpKeyword"
              type="search"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="搜索业务线 MCP"
            />

            <p v-if="vm.loadingBusinessLineMcps" class="mt-3 text-sm text-muted-foreground">
              加载中...
            </p>
            <p v-else-if="vm.copyMcpErrorMessage" class="mt-3 text-sm text-destructive">
              {{ vm.copyMcpErrorMessage }}
            </p>

            <div v-else class="mt-3 space-y-2">
              <article
                v-for="item in vm.filteredBusinessLineMcps"
                :key="item.id"
                class="rounded-xl border border-border bg-background/70 px-4 py-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold">{{ item.name }}</p>
                  </div>
                  <button
                    type="button"
                    class="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="vm.copyingBusinessLineMcpId === item.id"
                    @click="vm.submitCopyBusinessLineMcp(item)"
                  >
                    {{ vm.copyingBusinessLineMcpId === item.id ? '复制中...' : '复制' }}
                  </button>
                </div>
              </article>

              <article
                v-if="vm.filteredBusinessLineMcps.length === 0"
                class="rounded-xl border border-dashed border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground"
              >
                当前业务线暂无 MCP 配置。
              </article>
            </div>
          </div>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="vm.mcpJsonPreviewModalOpen"
        class="fixed inset-0 z-[125] flex items-center justify-center p-3 sm:p-6"
      >
        <button
          type="button"
          class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          aria-label="关闭 MCP JSON 预览弹窗"
          @click="vm.closeMcpJsonPreview"
        />
        <section
          aria-modal="true"
          role="dialog"
          class="relative z-10 w-full max-w-3xl rounded-2xl border border-border bg-background shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <div class="space-y-1">
              <h2 class="text-base font-semibold">MCP 配置</h2>
              <p class="text-xs text-muted-foreground">{{ vm.mcpJsonPreviewName }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="vm.mcpJsonPreviewItem && vm.isEditableProvider(vm.mcpJsonPreviewProvider)"
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="删除 MCP"
                :disabled="
                  vm.loadingMcpJsonPreview ||
                  vm.savingMcpJsonPreview ||
                  vm.removingProjectMcpId === vm.mcpJsonPreviewItem.id
                "
                @click="
                  vm.mcpJsonPreviewItem && void vm.removeProjectLocalMcp(vm.mcpJsonPreviewItem)
                "
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" x2="10" y1="11" y2="17" />
                  <line x1="14" x2="14" y1="11" y2="17" />
                </svg>
                删除
              </button>
              <button
                type="button"
                class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="
                  vm.loadingMcpJsonPreview ||
                  vm.savingMcpJsonPreview ||
                  !vm.mcpJsonPreviewDraft ||
                  !vm.mcpJsonPreviewProvider
                "
                @click="void vm.saveMcpJsonPreview()"
              >
                {{ vm.savingMcpJsonPreview ? '保存中...' : '保存' }}
              </button>
              <button
                type="button"
                aria-label="关闭"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
                @click="vm.closeMcpJsonPreview"
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
            </div>
          </header>
          <div class="space-y-3 px-4 py-4">
            <p v-if="vm.loadingMcpJsonPreview" class="text-sm text-muted-foreground">
              加载配置中...
            </p>
            <div v-else class="space-y-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground"
                  >JSON 配置</label
                >
                <textarea
                  v-model="vm.mcpJsonPreviewDraft"
                  class="min-h-[48vh] w-full rounded-xl border border-border bg-muted/20 p-3 font-mono text-xs text-foreground"
                />
              </div>
            </div>
            <p
              v-if="!vm.loadingMcpJsonPreview && vm.mcpJsonPreviewError"
              class="text-sm text-destructive"
            >
              {{ vm.mcpJsonPreviewError }}
            </p>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>
