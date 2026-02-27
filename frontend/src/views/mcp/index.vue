<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useMessage } from '@/hooks'
import { mcpsApi } from '@/api/mcps'
import type { CreateMcpPayload, Mcp, UpdateMcpPayload } from '@/types/api/mcps'
import { toErrorMessage } from '@/utils/http/to-error-message'

const PAGE_LIMIT = 30

const loading = ref(false)
const loadingMore = ref(false)
const submitting = ref(false)
const deletingMcpId = ref('')
const editingMcpId = ref('')
const validationMessage = ref('')
const keyword = ref('')
const enabledOnly = ref(false)
const message = useMessage()

const mcps = ref<Mcp[]>([])
const page = ref(1)
const hasNextPage = ref(false)

const form = reactive({
  name: '',
  version: '',
  description: '',
  provider: '',
  toolsCount: 0,
  enabled: true,
  configSchemaText: '',
  metadataJsonText: '',
})

const normalizeOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

const normalizeOptionalObject = (value: string) => {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return undefined
  }

  try {
    const parsed = JSON.parse(trimmedValue) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    void error
    return null
  }
}

const resetForm = () => {
  editingMcpId.value = ''
  form.name = ''
  form.version = ''
  form.description = ''
  form.provider = ''
  form.toolsCount = 0
  form.enabled = true
  form.configSchemaText = ''
  form.metadataJsonText = ''
}

const startEdit = (mcp: Mcp) => {
  editingMcpId.value = mcp.id
  form.name = mcp.name
  form.version = mcp.version
  form.description = mcp.description ?? ''
  form.provider = mcp.provider ?? ''
  form.toolsCount = mcp.toolsCount
  form.enabled = mcp.enabled
  form.configSchemaText = mcp.configSchema ? JSON.stringify(mcp.configSchema, null, 2) : ''
  form.metadataJsonText = mcp.metadataJson ? JSON.stringify(mcp.metadataJson, null, 2) : ''
}

