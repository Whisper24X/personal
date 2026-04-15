<script setup lang="ts">
import { SkillUploadModal } from '@features/business-lines'
import SkillTree from '@features/skills/SkillTree.vue'
import { useSkillsPage } from './use-skills-page'

defineOptions({
  name: 'SkillsManagementView',
})

const vm = useSkillsPage()
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-1 flex-wrap items-center gap-2">
          <input
            v-model="vm.keyword"
            class="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 版本 / 说明"
            type="search"
            @keydown.enter.prevent="vm.loadSkills"
          />
        </div>

        <div class="flex items-center gap-2">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="vm.loadSkills"
          >
            刷新
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="vm.loadSkills"
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
              添加技能
            </button>

            <div
              v-if="vm.addMenuOpen"
              class="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-border bg-background p-1 shadow-lg"
            >
              <button
                type="button"
                class="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="vm.openCopySkillModal"
              >
                从业务线复制
              </button>
              <button
                type="button"
                class="mt-1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="vm.openUploadSkillModal"
              >
                上传技能包
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="!vm.activeProjectId"
      class="panel-card p-6 text-sm text-muted-foreground"
    >
      请先在左侧选择项目后再查看 Skill。
    </section>

    <section v-else-if="vm.loading" class="panel-card p-6 text-sm text-muted-foreground">加载中...</section>

    <section v-else class="space-y-4">
      <article
        v-if="vm.groupedSkills.length === 0"
        class="panel-card p-6 text-sm text-muted-foreground"
      >
        当前项目没有可读取的 Skill 本地配置。
      </article>

      <article
        v-for="group in vm.groupedSkills"
        :key="group.id"
        class="panel-card p-4"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold">{{ group.label }}</p>
          <span class="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
            {{ group.items.length }} 项
          </span>
        </div>

        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="item in group.items"
            :key="item.id"
            role="button"
            class="cursor-pointer rounded-xl border border-border bg-background/70 px-4 py-3 transition-colors hover:border-foreground/20"
            tabindex="0"
            @click="vm.openSkillDetail(item)"
            @keydown.enter.prevent="vm.openSkillDetail(item)"
            @keydown.space.prevent="vm.openSkillDetail(item)"
          >
            <div>
              <p class="text-sm font-semibold">{{ item.name }}</p>
              <p class="mt-1 text-xs text-muted-foreground">版本：{{ item.version }}</p>
            </div>

            <p class="mt-3 text-xs text-muted-foreground">{{ item.description ?? '暂无描述' }}</p>
          </article>
        </div>
      </article>
    </section>

    <Teleport to="body">
      <div
        v-if="vm.copySkillModalOpen"
        class="fixed inset-0 z-[121] flex items-center justify-center p-3 sm:p-6"
        @keydown.esc.prevent.stop="vm.closeCopySkillModal"
      >
        <button
          type="button"
          aria-label="关闭复制技能弹窗"
          class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          @click="vm.closeCopySkillModal"
        />

        <section
          aria-modal="true"
          role="dialog"
          class="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-background shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 class="text-base font-semibold">从业务线复制技能</h2>
            <button
              type="button"
              aria-label="关闭"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
              @click="vm.closeCopySkillModal"
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
                    @click="vm.selectAllCopySkillProviders"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    class="text-xs text-muted-foreground underline hover:text-foreground"
                    @click="vm.clearAllCopySkillProviders"
                  >
                    取消全选
                  </button>
                </div>
              </div>
              <div class="flex flex-wrap gap-x-4 gap-y-2">
                <label
                  v-for="p in vm.PROJECT_SKILL_PROVIDER_ORDER"
                  :key="p"
                  class="flex cursor-pointer items-center gap-2"
                >
                  <input
                    v-model="vm.copySkillTargetProviders"
                    type="checkbox"
                    :value="p"
                    class="h-4 w-4 rounded border-border"
                  />
                  <span class="text-sm">{{ vm.PROJECT_SKILL_PROVIDER_LABELS[p] ?? p }}</span>
                </label>
              </div>
            </div>

            <input
              v-model="vm.copySkillKeyword"
              type="search"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="搜索业务线技能"
            />

            <p v-if="vm.loadingBusinessLineSkills" class="mt-3 text-sm text-muted-foreground">
              加载中...
            </p>
            <p v-else-if="vm.copySkillErrorMessage" class="mt-3 text-sm text-destructive">
              {{ vm.copySkillErrorMessage }}
            </p>

            <div v-else class="mt-3 space-y-2">
              <article
                v-for="item in vm.filteredBusinessLineSkills"
                :key="item.id"
                class="rounded-xl border border-border bg-background/70 px-4 py-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold">{{ item.name }}</p>
                    <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {{ item.description ?? '暂无描述' }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="h-8 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                      @click="vm.openBusinessLineSkillDetail(item)"
                    >
                      查看
                    </button>
                    <button
                      type="button"
                      class="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="vm.copyingBusinessLineSkillId === item.id"
                      @click="vm.submitCopyBusinessLineSkill(item.id)"
                    >
                      {{ vm.copyingBusinessLineSkillId === item.id ? '复制中...' : '复制' }}
                    </button>
                  </div>
                </div>
              </article>

              <article
                v-if="vm.filteredBusinessLineSkills.length === 0"
                class="rounded-xl border border-dashed border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground"
              >
                当前业务线暂无可复制的技能。
              </article>
            </div>
          </div>
        </section>
      </div>

      <div
        v-if="vm.detailSkill"
        class="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6"
        @keydown.esc.prevent.stop="vm.closeSkillDetail"
      >
        <button
          type="button"
          aria-label="关闭 Skill 详情弹窗"
          class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          @click="vm.closeSkillDetail"
        />

        <section
          aria-modal="true"
          role="dialog"
          class="relative z-10 flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-background shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <div class="min-w-0 flex-1">
              <h2 class="text-base font-semibold">{{ vm.detailSkill.name }}</h2>
              <p class="truncate text-xs text-muted-foreground">
                {{ vm.detailSelectedPath || '技能目录' }}
              </p>
            </div>
            <div class="ml-4 flex shrink-0 items-center gap-2">
              <button
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-md border border-primary/60 bg-primary/5 px-3 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="vm.detailLoading || vm.downloadingSkillId === vm.detailSkill.id"
                @click="void vm.downloadProjectSkill(vm.detailSkill)"
              >
                {{ vm.downloadingSkillId === vm.detailSkill.id ? '下载中...' : '下载' }}
              </button>
              <button
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-md border border-destructive/60 bg-destructive/5 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="删除技能"
                :disabled="vm.detailLoading || vm.removingSkillId === vm.detailSkill.id"
                @click="void vm.removeProjectSkill(vm.detailSkill)"
              >
                {{ vm.removingSkillId === vm.detailSkill.id ? '删除中...' : '删除' }}
              </button>
              <a
                v-if="vm.detailSkill.homepageUrl"
                :href="vm.detailSkill.homepageUrl"
                class="inline-flex text-xs font-semibold text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                查看说明
              </a>
              <button
                type="button"
                aria-label="关闭"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
                @click="vm.closeSkillDetail"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
          </header>

          <div v-if="vm.detailLoading" class="flex min-h-0 flex-1 px-4 py-6 text-sm text-muted-foreground">加载中...</div>
          <p v-else-if="vm.detailErrorMessage" class="flex min-h-0 flex-1 px-4 py-6 text-sm text-destructive">{{ vm.detailErrorMessage }}</p>

          <div v-else class="flex min-h-0 flex-1">
            <aside class="w-56 flex-shrink-0 overflow-y-auto border-r border-border px-2 py-3">
              <SkillTree
                :nodes="vm.detailTree"
                :selected-path="vm.detailSelectedPath"
                :expanded-dirs="vm.detailExpandedDirs"
                @select-file="vm.loadDetailFile($event)"
                @toggle-dir="vm.toggleDetailDir($event)"
              />

              <p v-if="vm.detailTree.length === 0" class="px-2 py-2 text-xs text-muted-foreground">
                无文件
              </p>
            </aside>

            <div class="min-w-0 flex-1 overflow-y-auto px-4 py-3">
              <p v-if="vm.detailFileLoading" class="text-sm text-muted-foreground">加载中...</p>
              <p v-else-if="!vm.detailSelectedPath" class="text-sm text-muted-foreground">
                请在左侧选择一个文件查看内容。
              </p>
              <pre
                v-else
                class="max-h-[62vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground"
              >{{ vm.detailContent || '文件内容为空。' }}</pre>
            </div>
          </div>

          <footer class="border-t border-border px-4 py-3">
            <button
              type="button"
              class="h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
              @click="vm.closeSkillDetail"
            >
              关闭
            </button>
          </footer>
        </section>
      </div>
    </Teleport>

    <SkillUploadModal
      :open="vm.uploadSkillModalOpen"
      :submitting="vm.uploadingProjectSkill"
      :error-message="vm.uploadSkillErrorMessage"
      @update:open="vm.uploadSkillModalOpen = $event"
      @submit="vm.submitUploadProjectSkill"
    />
  </div>
</template>
