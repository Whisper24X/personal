<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useMessage } from '@/hooks'
import { usersApi } from '@/api/users'
import type { CreateUserPayload, UpdateUserPayload, User } from '@/types/api/users'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'UsersManagementView',
})

const PAGE_LIMIT = 20

const loading = ref(false)
const loadingMore = ref(false)
const submitting = ref(false)
const deletingUserId = ref<string | null>(null)
const editingUserId = ref('')
const validationMessage = ref('')
const keyword = ref('')
const message = useMessage()

const users = ref<User[]>([])
const page = ref(1)
const hasNextPage = ref(false)

const form = reactive({
  username: '',
  password: '',
  nickname: '',
  avatar: '',
  isAdmin: false,
  status: 1,
})

const isEditing = computed(() => Boolean(editingUserId.value))

const filteredUsers = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) {
    return users.value
  }

  return users.value.filter((user) => {
    const nickname = user.nickname ?? ''

    return (
      user.username.toLowerCase().includes(query) ||
      nickname.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    )
  })
})

const formatDate = (value?: string) => {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusLabel = (status: number) => {
  return status === 1 ? '启用' : '停用'
}

const statusClass = (status: number) => {
  if (status === 1) {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  }

  return 'bg-muted text-muted-foreground'
}

const resetForm = () => {
  editingUserId.value = ''
  form.username = ''
  form.password = ''
  form.nickname = ''
  form.avatar = ''
  form.isAdmin = false
  form.status = 1
}

const startEdit = (user: User) => {
  editingUserId.value = user.id
  form.username = user.username
  form.password = ''
  form.nickname = user.nickname ?? ''
  form.avatar = user.avatar ?? ''
  form.isAdmin = user.isAdmin
  form.status = user.status
}

const normalizeOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

const loadUsers = async (reset = true) => {
  const currentPage = reset ? 1 : page.value + 1

  if (reset) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const response = await usersApi.list({
      page: currentPage,
      limit: PAGE_LIMIT,
    })

    if (reset) {
      users.value = response.data
    } else {
      const existingUserIds = new Set(users.value.map((user) => user.id))
      users.value = users.value.concat(
        response.data.filter((user) => !existingUserIds.has(user.id)),
      )
    }

    page.value = currentPage
    hasNextPage.value = response.hasNextPage
  } catch (error) {
    message.error(toErrorMessage(error, '加载用户列表失败'))
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const submitForm = async () => {
  if (!form.username.trim()) {
    validationMessage.value = '用户名不能为空'
    return
  }

  const normalizedPassword = form.password.trim()
  if (!isEditing.value && normalizedPassword.length < 6) {
    validationMessage.value = '新建用户时密码至少 6 位'
    return
  }

  submitting.value = true
  validationMessage.value = ''

  const payloadBase = {
    username: form.username.trim(),
    nickname: normalizeOptionalText(form.nickname),
    avatar: normalizeOptionalText(form.avatar),
    isAdmin: form.isAdmin,
    status: Number(form.status),
  }

  try {
    if (isEditing.value) {
      const updatePayload: UpdateUserPayload = {
        ...payloadBase,
      }

      if (normalizedPassword) {
        updatePayload.password = normalizedPassword
      }

      await usersApi.update(editingUserId.value, updatePayload)
      message.success('保存用户成功')
    } else {
      const createPayload: CreateUserPayload = {
        ...payloadBase,
        password: normalizedPassword,
      }
      await usersApi.create(createPayload)
      message.success('创建用户成功')
    }

    resetForm()
    await loadUsers(true)
  } catch (error) {
    message.error(toErrorMessage(error, '保存用户失败'))
  } finally {
    submitting.value = false
  }
}

const removeUser = async (user: User) => {
  if (!window.confirm(`确认删除用户「${user.username}」吗？`)) {
    return
  }

  deletingUserId.value = user.id

  try {
    await usersApi.remove(user.id)
    await loadUsers(true)
    message.success('删除用户成功')
  } catch (error) {
    message.error(toErrorMessage(error, '删除用户失败'))
  } finally {
    deletingUserId.value = null
  }
}

onMounted(() => {
  void loadUsers(true)
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">工作区</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">用户管理</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        对接 `/api/v1/users`，支持用户新增、编辑、删除，并可按用户名快速筛选。
      </p>
      <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
    </section>

    <section class="panel-card p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-semibold">{{ isEditing ? '编辑用户' : '新增用户' }}</p>
        <div class="flex items-center gap-2">
          <input
            v-model="keyword"
            class="h-10 w-64 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索用户名 / 昵称 / ID"
            type="search"
          />
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="loadUsers(true)"
          >
            刷新
          </button>
        </div>
      </div>

      <form class="grid gap-3 md:grid-cols-2" @submit.prevent="submitForm">
        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">用户名</span>
          <input
            v-model="form.username"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="例如：john.doe"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">密码</span>
          <input
            v-model="form.password"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            :placeholder="isEditing ? '不修改密码可留空' : '至少 6 位'"
            type="password"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">昵称（可选）</span>
          <input
            v-model="form.nickname"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="显示名称"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">头像链接（可选）</span>
          <input
            v-model="form.avatar"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="https://example.com/avatar.png"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">账号状态</span>
          <select
            v-model.number="form.status"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            <option :value="1">启用</option>
            <option :value="0">停用</option>
          </select>
        </label>

        <label class="inline-flex items-center gap-2 text-sm md:col-span-2">
          <input v-model="form.isAdmin" class="h-4 w-4" type="checkbox" />
          设为平台管理员（isAdmin）
        </label>

        <div class="md:col-span-2 flex justify-end gap-2">
          <button
            v-if="isEditing"
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="resetForm"
          >
            取消编辑
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="submitting"
            type="submit"
          >
            {{ submitting ? '保存中...' : isEditing ? '保存修改' : '创建用户' }}
          </button>
        </div>
      </form>
    </section>

    <section class="panel-card overflow-hidden">
      <div class="border-b border-border px-5 py-4">
        <p class="text-sm font-semibold">用户列表（已加载 {{ users.length }} 条）</p>
      </div>

      <div v-if="loading" class="p-5 text-sm text-muted-foreground">加载中...</div>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[980px] text-left text-sm">
          <thead class="border-b border-border bg-background/60">
            <tr class="text-xs font-semibold text-muted-foreground">
              <th class="px-5 py-3">用户</th>
              <th class="px-5 py-3">昵称</th>
              <th class="px-5 py-3">角色</th>
              <th class="px-5 py-3">状态</th>
              <th class="px-5 py-3">更新时间</th>
              <th class="px-5 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="user in filteredUsers" :key="user.id" class="transition hover:bg-background/70">
              <td class="px-5 py-4">
                <p class="font-semibold">{{ user.username }}</p>
                <p class="mt-1 font-mono text-xs text-muted-foreground">{{ user.id }}</p>
              </td>
              <td class="px-5 py-4 text-muted-foreground">
                <p>{{ user.nickname || '-' }}</p>
              </td>
              <td class="px-5 py-4">
                <span
                  class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                  :class="user.isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
                >
                  {{ user.isAdmin ? '管理员' : '普通用户' }}
                </span>
              </td>
              <td class="px-5 py-4">
                <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold" :class="statusClass(user.status)">
                  {{ statusLabel(user.status) }}
                </span>
              </td>
              <td class="px-5 py-4 text-muted-foreground">{{ formatDate(user.updatedAt ?? user.createdAt) }}</td>
              <td class="px-5 py-4 text-right">
                <div class="flex justify-end gap-2">
                  <button
                    class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
                    type="button"
                    @click="startEdit(user)"
                  >
                    编辑
                  </button>
                  <button
                    class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="deletingUserId === user.id"
                    type="button"
                    @click="removeUser(user)"
                  >
                    {{ deletingUserId === user.id ? '删除中...' : '删除' }}
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="filteredUsers.length === 0">
              <td class="px-5 py-6 text-sm text-muted-foreground" colspan="6">
                {{ keyword.trim() ? '没有匹配的用户。' : '暂无用户，请先创建。' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="hasNextPage" class="border-t border-border px-5 py-4">
        <button
          class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loadingMore"
          type="button"
          @click="loadUsers(false)"
        >
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </section>
  </div>
</template>
