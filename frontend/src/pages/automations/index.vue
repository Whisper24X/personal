<script setup lang="ts">
import AppSelect from '@shared/components/select'
import { ConfirmActionModal } from '@features/business-lines'
import { useAutomationsPage } from './use-automations-page'

defineOptions({
  name: 'AutomationsView',
})

const vm = useAutomationsPage()
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="panel-card overflow-hidden">
      <div class="space-y-4 border-b border-border px-5 py-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-1">
            <h1 class="text-2xl font-semibold tracking-tight">自动化计划</h1>
            <p class="text-xs text-muted-foreground">
              共 {{ vm.totalAutomationCount }} 条，运行中 {{ vm.activeAutomationCount }} 条，已暂停 {{ vm.pausedAutomationCount }} 条
            </p>
          </div>

          <button
            v-if="vm.canManageAutomations"
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            :disabled="!vm.hasProjectId"
            type="button"
            @click="vm.openCreateAutomationModal"
          >
            新增计划
          </button>
        </div>

        <form class="flex flex-col gap-3 xl:flex-row xl:items-center" @submit.prevent="vm.loadAutomations(true)">
          <input
            v-model="vm.automationKeyword"
            class="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 执行提示"
            type="search"
          />

          <AppSelect
            v-model="vm.automationStatusFilter"
            aria-label="计划状态筛选"
            :block="false"
            :options="[...vm.AUTOMATION_STATUS_FILTER_OPTIONS]"
            wrapper-class="xl:w-40"
            trigger-class="h-10 rounded-lg border-border bg-background px-3 text-sm shadow-none"
          />

          <div class="flex flex-wrap items-center gap-2">
            <button
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="vm.resetFilters"
            >
              重置
            </button>
            <button
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
              type="submit"
            >
              搜索
            </button>
          </div>
        </form>

        <p v-if="vm.validationMessage" class="text-sm text-destructive">{{ vm.validationMessage }}</p>
      </div>

      <div v-if="vm.automationLoading" class="p-6 text-sm text-muted-foreground">加载中...</div>

      <div
        v-else-if="!vm.hasProjectId"
        class="p-6 text-center text-sm text-muted-foreground"
      >
        当前 URL 缺少 projectId，请先在侧栏选择项目，或通过 `?projectId=&lt;uuid&gt;` 访问。
      </div>

      <div
        v-else-if="vm.automations.length === 0"
        class="p-6 text-center text-sm text-muted-foreground"
      >
        当前筛选条件下暂无自动化计划。
      </div>

      <div v-else class="space-y-3 p-4">
        <article
          v-for="automation in vm.automations"
          :key="automation.id"
          class="rounded-2xl border border-border bg-background/60 p-4"
        >
          <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-sm font-semibold text-foreground md:text-base">{{ automation.name }}</h2>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  :class="vm.automationStatusClassMap[automation.status]"
                >
                  {{ vm.automationStatusLabelMap[automation.status] }}
                </span>
              </div>

              <p class="text-sm leading-6 text-muted-foreground break-words">
                {{ automation.prompt }}
              </p>

              <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span class="rounded-lg border border-border bg-background px-2.5 py-1">
                  RRULE: {{ automation.rrule }}
                </span>
                <span class="rounded-lg border border-border bg-background px-2.5 py-1">
                  工作目录: {{ vm.formatCwds(automation.cwds) }}
                </span>
                <span class="rounded-lg border border-border bg-background px-2.5 py-1">
                  最近执行: {{ vm.formatDate(automation.lastRunAt ?? undefined) }}
                </span>
                <span class="rounded-lg border border-border bg-background px-2.5 py-1">
                  下次执行: {{ vm.formatDate(automation.nextRunAt ?? undefined) }}
                </span>
              </div>
            </div>

            <div v-if="vm.canManageAutomations" class="flex shrink-0 flex-wrap gap-2 xl:justify-end">
              <button
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
                type="button"
                @click="vm.startEditAutomation(automation)"
              >
                编辑
              </button>
              <button
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
                type="button"
                @click="vm.toggleAutomationStatus(automation)"
              >
                {{ automation.status === 'active' ? '暂停' : '启用' }}
              </button>
              <button
                class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="vm.automationDeletingId === automation.id"
                type="button"
                @click="vm.removeAutomation(automation)"
              >
                {{ vm.automationDeletingId === automation.id ? '删除中...' : '删除' }}
              </button>
            </div>
          </div>
        </article>
      </div>

      <div v-if="!vm.automationLoading && vm.automationHasNextPage" class="border-t border-border px-5 py-4">
        <button
          class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="vm.automationLoadingMore"
          type="button"
          @click="vm.loadAutomations(false)"
        >
          {{ vm.automationLoadingMore ? '加载中...' : '加载更多计划' }}
        </button>
      </div>
    </section>

    <ConfirmActionModal
      :open="vm.automationDeleteModalOpen"
      :confirming="vm.automationDeletingId === (vm.deletingAutomationTarget?.id ?? '')"
      title="删除自动化计划"
      :description="`确认删除自动化「${vm.deletingAutomationTarget?.name ?? ''}」吗？`"
      confirm-text="删除"
      @update:open="vm.setAutomationDeleteModalOpen"
      @confirm="vm.confirmRemoveAutomation"
    />

    <Teleport to="body">
      <div v-if="vm.automationFormModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="关闭自动化计划弹窗"
          class="absolute inset-0 bg-black/30 backdrop-blur-sm"
          @click="vm.closeAutomationFormModal"
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="automation-form-modal-title"
          class="relative z-10 w-full max-w-3xl overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl"
          tabindex="-1"
          @keydown.esc.prevent="vm.closeAutomationFormModal"
        >
          <div class="max-h-[calc(100vh-2rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-2">
                <h2 id="automation-form-modal-title" class="text-[2rem] font-semibold tracking-tight text-foreground">
                  {{ vm.automationModalTitle }}
                </h2>
                <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
                  自动在后台执行计划任务，当前版本沿用现有后端契约。
                </p>
              </div>

              <button
                type="button"
                aria-label="关闭"
                class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-base text-foreground/70 transition hover:bg-muted hover:text-foreground"
                @click="vm.closeAutomationFormModal"
              >
                ×
              </button>
            </div>

            <form class="mt-6 space-y-6" @submit.prevent="vm.submitAutomation">
              <section class="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
                <div class="flex gap-3">
                  <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-background text-xs font-semibold text-primary">
                    i
                  </span>
                  <div class="space-y-1 text-sm text-foreground/85">
                    <p>自动化会在后台按计划执行，并将结果写回当前系统。</p>
                    <p class="text-muted-foreground">
                      你可以填写名称、执行提示和执行计划；调度会自动转换成 RRULE 提交到现有接口。
                    </p>
                  </div>
                </div>
              </section>

              <label class="block space-y-2">
                <span class="text-sm font-semibold text-foreground">名称</span>
                <input
                  v-model="vm.automationForm.name"
                  class="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  :disabled="!vm.canManageAutomations"
                  placeholder="例如：检查 Sentry 异常"
                  type="text"
                />
              </label>
              <label class="block space-y-2">
                <span class="text-sm font-semibold text-foreground">执行提示</span>
                <textarea
                  v-model="vm.automationForm.prompt"
                  class="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  :disabled="!vm.canManageAutomations"
                  placeholder="例如：检查 Sentry 中的新崩溃"
                />
              </label>

              <section class="space-y-3">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span class="text-sm font-semibold text-foreground">执行计划</span>
                  <div class="inline-flex w-fit rounded-full bg-muted p-1">
                    <button
                      class="rounded-full px-4 py-1.5 text-sm font-medium transition"
                      :class="vm.automationScheduleMode === 'daily'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground'"
                      type="button"
                      @click="vm.automationScheduleMode = 'daily'"
                    >
                      按天
                    </button>
                    <button
                      class="rounded-full px-4 py-1.5 text-sm font-medium transition"
                      :class="vm.automationScheduleMode === 'interval'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground'"
                      type="button"
                      @click="vm.automationScheduleMode = 'interval'"
                    >
                      间隔
                    </button>
                  </div>
                </div>

                <div v-if="vm.automationScheduleMode === 'daily'" class="grid gap-3 lg:grid-cols-[200px_1fr] lg:items-start">
                  <input
                    v-model="vm.automationScheduleTime"
                    class="h-11 rounded-2xl border border-border bg-background px-4 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    :disabled="!vm.canManageAutomations"
                    type="time"
                  />

                  <div class="space-y-3">
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="day in vm.AUTOMATION_WEEKDAY_OPTIONS"
                        :key="day.value"
                        class="inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold transition"
                        :class="vm.automationScheduleDays.includes(day.value)
                          ? 'bg-foreground text-background'
                          : 'border border-border bg-background text-muted-foreground hover:text-foreground'"
                        :disabled="!vm.canManageAutomations"
                        type="button"
                        @click="vm.toggleAutomationScheduleDay(day.value)"
                      >
                        {{ day.label }}
                      </button>
                    </div>

                    <p class="rounded-2xl border border-border bg-background/70 px-4 py-3 text-xs leading-6 text-muted-foreground">
                      <template v-if="vm.automationScheduleDays.length > 0">
                        RRULE: <span class="font-mono text-foreground">{{ vm.resolvedAutomationRrule }}</span>
                      </template>
                      <template v-else>
                        至少选择一个执行日期。
                      </template>
                    </p>
                  </div>
                </div>

                <div v-else class="space-y-2">
                  <input
                    v-model="vm.automationIntervalRrule"
                    class="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    :disabled="!vm.canManageAutomations"
                    placeholder="FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0"
                    type="text"
                  />
                  <p class="text-sm text-muted-foreground">高级模式直接填写 RRULE，适合每 N 小时或更复杂的执行周期。</p>
                </div>
              </section>

              <p v-if="vm.validationMessage" class="text-sm text-destructive">{{ vm.validationMessage }}</p>

              <div class="flex items-center justify-end gap-3 pt-2">
                <button
                  class="h-11 rounded-2xl px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                  type="button"
                  @click="vm.closeAutomationFormModal"
                >
                  取消
                </button>
                <button
                  class="h-11 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="vm.automationSubmitting || !vm.canManageAutomations"
                  type="submit"
                >
                  {{ vm.automationModalSubmitLabel }}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>
