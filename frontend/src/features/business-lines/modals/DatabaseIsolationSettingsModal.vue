<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import {
  createDatabaseIsolationFormState,
  useDatabaseIsolationForm,
} from '@shared/composables/useDatabaseIsolationForm'

defineOptions({
  name: 'DatabaseIsolationSettingsModal',
})

const props = defineProps<{
  open: boolean
  submitting: boolean
  projectId: string
  projectName: string
  initialConfigJson?: Record<string, unknown> | null
  errorMessage?: string
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'submit', payload: { dbIsolationConfigJson: Record<string, unknown> }): void
}>()

const validationMessage = ref('')
const form = reactive(createDatabaseIsolationFormState())

const {
  scannedTables,
  scanningTables,
  syncFromConfigJson,
  buildConfigJson,
  validate,
  scanTables,
  toggleTable,
  selectAllTables,
  clearAllTables,
  selectSmallTables,
  formatSize,
  formatRows,
} = useDatabaseIsolationForm(form)

const syncFormValues = () => {
  syncFromConfigJson((props.initialConfigJson ?? {}) as Record<string, unknown>)
  validationMessage.value = ''
}

const close = () => {
  emit('update:open', false)
}

const handleScanTables = () => {
  if (!props.projectId) return
  return scanTables(props.projectId)
}

const submit = () => {
  const msg = validate()
  if (msg) {
    validationMessage.value = msg
    return
  }

  validationMessage.value = ''
  emit('submit', {
    dbIsolationConfigJson: buildConfigJson(
      (props.initialConfigJson ?? {}) as Record<string, unknown>,
    ),
  })
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      syncFormValues()
    }
  },
)

watch(
  () => [props.initialConfigJson, props.projectName],
  () => {
    if (props.open) {
      syncFormValues()
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭数据库隔离设置弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        aria-modal="true"
        role="dialog"
        class="relative z-10 flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <div class="min-w-0">
            <h2 class="text-sm font-semibold">数据库隔离设置</h2>
            <p class="mt-1 truncate text-xs text-muted-foreground">
              {{ props.projectName || '未命名项目' }}
            </p>
          </div>
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

        <form
          class="grid max-h-[calc(95vh-56px)] gap-3 overflow-y-auto px-4 py-4 md:grid-cols-2"
          @submit.prevent="submit"
        >
          <div class="md:col-span-2 rounded-xl border border-border bg-background/60 p-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-semibold text-muted-foreground">启用数据库隔离</p>
                <p class="mt-1 text-[11px] text-muted-foreground">
                  为每个任务创建独立数据库，避免共享环境下的数据污染。
                </p>
              </div>
              <label class="relative inline-flex cursor-pointer items-center">
                <input
                  v-model="form.dbIsolationEnabled"
                  type="checkbox"
                  class="peer sr-only"
                />
                <div
                  class="h-5 w-9 rounded-full bg-muted transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-background after:transition-transform after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-4"
                />
              </label>
            </div>
          </div>

          <template v-if="form.dbIsolationEnabled">
            <label class="block space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">数据库地址</span>
              <input
                v-model="form.dbIsolationHost"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="10.8.8.110"
                type="text"
              />
            </label>

            <label class="block space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">端口</span>
              <input
                v-model="form.dbIsolationPort"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="5432"
                type="number"
              />
            </label>

            <label class="block space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">管理员账号</span>
              <input
                v-model="form.dbIsolationAdminUser"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="postgres"
                type="text"
              />
            </label>

            <label class="block space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">管理员密码</span>
              <input
                v-model="form.dbIsolationAdminPassword"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="••••••"
                type="password"
              />
            </label>

            <label class="block space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">基准数据库名</span>
              <input
                v-model="form.dbIsolationSourceDatabase"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="yanxue"
                type="text"
              />
            </label>

            <label class="block space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">环境变量名</span>
              <input
                v-model="form.dbIsolationEnvVar"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="YC_PG_YANXUE_DB"
                type="text"
              />
              <p class="text-[11px] text-muted-foreground">
                任务创建时平台自动注入此变量，值为 task_{taskId}_{基准库名}。项目 YAML 中需使用
                <code class="rounded bg-muted px-1 py-0.5">${VAR:default}</code> 语法读取。
              </p>
            </label>

            <div class="md:col-span-2 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-muted-foreground">数据导入</span>
                <button
                  class="h-8 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  :disabled="scanningTables"
                  @click="handleScanTables"
                >
                  {{ scanningTables ? '扫描中...' : '扫描表' }}
                </button>
              </div>

              <div
                v-if="scannedTables.length > 0"
                class="max-h-[200px] overflow-auto rounded-lg border border-border"
              >
                <table class="w-full text-xs">
                  <thead class="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr class="border-b border-border">
                      <th class="w-8 px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          class="h-3.5 w-3.5 rounded border-border accent-primary"
                          :checked="scannedTables.length > 0 && form.dbIsolationSelectedTables.length === scannedTables.length"
                          :indeterminate="form.dbIsolationSelectedTables.length > 0 && form.dbIsolationSelectedTables.length < scannedTables.length"
                          @change="form.dbIsolationSelectedTables.length === scannedTables.length ? clearAllTables() : selectAllTables()"
                        />
                      </th>
                      <th class="px-3 py-2 text-left font-semibold text-muted-foreground">表名</th>
                      <th class="px-3 py-2 text-right font-semibold text-muted-foreground">行数</th>
                      <th class="px-3 py-2 text-right font-semibold text-muted-foreground">大小</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="table in scannedTables"
                      :key="table.name"
                      class="border-b border-border/50 transition hover:bg-muted/30"
                    >
                      <td class="px-3 py-1.5">
                        <input
                          type="checkbox"
                          class="h-3.5 w-3.5 rounded border-border accent-primary"
                          :checked="form.dbIsolationSelectedTables.includes(table.name)"
                          @change="toggleTable(table.name)"
                        />
                      </td>
                      <td class="px-3 py-1.5 font-mono text-foreground">{{ table.name }}</td>
                      <td class="px-3 py-1.5 text-right text-muted-foreground">
                        {{ formatRows(table.estimatedRows) }}
                      </td>
                      <td class="px-3 py-1.5 text-right text-muted-foreground">
                        {{ formatSize(table.sizeBytes) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                v-if="scannedTables.length > 0"
                class="flex items-center justify-between text-[11px] text-muted-foreground"
              >
                <span>已选 {{ form.dbIsolationSelectedTables.length }} 张表</span>
                <div class="flex gap-2">
                  <button type="button" class="underline-offset-2 hover:underline" @click="selectAllTables">全选</button>
                  <button type="button" class="underline-offset-2 hover:underline" @click="clearAllTables">清空</button>
                  <button type="button" class="underline-offset-2 hover:underline" @click="selectSmallTables(1000)">只选小表</button>
                </div>
              </div>
            </div>
          </template>

          <p v-if="validationMessage" class="text-sm text-destructive md:col-span-2">
            {{ validationMessage }}
          </p>
          <p v-else-if="props.errorMessage" class="text-sm text-destructive md:col-span-2">
            {{ props.errorMessage }}
          </p>

          <div class="flex justify-end gap-2 pt-1 md:col-span-2">
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
              {{ props.submitting ? '保存中...' : '保存设置' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
