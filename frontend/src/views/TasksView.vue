<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

type MessageRole = 'user' | 'assistant'

type MessageItem = {
  id: string
  role: MessageRole
  content: string
  time: string
}

type SuggestionItem = {
  id: string
  title: string
  detail: string
}

const input = ref('')
const sending = ref(false)
const viewportRef = ref<HTMLDivElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const messages = ref<MessageItem[]>([])

const suggestions: SuggestionItem[] = [
  {
    id: 'snake-game',
    title: 'Build a classic Snake game in this repo.',
    detail: '生成可运行的游戏页面与基础说明。',
  },
  {
    id: 'one-page-pdf',
    title: 'Create a one-page $pdf that summarizes this app.',
    detail: '输出重点结构、模块职责与待办事项。',
  },
  {
    id: 'weekly-pr',
    title: "Summarize last week's PRs by teammate and theme.",
    detail: '按成员与主题分组汇总主要改动。',
  },
]

const hasConversation = computed(() => messages.value.length > 0)

const roleClass = (role: MessageRole) => {
  if (role === 'user') {
    return 'ml-auto max-w-[84%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground'
  }

  return 'mr-auto max-w-[84%] rounded-2xl border border-border bg-card px-4 py-3 text-foreground'
}

const timeLabel = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    const viewport = viewportRef.value
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  },
)

const applySuggestion = (content: string) => {
  input.value = content
  textareaRef.value?.focus()
}

const sendMessage = async () => {
  const content = input.value.trim()
  if (!content || sending.value) return

  const messageTime = timeLabel()
  messages.value.push({
    id: `m-user-${Date.now()}`,
    role: 'user',
    content,
    time: messageTime,
  })
  input.value = ''

  sending.value = true
  await new Promise((resolve) => setTimeout(resolve, 320))

  messages.value.push({
    id: `m-assistant-${Date.now()}`,
    role: 'assistant',
    content: '已记录任务需求。我将开始执行并在这里持续同步关键进度。',
    time: messageTime,
  })

  sending.value = false
}
</script>

<template>
  <div class="fade-up flex min-h-[calc(100vh-11.5rem)] flex-col">
    <section class="flex flex-1 flex-col justify-center pb-8">
      <div class="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center">
        <div v-if="!hasConversation" class="mx-auto flex max-w-xl flex-col items-center text-center">
          <div class="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4.5 12a3.5 3.5 0 0 1 2.4-3.33A4.5 4.5 0 0 1 15.2 7a4 4 0 1 1 1.94 7.5H7.8A3.3 3.3 0 0 1 4.5 12" />
              <path d="m10.5 11 1.5 1.5 2.5-2.5" />
            </svg>
          </div>

          <h1 class="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">Let's build</h1>

          <button
            class="mt-2 inline-flex h-11 items-center gap-1 rounded-full px-4 text-3xl font-semibold tracking-tight text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            ainative
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        <article
          v-else
          class="mx-auto mt-6 flex w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-3xl border border-border/80 bg-card/90 shadow-sm backdrop-blur"
        >
          <header class="border-b border-border px-5 py-4">
            <p class="text-sm font-semibold">当前会话</p>
            <p class="mt-1 text-xs text-muted-foreground">项目：AINative 示例项目 · 模式：Codex Runner</p>
          </header>

          <div ref="viewportRef" class="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <div v-for="message in messages" :key="message.id" :class="roleClass(message.role)">
              <p class="text-sm leading-relaxed">{{ message.content }}</p>
              <p class="mt-2 text-[11px] opacity-70">{{ message.time }}</p>
            </div>
          </div>
        </article>

        <div class="mx-auto mt-10 w-full max-w-4xl">
          <div class="mb-3 flex justify-end">
            <button
              class="inline-flex h-9 items-center rounded-full px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
            >
              Explore more
            </button>
          </div>

          <div class="grid gap-3 md:grid-cols-3">
            <button
              v-for="suggestion in suggestions"
              :key="suggestion.id"
              class="group min-h-36 rounded-3xl border border-border bg-card/95 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
              @click="applySuggestion(suggestion.title)"
            >
              <span
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-muted text-muted-foreground transition group-hover:text-foreground"
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
                  <rect x="3" y="4" width="18" height="14" rx="2" />
                  <path d="M8 20h8" />
                </svg>
              </span>
              <p class="mt-3 text-[1.35rem] leading-snug tracking-tight text-foreground">{{ suggestion.title }}</p>
              <p class="mt-2 text-xs leading-relaxed text-muted-foreground">{{ suggestion.detail }}</p>
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto w-full max-w-4xl">
      <form
        class="rounded-[1.7rem] border border-border bg-card/95 shadow-[0_16px_40px_-24px_hsl(0_0%_0%_/_0.55)] backdrop-blur"
        @submit.prevent="sendMessage"
      >
        <label class="block px-4 pt-4">
          <span class="sr-only">输入任务消息</span>
          <textarea
            ref="textareaRef"
            v-model="input"
            rows="3"
            class="min-h-[88px] w-full resize-y rounded-xl bg-card px-2 py-2 text-base text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Ask Codex anything, @ to add files, / for commands"
          />
        </label>

        <div class="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 px-4 py-3">
          <div class="flex flex-wrap items-center gap-2">
            <button
              class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
              aria-label="添加文件或命令"
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
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </button>

            <button
              class="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
            >
              GPT-5.3-Codex
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <button
              class="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
            >
              Extra High
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>

          <button
            class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55"
            :disabled="sending || !input.trim()"
            type="submit"
            aria-label="发送任务消息"
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
              <path d="m12 19 0-14" />
              <path d="m5 12 7-7 7 7" />
            </svg>
          </button>
        </div>
      </form>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 pb-1 text-xs text-muted-foreground">
        <div class="flex flex-wrap items-center gap-3">
          <button
            class="inline-flex h-8 items-center gap-1 rounded-full px-2 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            Local
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
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <button
            class="inline-flex h-8 items-center gap-1 rounded-full px-2 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            Default permission
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
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        <button
          class="inline-flex h-8 items-center gap-1 rounded-full px-2 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          v2
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
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    </section>
  </div>
</template>
