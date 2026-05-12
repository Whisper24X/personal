<script setup lang="ts">
import type { McpPageContext } from './use-mcp-page'

defineProps<{
  vm: McpPageContext
}>()

const emit = defineEmits<{
  'update:oauthCallbackUrl': [value: string]
}>()

const updateOAuthCallbackUrl = (event: Event) => {
  const target = event.target
  if (target instanceof HTMLTextAreaElement) {
    emit('update:oauthCallbackUrl', target.value)
  }
}

const getAuthorizeButtonLabel = (
  provider: string,
  cli: McpPageContext['oauthProviders'][number]['cliStates'][number],
  vm: McpPageContext,
) => {
  if (vm.authorizingOAuthProviderCli === `${provider}:${cli.cli}`) {
    return '启动中…'
  }

  const cliLabel = vm.getOAuthCliLabel(cli.cli)
  return cli.status === 'connected' ? `重新授权 ${cliLabel}` : `授权 ${cliLabel}`
}
</script>

<template>
  <section class="panel-card p-5">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-semibold">OAuth MCP 授权</p>
        <p class="mt-1 text-xs text-muted-foreground">
          按项目复用 Agent CLI 原生登录凭据。授权完成后浏览器显示 127.0.0.1 无法访问是预期行为。
        </p>
      </div>
      <button
        type="button"
        class="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted/50"
        :disabled="vm.loadingOAuthProviders"
        @click="void vm.loadProjectOAuthProviders()"
      >
        {{ vm.loadingOAuthProviders ? '刷新中…' : '刷新授权状态' }}
      </button>
    </div>

    <div v-if="vm.oauthProviders.length > 0" class="mt-4 grid gap-3 lg:grid-cols-2">
      <article
        v-for="provider in vm.oauthProviders"
        :key="provider.provider"
        class="rounded-xl border border-border bg-background/70 p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ provider.displayName }}</p>
            <p class="mt-1 break-all text-xs text-muted-foreground">
              {{ provider.upstreamMcpUrl }}
            </p>
          </div>
        </div>

        <p v-if="provider.hint" class="mt-3 text-xs text-muted-foreground">
          {{ provider.hint }}
        </p>
        <p v-if="provider.lastError" class="mt-2 text-xs text-destructive">
          {{ provider.lastError }}
        </p>

        <div class="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            v-for="state in provider.cliStates"
            :key="state.cli"
            type="button"
            class="rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            :class="
              state.status === 'connected'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
                : 'border-border bg-background text-foreground hover:bg-muted/50'
            "
            :disabled="vm.authorizingOAuthProviderCli === `${provider.provider}:${state.cli}`"
            @click="void vm.startProjectOAuthLogin(provider, state.cli)"
          >
            {{ getAuthorizeButtonLabel(provider.provider, state, vm) }}
            <span
              class="mt-1 block text-[10px] font-normal"
              :class="
                state.status === 'connected'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-muted-foreground'
              "
            >
              {{
                state.status === 'connected'
                  ? '已连接'
                  : state.status === 'pending'
                    ? '等待中'
                    : '未连接'
              }}
            </span>
          </button>
        </div>
      </article>
    </div>
    <p v-else class="mt-4 text-sm text-muted-foreground">
      {{
        vm.loadingOAuthProviders ? '加载 OAuth MCP provider…' : '暂无可授权的 OAuth MCP provider'
      }}
    </p>

    <div
      v-if="vm.activeOAuthSession"
      class="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4"
    >
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
        :value="vm.oauthCallbackUrl"
        class="mt-3 h-24 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
        placeholder="粘贴 http://127.0.0.1:<port>/callback?code=...&state=..."
        @input="updateOAuthCallbackUrl"
      />
      <button
        type="button"
        class="mt-3 h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="vm.relayingOAuthCallback"
        @click="void vm.relayProjectOAuthCallback()"
      >
        {{ vm.relayingOAuthCallback ? '完成中…' : '完成登录' }}
      </button>
    </div>
  </section>
</template>
