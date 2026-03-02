<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useMessage } from '@/hooks'
import { skillsApi } from '@/api/skills'
import type { CreateSkillPayload, Skill, UpdateSkillPayload } from '@/types/api/skills'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'SkillsManagementView',
})

const PAGE_LIMIT = 30

const loading = ref(false)
const loadingMore = ref(false)
const submitting = ref(false)
const deletingSkillId = ref('')
const editingSkillId = ref('')
const skillFormModalOpen = ref(false)
const validationMessage = ref('')
const keyword = ref('')
const enabledOnly = ref(false)
const message = useMessage()

const skills = ref<Skill[]>([])
const page = ref(1)
const hasNextPage = ref(false)

const form = reactive({
  name: '',
  version: '',
  description: '',
  scope: '',
  homepageUrl: '',
  enabled: true,
  metadataJsonText: '',
})

const normalizeOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

const normalizeMetadata = (value: string) => {
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
  editingSkillId.value = ''
  form.name = ''
  form.version = ''
  form.description = ''
  form.scope = ''
  form.homepageUrl = ''
  form.enabled = true
  form.metadataJsonText = ''
}

const openCreateSkillModal = () => {
  resetForm()
  validationMessage.value = ''
  skillFormModalOpen.value = true
}

const closeSkillFormModal = () => {
  skillFormModalOpen.value = false
  resetForm()
  validationMessage.value = ''
}

const startEdit = (skill: Skill) => {
  editingSkillId.value = skill.id
  form.name = skill.name
  form.version = skill.version
  form.description = skill.description ?? ''
  form.scope = skill.scope ?? ''
  form.homepageUrl = skill.homepageUrl ?? ''
  form.enabled = skill.enabled
  form.metadataJsonText = skill.metadataJson
    ? JSON.stringify(skill.metadataJson, null, 2)
    : ''
  validationMessage.value = ''
  skillFormModalOpen.value = true
}

