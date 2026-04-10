<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { businessLinesApi } from '@/api/business-lines'
import { useMessage } from '@app/composables/useMessage'
import { toErrorMessage } from '@api/shared/to-error-message'

defineOptions({
  name: 'BusinessLineInviteView',
})

const route = useRoute()
const router = useRouter()
const message = useMessage()

const token = computed(() => {
  const rawToken = route.query.token
  return typeof rawToken === 'string' ? rawToken.trim() : ''
})

const accepting = ref(false)
const accepted = ref(false)
const joinedRole = ref('')
const failedProjects = ref<string[]>([])

const acceptInvite = async () => {
  if (!token.value) {
    message.error('邀请链接缺少 token 参数')
    return
  }

  accepting.value = true

  try {
    const response = await businessLinesApi.acceptInvitation({
      token: token.value,
    })

    accepted.value = true
    joinedRole.value = response.member.customRoleName ?? response.member.roleId
    failedProjects.value = response.failedProjects
    message.success('加入业务线成功')
  } catch (error) {
    message.error(toErrorMessage(error, '接受邀请失败'))
  } finally {
    accepting.value = false
  }
}

const goToBusinessLineSettings = () => {
  void router.push({ name: 'business-lines-manage' })
}
</script>

<template>
  <main class="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center justify-center px-4 py-10">
    <section class="w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div class="space-y-2">
        <p class="text-xs font-semibold tracking-wide text-muted-foreground">业务线邀请</p>
        <h1 class="text-xl font-semibold text-foreground">邀请加入业务线</h1>
        <p class="text-sm text-muted-foreground">
          通过邀请链接加入业务线后，你会获得邀请中配置的业务线角色与项目权限。
        </p>
      </div>

      <div class="mt-6 space-y-3 rounded-xl border border-border bg-background/70 p-4">
        <p class="text-xs font-semibold text-muted-foreground">邀请状态</p>
        <p v-if="!token" class="text-sm text-destructive">链接无效：缺少 token 参数。</p>
        <p v-else-if="accepted" class="text-sm text-foreground">
          已加入业务线，当前角色：<span class="font-semibold">{{ joinedRole }}</span>
        </p>
        <p v-else class="text-sm text-muted-foreground">点击下方按钮确认接受邀请。</p>

        <p v-if="accepted && failedProjects.length > 0" class="text-xs text-amber-600">
          部分项目权限同步失败：{{ failedProjects.join('、') }}
        </p>
      </div>

      <div class="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          class="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="accepting || accepted || !token"
          @click="acceptInvite"
        >
          {{ accepting ? '加入中...' : accepted ? '已接受邀请' : '接受邀请' }}
        </button>

        <button
          type="button"
          class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-sm"
          @click="goToBusinessLineSettings"
        >
          返回业务线设置
        </button>
      </div>
    </section>
  </main>
</template>
