<script setup lang="ts">
import AppSelect from '@shared/components/select'
import BusinessLineFormModal from '@pages/business-lines/components/BusinessLineFormModal.vue'
import { ConfirmActionModal } from '@features/business-lines'
import { formatBlmDate as formatDate } from '@features/business-lines/blmProjectDisplayUtils'
import { useBusinessLinesPage } from '@features/business-lines/use-business-lines-page'

defineOptions({
  name: 'BusinessLinesView',
})

const vm = useBusinessLinesPage()
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">组织管理</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">业务线</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        对接业务线 CRUD 与成员管理接口，支持角色变更和移除。
      </p>
      <p v-if="vm.validationMessage" class="text-sm text-destructive">{{ vm.validationMessage }}</p>
    </section>

    <section class="panel-card flex flex-wrap gap-2 p-2">
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="vm.tabClass('lines')"
        type="button"
        @click="vm.activeTab = 'lines'"
      >
        业务线列表
      </button>
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="vm.tabClass('members')"
        type="button"
        @click="vm.activeTab = 'members'"
      >
        业务线成员
      </button>
    </section>

    <section v-if="vm.activeTab === 'lines'" class="panel-card p-5">
      <div class="mb-4 flex items-center justify-between gap-2">
        <div>
          <p class="text-sm font-semibold">业务线列表</p>
          <p class="text-xs text-muted-foreground">管理业务线基础信息，并可跳转成员管理。</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="vm.loadLines()"
          >
            刷新
          </button>
          <button
            v-if="vm.canCreateBusinessLine"
            class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="vm.openCreateLineModal"
          >
            创建业务线
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <div v-if="vm.loadingLines" class="text-sm text-muted-foreground">加载中...</div>

        <button
          v-for="line in vm.lines"
          :key="line.id"
          class="w-full rounded-xl border px-4 py-3 text-left transition"
          :class="
            line.id === vm.selectedLineId
              ? 'border-primary bg-primary/5'
              : 'border-border bg-background/70 hover:bg-background'
          "
          type="button"
          @click="vm.selectedLineId = line.id"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ line.name }}</p>
              <p class="mt-1 text-xs text-muted-foreground">{{ line.description || '暂无描述' }}</p>
              <p class="mt-1 text-[11px] text-muted-foreground">
                更新时间：{{ formatDate(line.updatedAt) }}
              </p>
            </div>
            <div class="flex gap-2">
              <button
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
                type="button"
                @click.stop="vm.openEditLineModal(line)"
              >
                编辑
              </button>
              <button
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
                type="button"
                @click.stop="vm.openMembersTabForLine(line)"
              >
                成员
              </button>
              <button
                v-if="vm.canCreateBusinessLine"
                class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="vm.removingLineId === line.id"
                type="button"
                @click.stop="vm.removeLine(line)"
              >
                {{ vm.removingLineId === line.id ? '删除中...' : '删除' }}
              </button>
            </div>
          </div>
        </button>

        <div
          v-if="!vm.loadingLines && vm.lines.length === 0"
          class="rounded-xl border border-dashed border-border bg-background/40 px-4 py-4 text-sm text-muted-foreground"
        >
          <p>{{ vm.canCreateBusinessLine ? '暂无业务线，请先创建。' : '暂无业务线。' }}</p>
          <button
            v-if="vm.canCreateBusinessLine"
            class="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            type="button"
            @click="vm.openCreateLineModal"
          >
            创建业务线
          </button>
        </div>
      </div>
    </section>

    <section v-else class="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <article class="panel-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <p class="text-sm font-semibold">业务线</p>
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="vm.loadLines()"
          >
            刷新
          </button>
        </div>

        <div class="space-y-2">
          <button
            v-for="line in vm.lines"
            :key="line.id"
            class="w-full rounded-xl border px-3 py-3 text-left transition"
            :class="
              line.id === vm.selectedLineId
                ? 'border-primary bg-primary/5'
                : 'border-border bg-background/70 hover:bg-background'
            "
            type="button"
            @click="vm.selectedLineId = line.id"
          >
            <p class="text-sm font-semibold">{{ line.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ line.description || '暂无描述' }}</p>
          </button>

          <div
            v-if="!vm.loadingLines && vm.lines.length === 0"
            class="rounded-xl border border-dashed border-border bg-background/40 px-3 py-4 text-sm text-muted-foreground"
          >
            <p>{{ vm.canCreateBusinessLine ? '暂无业务线，请先创建。' : '暂无业务线。' }}</p>
            <button
              v-if="vm.canCreateBusinessLine"
              class="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              type="button"
              @click="vm.openCreateLineModal"
            >
              创建业务线
            </button>
          </div>
        </div>
      </article>

      <article class="panel-card p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">业务线成员</p>
            <p class="mt-1 text-xs text-muted-foreground">
              当前：{{ vm.selectedLine?.name ?? '未选择业务线' }}
            </p>
          </div>
          <button
            class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!vm.selectedLine"
            type="button"
            @click="vm.openMemberFormModal"
          >
            添加成员
          </button>
        </div>

        <template v-if="vm.selectedLine">
          <p class="text-xs text-muted-foreground">
            新增成员已迁移为弹窗表单，点击右上角“添加成员”。
          </p>

          <div class="mt-4 overflow-x-auto">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="border-b border-border bg-background/60">
                <tr class="text-xs font-semibold text-muted-foreground">
                  <th class="px-4 py-3">用户</th>
                  <th class="px-4 py-3">角色</th>
                  <th class="px-4 py-3">更新时间</th>
                  <th class="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-if="vm.loadingMembers">
                  <td class="px-4 py-5 text-sm text-muted-foreground" colspan="4">加载成员中...</td>
                </tr>
                <tr
                  v-for="member in vm.members"
                  v-else
                  :key="member.id"
                  class="transition hover:bg-background/70"
                >
                  <td class="px-4 py-4">
                    <p class="font-semibold">{{ vm.displayUserLabel(member.userId) }}</p>
                    <p class="mt-1 font-mono text-xs text-muted-foreground">{{ member.userId }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <AppSelect
                      :model-value="vm.memberRoleDrafts[member.userId] ?? ''"
                      aria-label="成员角色"
                      :block="false"
                      :options="vm.roleOptions"
                      trigger-class="h-9 rounded-lg border-border bg-background px-3 text-sm shadow-none"
                      @update:model-value="vm.memberRoleDrafts[member.userId] = String($event ?? '')"
                    />
                  </td>
                  <td class="px-4 py-4 text-muted-foreground">
                    {{ formatDate(member.updatedAt) }}
                  </td>
                  <td class="px-4 py-4">
                    <div class="flex justify-end gap-2">
                      <button
                        class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="vm.updatingMemberUserId === member.userId"
                        type="button"
                        @click="vm.updateMemberRole(member)"
                      >
                        {{ vm.updatingMemberUserId === member.userId ? '保存中...' : '保存角色' }}
                      </button>
                      <button
                        class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="vm.removingMemberUserId === member.userId"
                        type="button"
                        @click="vm.removeMember(member)"
                      >
                        {{ vm.removingMemberUserId === member.userId ? '移除中...' : '移除' }}
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!vm.loadingMembers && vm.members.length === 0">
                  <td class="px-4 py-5 text-sm text-muted-foreground" colspan="4">
                    暂无成员，请先添加。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <div
          v-else
          class="rounded-xl border border-dashed border-border bg-background/40 px-4 py-6 text-sm text-muted-foreground"
        >
          请先创建业务线后再管理成员。
        </div>
      </article>
    </section>

    <ConfirmActionModal
      :open="vm.lineDeleteModalOpen"
      :confirming="vm.removingLineId === (vm.removingLineTarget?.id ?? '')"
      title="删除业务线"
      :description="`确认删除业务线「${vm.removingLineTarget?.name ?? ''}」吗？`"
      confirm-text="删除"
      @update:open="vm.setLineDeleteModalOpen"
      @confirm="vm.confirmRemoveLine"
    />

    <BusinessLineFormModal
      :open="vm.lineFormModalOpen"
      :mode="vm.lineFormMode"
      :submitting="vm.savingLine"
      :initial-name="vm.lineFormInitialName"
      :initial-description="vm.lineFormInitialDescription"
      @update:open="vm.lineFormModalOpen = $event"
      @submit="vm.submitLineForm"
    />

    <Teleport to="body">
      <div
        v-if="vm.memberFormModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="business-line-member-modal-title"
        @click.self="vm.closeMemberFormModal"
      >
        <section
          class="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="business-line-member-modal-title" class="text-sm font-semibold">添加成员</h2>
            <button
              class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              type="button"
              aria-label="关闭成员弹窗"
              @click="vm.closeMemberFormModal"
            >
              关闭
            </button>
          </header>

          <form class="grid gap-3 px-4 py-4 md:grid-cols-[1fr_160px]" @submit.prevent="vm.addMember">
            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">用户 ID</span>
              <input
                v-model="vm.memberForm.userId"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                list="business-line-user-options"
                placeholder="输入或选择用户 ID"
                type="text"
              />
              <datalist id="business-line-user-options">
                <option v-for="user in vm.users" :key="user.id" :value="user.id">
                  {{ user.nickname?.trim() || user.username }}
                </option>
              </datalist>
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">角色</span>
              <AppSelect
                v-model="vm.memberForm.roleId"
                aria-label="业务线角色"
                :options="vm.roleOptions"
                trigger-class="h-10 rounded-lg border-border bg-background px-3 text-sm shadow-none"
              />
            </label>

            <div class="md:col-span-2 flex justify-end gap-2">
              <button
                class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
                type="button"
                @click="vm.closeMemberFormModal"
              >
                取消
              </button>
              <button
                class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="vm.savingMember"
                type="submit"
              >
                {{ vm.savingMember ? '添加中...' : '添加成员' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