const loadSkills = async (reset = true) => {
  const nextPage = reset ? 1 : page.value + 1

  if (reset) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const response = await skillsApi.list({
      page: nextPage,
      limit: PAGE_LIMIT,
      keyword: keyword.value.trim() || undefined,
      enabled: enabledOnly.value ? true : undefined,
    })

    if (reset) {
      skills.value = response.data
    } else {
      const existingIds = new Set(skills.value.map((item) => item.id))
      skills.value = skills.value.concat(
        response.data.filter((item) => !existingIds.has(item.id)),
      )
    }

    page.value = nextPage
    hasNextPage.value = response.hasNextPage
  } catch (error) {
    message.error(toErrorMessage(error, '加载 Skills 列表失败'))
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const submitSkill = async () => {
  if (!form.name.trim() || !form.version.trim()) {
    validationMessage.value = '名称和版本不能为空'
    return
  }

  const metadata = normalizeMetadata(form.metadataJsonText)
  if (metadata === null) {
    validationMessage.value = 'metadataJson 必须是合法 JSON 对象'
    return
  }

  submitting.value = true
  validationMessage.value = ''

  const payloadBase = {
    name: form.name.trim(),
    version: form.version.trim(),
    description: normalizeOptionalText(form.description),
    scope: normalizeOptionalText(form.scope),
    homepageUrl: normalizeOptionalText(form.homepageUrl),
    enabled: form.enabled,
    metadataJson: metadata,
  }

  try {
    if (editingSkillId.value) {
      const updatePayload: UpdateSkillPayload = payloadBase
      await skillsApi.update(editingSkillId.value, updatePayload)
      message.success('保存 Skill 成功')
    } else {
      const createPayload: CreateSkillPayload = payloadBase
      await skillsApi.create(createPayload)
      message.success('创建 Skill 成功')
    }

    closeSkillFormModal()
    await loadSkills(true)
  } catch (error) {
    message.error(toErrorMessage(error, '保存 Skill 失败'))
  } finally {
    submitting.value = false
  }
}

const toggleSkillEnabled = async (skill: Skill) => {
  try {
    await skillsApi.update(skill.id, {
      enabled: !skill.enabled,
    })
    await loadSkills(true)
    message.success('更新 Skill 状态成功')
  } catch (error) {
    message.error(toErrorMessage(error, '更新 Skill 状态失败'))
  }
}

const removeSkill = async (skill: Skill) => {
  if (!window.confirm(`确认删除 Skill「${skill.name}」吗？`)) {
    return
  }

  deletingSkillId.value = skill.id

  try {
    await skillsApi.remove(skill.id)
    await loadSkills(true)
    message.success('删除 Skill 成功')
  } catch (error) {
    message.error(toErrorMessage(error, '删除 Skill 失败'))
  } finally {
    deletingSkillId.value = ''
  }
}

onMounted(() => {
  void loadSkills(true)
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">技能（Skill）</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">Skill 市场与管理</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        支持 Skills 的浏览、搜索、新增、编辑、启停与删除。
      </p>
    </section>

    <section class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-1 flex-wrap items-center gap-2">
          <input
            v-model="keyword"
            class="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 版本 / 说明"
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
            @click="loadSkills(true)"
          >
            刷新
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="loadSkills(true)"
          >
            搜索
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="openCreateSkillModal"
          >
            新增 Skill
          </button>
        </div>
      </div>
    </section>

    <section v-if="loading" class="panel-card p-6 text-sm text-muted-foreground">加载中...</section>

    <section v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="item in skills" :key="item.id" class="panel-card p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ item.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">版本：{{ item.version }}</p>
          </div>
          <span
            class="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold"
            :class="item.enabled ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
          >
            {{ item.enabled ? '已启用' : '已停用' }}
          </span>
        </div>

        <p class="mt-3 text-xs text-muted-foreground">范围：{{ item.scope ?? '-' }}</p>
        <p class="mt-2 text-xs text-muted-foreground">{{ item.description ?? '暂无描述' }}</p>

        <a
          v-if="item.homepageUrl"
          :href="item.homepageUrl"
          class="mt-4 inline-flex text-xs font-semibold text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          查看说明
        </a>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="startEdit(item)"
          >
            编辑
          </button>
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="toggleSkillEnabled(item)"
          >
            {{ item.enabled ? '停用' : '启用' }}
          </button>
          <button
            class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="deletingSkillId === item.id"
            type="button"
            @click="removeSkill(item)"
          >
            {{ deletingSkillId === item.id ? '删除中...' : '删除' }}
          </button>
        </div>
      </article>

      <article v-if="skills.length === 0" class="panel-card p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
        没有匹配的 Skill。
      </article>
    </section>

    <section v-if="!loading && hasNextPage" class="panel-card p-4">
      <button
        class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loadingMore"
        type="button"
        @click="loadSkills(false)"
      >
        {{ loadingMore ? '加载中...' : '加载更多' }}
      </button>
    </section>

    <Teleport to="body">
      <div v-if="skillFormModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="关闭 Skill 表单弹窗"
          class="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          @click="closeSkillFormModal"
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="skill-form-modal-title"
          class="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl"
          tabindex="-1"
          @keydown.esc.prevent="closeSkillFormModal"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="skill-form-modal-title" class="text-sm font-semibold">
              {{ editingSkillId ? '编辑 Skill' : '新增 Skill' }}
            </h2>
            <button
              type="button"
              aria-label="关闭"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
              @click="closeSkillFormModal"
            >
              ×
            </button>
          </header>

          <form class="grid gap-3 px-4 py-4 md:grid-cols-2" @submit.prevent="submitSkill">
            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">名称</span>
              <input
                v-model="form.name"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如：code-review"
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
              <span class="text-xs font-semibold text-muted-foreground">范围（可选）</span>
              <input
                v-model="form.scope"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如：frontend"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">主页链接（可选）</span>
              <input
                v-model="form.homepageUrl"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="https://example.com/skill"
                type="text"
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

            <p v-if="validationMessage" class="text-sm text-destructive md:col-span-2">{{ validationMessage }}</p>

            <div class="flex justify-end gap-2 md:col-span-2">
              <button
                class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
                type="button"
                @click="closeSkillFormModal"
              >
                取消
              </button>
              <button
                class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="submitting"
                type="submit"
              >
                {{ submitting ? '保存中...' : editingSkillId ? '保存修改' : '创建 Skill' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
