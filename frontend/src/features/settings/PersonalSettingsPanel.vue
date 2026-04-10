<script setup lang="ts">
import { toRef } from 'vue'
import {
  APPEARANCE_OPTIONS,
  BACKGROUND_STYLE_OPTIONS,
  THEME_COLOR_OPTIONS,
  THEME_COLOR_SWATCH_CLASS,
} from './personal-settings-ui.constants'
import {
  usePersonalSettingsPanel,
  type PersonalSettingsPanelProps,
} from './use-personal-settings-panel'

defineOptions({
  name: 'PersonalSettingsPanel',
})

const props = defineProps<PersonalSettingsPanelProps>()
const vm = usePersonalSettingsPanel(props)
const profileFirstFieldRef = toRef(vm, 'profileFirstFieldRef')
const passwordFirstFieldRef = toRef(vm, 'passwordFirstFieldRef')
const webhookFirstFieldRef = toRef(vm, 'webhookFirstFieldRef')
const logoutConfirmButtonRef = toRef(vm, 'logoutConfirmButtonRef')
</script>

<template>
  <div class="fade-up space-y-4">
    <section class="space-y-4">
      <section v-if="vm.activePanel === 'account'" class="space-y-4">
        <article class="rounded-xl border border-border bg-card/40 p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">个人资料</p>
              <p class="mt-1 text-xs text-muted-foreground">查看账号信息，并通过弹窗更新资料或密码。</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:shadow-sm"
                type="button"
                @click="vm.openProfileModal"
              >
                编辑资料
              </button>
              <button
                class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:shadow-sm"
                type="button"
                @click="vm.openPasswordModal"
              >
                修改密码
              </button>
            </div>
          </div>

          <div class="mt-4 flex items-start gap-3">
            <div class="relative h-12 w-12 overflow-hidden rounded-full border border-border bg-muted">
              <img v-if="vm.profileAvatar" :src="vm.profileAvatar" alt="用户头像" class="h-full w-full object-cover" />
              <span v-else class="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                {{ vm.profileInitial }}
              </span>
            </div>

            <div class="min-w-0 flex-1 space-y-2">
              <dl class="grid grid-cols-[72px_1fr] items-center gap-y-1 text-xs">
                <dt class="text-muted-foreground">昵称</dt>
                <dd class="truncate text-foreground">{{ vm.profileDisplayName }}</dd>
                <dt class="text-muted-foreground">用户名</dt>
                <dd class="truncate text-foreground">{{ vm.profileForm.username || '-' }}</dd>
              </dl>
            </div>
          </div>
        </article>

        <article class="rounded-xl border border-border bg-card/40 p-4">
          <p class="text-sm font-semibold">账号与会话</p>
          <p class="mt-1 text-xs text-muted-foreground">退出登录不会删除数据。</p>
          <div class="mt-3">
            <button
              class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="vm.onLogout"
            >
              退出登录
            </button>
          </div>
        </article>
      </section>

      <section v-else-if="vm.activePanel === 'appearance'" class="space-y-3">
        <article class="rounded-xl border border-border bg-card/40 p-4">
          <p class="text-sm font-semibold">主题色</p>
          <p class="mt-2 text-xs text-muted-foreground">调整全局强调色与交互高亮风格。</p>
          <div class="mt-4 flex flex-wrap gap-4">
            <button
              v-for="option in THEME_COLOR_OPTIONS"
              :key="option.value"
              class="group flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition"
              :class="
                vm.themeColor === option.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-background text-foreground hover:shadow-sm'
              "
              type="button"
              @click="vm.applyThemeColorSetting(option.value)"
            >
              <span
                class="h-3.5 w-3.5 rounded-full"
                :class="THEME_COLOR_SWATCH_CLASS[option.value]"
              />
              {{ option.label }}
            </button>
          </div>
        </article>

        <article class="rounded-xl border border-border bg-card/40 p-4">
          <p class="text-sm font-semibold">外观</p>
          <p class="mt-2 text-xs text-muted-foreground">选择浅色或深色模式。</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button
              v-for="option in APPEARANCE_OPTIONS"
              :key="option.value"
              class="group flex flex-col items-center gap-2 rounded-lg border p-2 transition"
              :class="
                vm.appearanceMode === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:border-primary/40'
              "
              type="button"
              @click="vm.applyAppearanceSetting(option.value)"
            >
              <div
                class="flex h-16 w-24 items-center justify-center rounded-md border"
                :class="option.value === 'light' ? 'border-gray-200 bg-white' : 'border-gray-700 bg-slate-900'"
              >
                <div
                  class="h-9 w-16 rounded border"
                  :class="option.value === 'light' ? 'border-gray-300 bg-gray-100' : 'border-gray-600 bg-slate-800'"
                />
              </div>
              <span
                class="text-xs"
                :class="vm.appearanceMode === option.value ? 'font-semibold text-foreground' : 'text-muted-foreground'"
              >
                {{ option.label }}
              </span>
            </button>
          </div>
        </article>

        <article class="rounded-xl border border-border bg-card/40 p-4">
          <p class="text-sm font-semibold">背景风格</p>
          <p class="mt-2 text-xs text-muted-foreground">调整工作区背景纹理，减少视觉疲劳。</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button
              v-for="option in BACKGROUND_STYLE_OPTIONS"
              :key="option.value"
              class="group flex flex-col items-center gap-2 rounded-lg border p-2 transition"
              :class="
                vm.backgroundStyle === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:border-primary/40'
              "
              type="button"
              @click="vm.applyBackgroundStyleSetting(option.value)"
            >
              <div
                class="h-16 w-24 rounded-md border"
                :class="
                  option.value === 'grid'
                    ? 'border-slate-200 bg-[linear-gradient(0deg,rgba(148,163,184,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.1)_1px,transparent_1px)] bg-[size:12px_12px]'
                    : option.value === 'plain'
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-violet-200 bg-gradient-to-br from-fuchsia-50 to-violet-100'
                "
              />
              <span
                class="text-xs"
                :class="vm.backgroundStyle === option.value ? 'font-semibold text-foreground' : 'text-muted-foreground'"
              >
                {{ option.label }}
              </span>
            </button>
          </div>
        </article>
      </section>

      <section v-else class="space-y-3">
        <div v-if="vm.loading" class="text-xs text-muted-foreground">加载中...</div>

        <template v-else>
          <article class="rounded-xl border border-border bg-card/40 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold">浏览器通知</p>
                <p class="mt-1 text-xs text-muted-foreground">在浏览器中接收系统提醒，可直接检查当前授权状态。</p>
              </div>

              <div class="flex items-center">
                <label
                  class="inline-flex items-center"
                  :class="vm.notificationSaving || vm.browserPermissionSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
                >
                  <input
                    v-model="vm.settingForm.browserEnabled"
                    aria-label="切换浏览器通知"
                    class="peer sr-only"
                    :disabled="vm.notificationSaving || vm.browserPermissionSaving"
                    type="checkbox"
                    @change="vm.toggleBrowserNotification"
                  />
                  <span
                    class="relative h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
                  />
                </label>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium"
                :class="vm.browserPermissionBadgeClass"
              >
                当前授权：{{ vm.browserPermissionLabel }}
              </span>
              <button
                class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:shadow-sm"
                type="button"
                @click="vm.handleBrowserPermissionCheck"
              >
                检查授权
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="vm.browserPermissionSaving"
                type="button"
                @click="vm.sendTestBrowserNotification"
              >
                发送测试通知
              </button>
            </div>

            <p class="mt-3 text-xs text-muted-foreground">
              {{ vm.browserNotificationHint }}
            </p>
          </article>

          <article class="rounded-xl border border-border bg-card/40 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold">Webhook 通知</p>
                <p class="mt-1 text-xs text-muted-foreground">通过回调地址接收系统事件，配置与保存在弹窗中完成。</p>
              </div>

              <div class="flex items-center gap-2">
                <button
                  class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:shadow-sm"
                  type="button"
                  @click="vm.openWebhookModal"
                >
                  编辑
                </button>
                <label
                  class="inline-flex items-center"
                  :class="vm.notificationSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
                >
                  <input
                    v-model="vm.settingForm.webhookEnabled"
                    aria-label="切换 Webhook 通知"
                    class="peer sr-only"
                    :disabled="vm.notificationSaving"
                    type="checkbox"
                    @change="vm.toggleWebhookNotification"
                  />
                  <span
                    class="relative h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
                  />
                </label>
              </div>
            </div>

            <dl class="mt-4 grid grid-cols-[72px_1fr] items-start gap-y-2 text-xs">
              <dt class="text-muted-foreground">回调地址</dt>
              <dd class="break-all text-foreground">{{ vm.settingForm.webhookUrl || '-' }}</dd>
              <dt class="text-muted-foreground">签名密钥</dt>
              <dd class="text-foreground">{{ vm.settingForm.webhookSecret ? '已配置' : '未配置' }}</dd>
            </dl>
          </article>
        </template>
      </section>
    </section>
  </div>

  <Teleport to="body">
    <div
      v-if="vm.profileModalOpen"
      class="fixed inset-0 z-[95] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="vm.closeProfileModal"
    >
      <button class="absolute inset-0 bg-black/45" type="button" @click="vm.closeProfileModal" />
      <section
        aria-modal="true"
        class="relative z-10 w-[min(560px,96vw)] max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xl"
        role="dialog"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">编辑个人资料</h3>
          <button
            aria-label="关闭编辑个人资料弹窗"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            type="button"
            @click="vm.closeProfileModal"
          >
            ×
          </button>
        </div>

        <form class="mt-4 flex max-h-[calc(85vh-6rem)] flex-col" @submit.prevent="vm.saveProfile">
          <div class="space-y-3 overflow-y-auto pr-1">
            <p v-if="vm.profileServerError" class="text-sm text-destructive">{{ vm.profileServerError }}</p>

            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">用户名</span>
              <input
                ref="profileFirstFieldRef"
                v-model="vm.profileDraft.username"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="vm.profileFieldErrors.username ? 'border-destructive ring-1 ring-destructive/20' : ''"
                type="text"
              />
              <p v-if="vm.profileFieldErrors.username" class="text-xs text-destructive">{{ vm.profileFieldErrors.username }}</p>
            </label>

            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">昵称</span>
              <input
                v-model="vm.profileDraft.nickname"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">头像链接</span>
              <input
                v-model="vm.profileDraft.avatar"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="vm.profileFieldErrors.avatar ? 'border-destructive ring-1 ring-destructive/20' : ''"
                placeholder="https://example.com/avatar.png"
                type="text"
              />
              <p v-if="vm.profileFieldErrors.avatar" class="text-xs text-destructive">{{ vm.profileFieldErrors.avatar }}</p>
            </label>
          </div>

          <div class="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <button
              class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="vm.closeProfileModal"
            >
              取消
            </button>
            <button
              class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="vm.profileSaving"
              type="submit"
            >
              {{ vm.profileSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="vm.passwordModalOpen"
      class="fixed inset-0 z-[95] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="vm.closePasswordModal"
    >
      <button class="absolute inset-0 bg-black/45" type="button" @click="vm.closePasswordModal" />
      <section
        aria-modal="true"
        class="relative z-10 w-[min(520px,96vw)] max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xl"
        role="dialog"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">修改密码</h3>
          <button
            aria-label="关闭修改密码弹窗"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            type="button"
            @click="vm.closePasswordModal"
          >
            ×
          </button>
        </div>

        <form class="mt-4 flex max-h-[calc(85vh-6rem)] flex-col" @submit.prevent="vm.savePassword">
          <div class="space-y-3 overflow-y-auto pr-1">
            <p v-if="vm.passwordServerError" class="text-sm text-destructive">{{ vm.passwordServerError }}</p>

            <label class="block space-y-1">
              <span class="text-xs text-muted-foreground">当前密码</span>
              <input
                ref="passwordFirstFieldRef"
                v-model="vm.passwordForm.oldPassword"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="vm.passwordFieldErrors.oldPassword ? 'border-destructive ring-1 ring-destructive/20' : ''"
                type="password"
              />
              <p v-if="vm.passwordFieldErrors.oldPassword" class="text-xs text-destructive">{{ vm.passwordFieldErrors.oldPassword }}</p>
            </label>

            <label class="block space-y-1">
              <span class="text-xs text-muted-foreground">新密码</span>
              <input
                v-model="vm.passwordForm.password"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="vm.passwordFieldErrors.password ? 'border-destructive ring-1 ring-destructive/20' : ''"
                type="password"
              />
              <p v-if="vm.passwordFieldErrors.password" class="text-xs text-destructive">{{ vm.passwordFieldErrors.password }}</p>
            </label>

            <label class="block space-y-1">
              <span class="text-xs text-muted-foreground">确认新密码</span>
              <input
                v-model="vm.passwordForm.confirmPassword"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="vm.passwordFieldErrors.confirmPassword ? 'border-destructive ring-1 ring-destructive/20' : ''"
                type="password"
              />
              <p v-if="vm.passwordFieldErrors.confirmPassword" class="text-xs text-destructive">{{ vm.passwordFieldErrors.confirmPassword }}</p>
            </label>
          </div>

          <div class="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <button
              class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="vm.closePasswordModal"
            >
              取消
            </button>
            <button
              class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="vm.passwordSaving"
              type="submit"
            >
              {{ vm.passwordSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="vm.logoutConfirmOpen"
      class="fixed inset-0 z-[95] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="vm.closeLogoutConfirm"
    >
      <button class="absolute inset-0 bg-black/45" type="button" @click="vm.closeLogoutConfirm" />
      <section
        aria-modal="true"
        class="relative z-10 w-[min(440px,96vw)] overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xl"
        role="dialog"
      >
        <div class="space-y-2">
          <h3 class="text-base font-semibold">确认退出登录</h3>
          <p class="text-sm text-muted-foreground">退出后将返回登录页。</p>
        </div>

        <div class="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          <button
            class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="vm.logoutSubmitting"
            type="button"
            @click="vm.closeLogoutConfirm"
          >
            取消
          </button>
          <button
            ref="logoutConfirmButtonRef"
            class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="vm.logoutSubmitting"
            type="button"
            @click="vm.confirmLogout"
          >
            {{ vm.logoutSubmitting ? '退出中...' : '确认退出' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="vm.webhookModalOpen"
      class="fixed inset-0 z-[95] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="vm.closeWebhookModal"
    >
      <button class="absolute inset-0 bg-black/45" type="button" @click="vm.closeWebhookModal" />
      <section
        aria-modal="true"
        class="relative z-10 w-[min(520px,96vw)] max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xl"
        role="dialog"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">配置 Webhook</h3>
          <button
            aria-label="关闭 Webhook 配置弹窗"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            type="button"
            @click="vm.closeWebhookModal"
          >
            ×
          </button>
        </div>

        <form class="mt-4 flex max-h-[calc(85vh-6rem)] flex-col" @submit.prevent="vm.saveWebhookSetting">
          <div class="space-y-3 overflow-y-auto pr-1">
            <p v-if="vm.webhookServerError" class="text-sm text-destructive">{{ vm.webhookServerError }}</p>

            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">Webhook 地址</span>
              <input
                ref="webhookFirstFieldRef"
                v-model="vm.webhookDraft.url"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="vm.webhookFieldError ? 'border-destructive ring-1 ring-destructive/20' : ''"
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
                type="text"
              />
              <p v-if="vm.webhookFieldError" class="text-xs text-destructive">{{ vm.webhookFieldError }}</p>
            </label>

            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">签名密钥（可选，飞书机器人安全设置中获取）</span>
              <input
                v-model="vm.webhookDraft.secret"
                autocomplete="off"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="飞书机器人签名校验密钥"
                type="password"
              />
            </label>
          </div>

          <div class="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <button
              class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="vm.closeWebhookModal"
            >
              取消
            </button>
            <button
              class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="vm.webhookSaving"
              type="submit"
            >
              {{ vm.webhookSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
