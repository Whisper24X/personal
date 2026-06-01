<script setup lang="ts">
import { RouterLink } from 'vue-router'
import FileTree from '@shared/components/file-browser/FileTree.vue'
import FilePreviewCard from '@shared/components/file-browser/FilePreviewCard.vue'
import { MarkdownPreview } from '@features/knowledge-base'
import { useKnowledgeBasePage } from './use-knowledge-base-page'

defineOptions({
  name: 'KnowledgeBaseView',
})

const vm = useKnowledgeBasePage()
</script>

<template>
  <div class="min-h-full space-y-4 px-4 py-4 md:px-6 md:py-5 xl:px-8 fade-up">
    <section v-if="!vm.hasProjectId" class="flex-shrink-0 panel-card p-5">
      <p class="text-sm font-semibold">未选择项目</p>
      <p class="mt-2 text-sm text-muted-foreground">请先在左侧选择项目，再进入知识库页面进行配置。</p>
    </section>

    <template v-else>
      <section v-if="vm.loading" class="flex-shrink-0 panel-card p-5">
        <p class="text-sm text-muted-foreground">加载中...</p>
      </section>

      <template v-else-if="vm.project">
        <section class="grid grid-cols-1 gap-4 xl:items-start xl:grid-cols-[22rem_1fr]">
          <article class="panel-card flex min-h-[780px] flex-col overflow-auto p-4">
            <div class="flex-shrink-0 space-y-1">
              <p class="text-sm font-semibold">{{ vm.project.name }}</p>
              <p class="text-xs text-muted-foreground">
                <span class="font-mono">{{ vm.project.id }}</span>
                <span class="mx-2">•</span>
                <RouterLink
                  :to="{ path: '/dashboard', query: { projectId: vm.project.id } }"
                  class="hover:text-foreground hover:underline"
                >
                  项目工作台
                </RouterLink>
              </p>
            </div>

            <div class="mt-3 flex-shrink-0 grid grid-cols-2 gap-2">
              <button
                class="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-md"
                type="button"
                @click="vm.openCreateModal"
              >
                新建文档
              </button>
              <button
                class="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="vm.docsLoading"
                type="button"
                @click="vm.loadDocsRoot"
              >
                {{ vm.docsLoading ? '刷新中' : '刷新列表' }}
              </button>
            </div>

            <div
              class="mt-3 flex-shrink-0 rounded-xl border border-dashed p-3 transition"
              :class="vm.dragActive ? 'border-primary bg-primary/5' : 'border-border bg-background/40'"
              @dragover="vm.onDropAreaDragOver"
              @dragleave="vm.onDropAreaDragLeave"
              @drop="vm.onDropAreaDrop"
            >
              <p class="text-xs text-muted-foreground">拖拽文件到这里上传到 docs，或使用按钮选择文件。</p>
              <button
                class="mt-2 h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="vm.uploading"
                type="button"
                @click="vm.onChooseFiles"
              >
                {{ vm.uploading ? '上传中...' : '选择文件上传' }}
              </button>
              <input
                ref="vm.fileInputRef"
                class="hidden"
                type="file"
                multiple
                @change="vm.onFileInputChange"
              />
            </div>

            <div class="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background/50 p-2">
              <div class="min-h-0 flex-1 overflow-auto pr-1 text-xs">
                <div v-if="vm.treeNodes.length === 0 && !vm.docsLoading" class="px-2 py-6 text-muted-foreground">
                  暂无文档
                </div>
                <FileTree
                  v-else-if="vm.treeNodes.length > 0"
                  :nodes="vm.treeNodes"
                  :selected-path="vm.selectedPath"
                  :expanded-paths="vm.expandedPaths"
                  :loading-paths="vm.loadingPaths"
                  @toggle-dir="vm.handleToggleDir"
                  @select-file="vm.handleSelectFile"
                />
              </div>
            </div>
          </article>

          <article class="panel-card flex flex-col flex-1 p-4 min-h-[780px]">
            <FilePreviewCard
              class="flex flex-col flex-1 min-h-0"
              :selected-path="vm.selectedPath"
              :preview="vm.preview"
              :loading="vm.previewLoading"
              :error-message="vm.previewError"
              preview-max-height-class="max-h-[62vh] min-h-[400px]"
              empty-message="从左侧文件树选择一个文档以预览内容。"
            >
              <template #actions>
                <button
                  class="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-md"
                  type="button"
                  @click="vm.openEditSelected"
                >
                  编辑
                </button>
                <button
                  class="h-9 rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="vm.deletingPath === vm.selectedPath"
                  type="button"
                  @click="vm.removeSelected"
                >
                  {{ vm.deletingPath === vm.selectedPath ? '删除中...' : '删除' }}
                </button>
              </template>

              <template #footer>
                <section class="flex min-h-[280px] max-h-[40vh] flex-col overflow-hidden rounded-lg border border-border bg-background p-3">
                  <div class="flex items-center justify-between border-b border-border pb-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">知识问答</p>
                    <div class="flex items-center gap-3 text-xs">
                      <label class="inline-flex items-center gap-1 text-muted-foreground">
                        <input
                          v-model="vm.queryScope"
                          type="radio"
                          class="accent-primary"
                          value="vm.project"
                        >
                        全项目
                      </label>
                      <label class="inline-flex items-center gap-1 text-muted-foreground">
                        <input
                          v-model="vm.queryScope"
                          type="radio"
                          class="accent-primary"
                          value="current_doc"
                          :disabled="!vm.canQueryCurrentDoc"
                        >
                        当前文件
                      </label>
                    </div>
                  </div>

                  <div class="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-muted/25 p-2 pr-1">
                    <p v-if="vm.queryMessages.length === 0 && !vm.queryError" class="text-sm text-muted-foreground">
                      输入问题后点击提问，答案会基于 docs 内容生成并附带引用来源。
                    </p>
                    <p v-if="vm.queryError" class="mb-2 text-sm text-destructive">{{ vm.queryError }}</p>

                    <div v-if="vm.queryMessages.length > 0" class="space-y-3">
                      <div
                        v-for="msg in vm.queryMessages"
                        :key="msg.id"
                        class="flex"
                        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
                      >
                        <div
                          class="max-w-[92%] rounded-xl px-3 py-2"
                          :class="msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-foreground'"
                        >
                          <p class="mb-1 text-[11px] font-semibold opacity-75">
                            {{ msg.role === 'user' ? '你' : 'AI' }}
                          </p>
                          <p v-if="msg.role === 'user'" class="whitespace-pre-wrap text-sm">{{ msg.content }}</p>
                          <MarkdownPreview v-else :content="msg.content || (msg.isStreaming ? '正在思考中...' : '')" />

                          <div
                            v-if="msg.role === 'assistant' && msg.citations && msg.citations.length > 0"
                            class="mt-2 rounded-md border border-border/70 bg-background/60 p-2"
                          >
                            <p class="text-xs font-semibold text-muted-foreground">引用来源</p>
                            <div class="mt-2 space-y-2">
                              <button
                                v-for="citation in msg.citations"
                                :key="`${msg.id}-${citation.path}-${citation.snippet}`"
                                type="button"
                                class="w-full rounded-md border border-border/70 bg-background px-2 py-1 text-left transition hover:border-primary/40 hover:bg-primary/5"
                                @click="vm.jumpToCitation(citation.path)"
                              >
                                <p class="font-mono text-[11px] text-foreground">{{ citation.path }}</p>
                                <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ citation.snippet }}</p>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <form class="mt-2 flex items-end gap-2 rounded-lg border border-border bg-card p-2" @submit.prevent="vm.submitKnowledgeQuery">
                    <textarea
                      v-model="vm.queryQuestion"
                      class="min-h-[56px] flex-1 resize-y rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground shadow-xs outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                      placeholder="例如：这个项目的部署流程是什么？"
                    />
                    <button
                      class="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="vm.queryLoading || !vm.queryQuestion.trim()"
                      type="submit"
                    >
                      {{ vm.queryLoading ? '提问中...' : '提问' }}
                    </button>
                  </form>
                </section>
              </template>
            </FilePreviewCard>
          </article>
        </section>
      </template>
    </template>

    <Teleport to="body">
      <div
        v-if="vm.modalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-doc-form-modal-title"
        @click.self="vm.closeModal"
      >
        <section class="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="project-doc-form-modal-title" class="text-sm font-semibold">
              {{ vm.isEditing ? '编辑知识库文件' : '新增知识库文件' }}
            </h2>
            <button
              class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              type="button"
              aria-label="关闭知识库弹窗"
              @click="vm.closeModal"
            >
              关闭
            </button>
          </header>

          <form class="grid max-h-[calc(92vh-56px)] gap-3 overflow-auto px-4 py-4" @submit.prevent="vm.submitDoc">
            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">文件路径（相对 docs）</span>
              <input
                v-model="vm.formPath"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如：architecture/overview.md"
                type="text"
                :disabled="vm.isEditing"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">文档内容</span>
              <textarea
                v-model="vm.formContent"
                class="min-h-[360px] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
                placeholder="请输入知识库内容（支持 Markdown）"
              />
            </label>

            <p v-if="vm.formError" class="text-sm text-destructive">{{ vm.formError }}</p>

            <div class="flex justify-end gap-2">
              <button
                class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
                type="button"
                @click="vm.closeModal"
              >
                取消
              </button>
              <button
                class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="vm.modalSaving"
                type="submit"
              >
                {{ vm.modalSaving ? '保存中...' : vm.isEditing ? '保存修改' : '创建文档' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