const loadMcps = async (reset = true) => {
  const nextPage = reset ? 1 : page.value + 1

  if (reset) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const response = await mcpsApi.list({
      page: nextPage,
      limit: PAGE_LIMIT,
      keyword: keyword.value.trim() || undefined,
      enabled: enabledOnly.value ? true : undefined,
    })

    if (reset) {
      mcps.value = response.data
    } else {
      const existingIds = new Set(mcps.value.map((item) => item.id))
      mcps.value = mcps.value.concat(
        response.data.filter((item) => !existingIds.has(item.id)),
      )
    }

    page.value = nextPage
    hasNextPage.value = response.hasNextPage
  } catch (error) {
    message.error(toErrorMessage(error, '加载 MCP 列表失败'))
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const submitMcp = async () => {
  if (!form.name.trim() || !form.version.trim()) {
    validationMessage.value = '名称和版本不能为空'
    return
  }

  const configSchema = normalizeOptionalObject(form.configSchemaText)
  if (configSchema === null) {
    validationMessage.value = 'configSchema 必须是合法 JSON 对象'
    return
  }

  const metadataJson = normalizeOptionalObject(form.metadataJsonText)
  if (metadataJson === null) {
    validationMessage.value = 'metadataJson 必须是合法 JSON 对象'
    return
  }

  submitting.value = true
  validationMessage.value = ''

  const payloadBase = {
    name: form.name.trim(),
    version: form.version.trim(),
    description: normalizeOptionalText(form.description),
    provider: normalizeOptionalText(form.provider),
    toolsCount: Math.max(0, Number(form.toolsCount) || 0),
    configSchema,
    metadataJson,
    enabled: form.enabled,
  }

  try {
    if (editingMcpId.value) {
      const updatePayload: UpdateMcpPayload = payloadBase
      await mcpsApi.update(editingMcpId.value, updatePayload)
      message.success('保存 MCP 成功')
    } else {
      const createPayload: CreateMcpPayload = payloadBase
      await mcpsApi.create(createPayload)
      message.success('创建 MCP 成功')
    }

    resetForm()
    await loadMcps(true)
  } catch (error) {
    message.error(toErrorMessage(error, '保存 MCP 失败'))
  } finally {
    submitting.value = false
  }
}

const toggleMcpEnabled = async (mcp: Mcp) => {
  try {
    await mcpsApi.update(mcp.id, {
      enabled: !mcp.enabled,
    })
    await loadMcps(true)
    message.success('更新 MCP 状态成功')
  } catch (error) {
    message.error(toErrorMessage(error, '更新 MCP 状态失败'))
  }
}

const removeMcp = async (mcp: Mcp) => {
  if (!window.confirm(`确认删除 MCP「${mcp.name}」吗？`)) {
    return
  }

  deletingMcpId.value = mcp.id

  try {
    await mcpsApi.remove(mcp.id)
    await loadMcps(true)
    message.success('删除 MCP 成功')
  } catch (error) {
    message.error(toErrorMessage(error, '删除 MCP 失败'))
  } finally {
    deletingMcpId.value = ''
  }
}

onMounted(() => {
  void loadMcps(true)
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MCP</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">MCP 市场与管理</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        支持 MCP 连接器的浏览、搜索、新增、编辑、启停与删除。
      </p>
      <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
    </section>

    <section class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-1 flex-wrap items-center gap-2">
          <input
            v-model="keyword"
            class="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 版本 / 提供方"
            type="search"
          />
          <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input v-model="enabledOnly" class="h-4 w-4" type="checkbox" />
            仅显示启用
          </label>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="loadMcps(true)"
          >
            刷新
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="loadMcps(true)"
          >
            搜索
          </button>
        </div>
      </div>
    </section>

    <section class="panel-card p-5">
      <div class="mb-4 flex items-center justify-between">
        <p class="text-sm font-semibold">{{ editingMcpId ? '编辑 MCP' : '新增 MCP' }}</p>
        <button
          v-if="editingMcpId"
          class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
          type="button"
          @click="resetForm"
        >
          取消编辑
        </button>
      </div>

      <form class="grid gap-3 md:grid-cols-2" @submit.prevent="submitMcp">
        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">名称</span>
          <input
            v-model="form.name"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="例如：filesystem"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">版本</span>
          <input
            v-model="form.version"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="例如：1.0.0"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">提供方（可选）</span>
          <input
            v-model="form.provider"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="例如：internal"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">工具数量</span>
          <input
            v-model.number="form.toolsCount"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            min="0"
            type="number"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">描述（可选）</span>
          <input
            v-model="form.description"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            type="text"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">configSchema（可选，JSON 对象）</span>
          <textarea
            v-model="form.configSchemaText"
            class="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
            placeholder="{&quot;type&quot;:&quot;object&quot;}"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">metadataJson（可选，JSON 对象）</span>
          <textarea
            v-model="form.metadataJsonText"
            class="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
            placeholder="{&quot;maintainer&quot;:&quot;platform&quot;}"
          />
        </label>

        <label class="inline-flex items-center gap-2 text-sm md:col-span-2">
          <input v-model="form.enabled" class="h-4 w-4" type="checkbox" />
          启用
        </label>

        <div class="md:col-span-2 flex justify-end">
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="submitting"
            type="submit"
          >
            {{ submitting ? '保存中...' : editingMcpId ? '保存修改' : '创建 MCP' }}
          </button>
        </div>
      </form>
    </section>

    <section v-if="loading" class="panel-card p-6 text-sm text-muted-foreground">加载中...</section>

    <section v-else class="panel-card p-5">
      <div class="space-y-3">
        <article
          v-for="server in mcps"
          :key="server.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/70 px-4 py-3"
        >
          <div>
            <p class="text-sm font-semibold">{{ server.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">
              版本：{{ server.version }} · 提供方：{{ server.provider ?? '-' }} · 工具数量：{{ server.toolsCount }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">{{ server.description ?? '暂无描述' }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="rounded-full px-2 py-1 text-[10px] font-semibold"
              :class="server.enabled ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
            >
              {{ server.enabled ? '已启用' : '已停用' }}
            </span>
            <button
              class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="startEdit(server)"
            >
              编辑
            </button>
            <button
              class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="toggleMcpEnabled(server)"
            >
              {{ server.enabled ? '停用' : '启用' }}
            </button>
            <button
              class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="deletingMcpId === server.id"
              type="button"
              @click="removeMcp(server)"
            >
              {{ deletingMcpId === server.id ? '删除中...' : '删除' }}
            </button>
          </div>
        </article>

        <article v-if="mcps.length === 0" class="rounded-xl border border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground">
          没有匹配的 MCP 连接器。
        </article>
      </div>
    </section>

    <section v-if="!loading && hasNextPage" class="panel-card p-4">
      <button
        class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loadingMore"
        type="button"
        @click="loadMcps(false)"
      >
        {{ loadingMore ? '加载中...' : '加载更多' }}
      </button>
    </section>
  </div>
</template>
