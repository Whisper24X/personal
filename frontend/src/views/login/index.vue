<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/hooks'
import { useMessage } from '@/hooks'
import {
  parseLoginRedirectQuery,
  resolveAuthenticatedRedirectPath,
} from '@/utils/router/post-auth'
import { toErrorMessage } from '@/utils/http/to-error-message'

type AuthMode = 'login' | 'register'

defineOptions({
  name: 'LoginView',
})

const router = useRouter()
const route = useRoute()
const { login, register, loading: isLoading } = useAuth()
const message = useMessage()

const mode = ref<AuthMode>('login')
const username = ref('')
const password = ref('')
const nickname = ref('')
const confirmPassword = ref('')
const showLoginPassword = ref(false)
const showRegisterPasswords = ref(false)

const switchMode = (nextMode: AuthMode) => {
  if (mode.value === nextMode) {
    return
  }

  mode.value = nextMode
  showLoginPassword.value = false
  showRegisterPasswords.value = false
}

const validateLoginForm = () => {
  if (!username.value.trim() || !password.value.trim()) {
    message.warning('请输入用户名和密码')
    return false
  }

  return true
}

const validateRegisterForm = () => {
  if (!username.value.trim() || !password.value.trim()) {
    message.warning('请输入用户名和密码')
    return false
  }

  if (password.value.length < 6) {
    message.warning('密码至少 6 位')
    return false
  }

  if (!confirmPassword.value.trim()) {
    message.warning('请确认密码')
    return false
  }

  if (password.value !== confirmPassword.value) {
    message.warning('两次输入的密码不一致')
    return false
  }

  return true
}

const onLogin = async () => {
  await login({
    username: username.value.trim(),
    password: password.value,
  })

  await router.push(
    await resolveAuthenticatedRedirectPath(parseLoginRedirectQuery(route)),
  )
}

const onRegister = async () => {
  const trimmedNickname = nickname.value.trim()

  await register({
    username: username.value.trim(),
    password: password.value,
    ...(trimmedNickname ? { nickname: trimmedNickname } : {}),
  })

  await login({
    username: username.value.trim(),
    password: password.value,
  })

  message.success('注册成功，已自动登录')
  await router.push(
    await resolveAuthenticatedRedirectPath(parseLoginRedirectQuery(route)),
  )
}

const onLoginSubmit = async () => {
  if (!validateLoginForm()) {
    return
  }

  try {
    await onLogin()
  } catch (exception) {
    message.error(toErrorMessage(exception, '登录失败'))
  }
}

const onRegisterSubmit = async () => {
  if (!validateRegisterForm()) {
    return
  }

  try {
    await onRegister()
  } catch (exception) {
    message.error(toErrorMessage(exception, '注册失败'))
  }
}
</script>

<template>
  <div class="login-view auth-stage relative h-[var(--app-viewport-height)] overflow-hidden text-foreground">
    <div aria-hidden="true" class="pointer-events-none absolute inset-0">
      <div class="auth-orb auth-orb-primary" />
      <div class="auth-orb auth-orb-secondary" />
      <div class="auth-noise" />
    </div>

    <div class="relative z-10 h-full min-h-0 overflow-y-auto px-4 py-8 sm:px-6 lg:px-10">
      <div class="mx-auto flex min-h-full w-full max-w-6xl items-center">
        <div class="auth-grid grid w-full grid-cols-1 justify-center">
          <section class="auth-panel">
            <header class="auth-header">
              <div class="auth-badge-row">
                <span class="auth-badge auth-badge-primary">后台工作台</span>
                <span class="auth-badge">安全登录</span>
              </div>
              <div class="auth-logo-badge">AI</div>
              <p class="auth-kicker">AI Native Workspace</p>
              <h1 class="auth-title">{{ mode === 'login' ? '欢迎回来' : '创建新账号' }}</h1>
              <p class="auth-subtitle">
                {{ mode === 'login' ? '登录后继续你的项目、任务与自动化流程。' : '注册后自动登录，立即开始使用 AI Native 平台。' }}
              </p>
              <div class="auth-highlight-row" aria-hidden="true">
                <span class="auth-highlight-chip">任务协同</span>
                <span class="auth-highlight-chip">环境启动</span>
                <span class="auth-highlight-chip">交付追踪</span>
              </div>
            </header>

            <div class="auth-mode-switch" role="tablist" aria-label="登录注册切换">
              <button
                class="auth-mode-button"
                :class="mode === 'login' ? 'is-active' : ''"
                data-testid="switch-to-login"
                type="button"
                @click="switchMode('login')"
              >
                登录
              </button>
              <button
                class="auth-mode-button"
                :class="mode === 'register' ? 'is-active' : ''"
                data-testid="switch-to-register"
                type="button"
                @click="switchMode('register')"
              >
                注册
              </button>
            </div>

            <div class="auth-form-shell">
              <Transition name="auth-form-fade" mode="out-in">
                <form
                  v-if="mode === 'login'"
                  key="login"
                  class="auth-form space-y-4"
                  @submit.prevent="onLoginSubmit"
                >
                  <label class="block space-y-2">
                    <span class="text-xs font-semibold text-muted-foreground">用户名</span>
                    <input
                      v-model="username"
                      autocomplete="username"
                      class="auth-input"
                      placeholder="输入用户名"
                      type="text"
                    />
                  </label>

                  <label class="block space-y-2">
                    <span class="text-xs font-semibold text-muted-foreground">密码</span>
                    <div class="auth-password-field">
                      <input
                        v-model="password"
                        autocomplete="current-password"
                        class="auth-input auth-input-password"
                        placeholder="输入密码"
                        :type="showLoginPassword ? 'text' : 'password'"
                      />
                      <button
                        class="auth-password-toggle"
                        :aria-label="showLoginPassword ? '隐藏密码' : '显示密码'"
                        type="button"
                        @click="showLoginPassword = !showLoginPassword"
                      >
                        {{ showLoginPassword ? '隐藏' : '显示' }}
                      </button>
                    </div>
                  </label>

                  <button class="auth-submit" :disabled="isLoading" type="submit">
                    {{ isLoading ? '登录中...' : '登录' }}
                  </button>

                  <div class="auth-switch-row">
                    <span>没有账号？</span>
                    <button
                      class="auth-switch-link"
                      data-testid="switch-to-register-link"
                      type="button"
                      @click="switchMode('register')"
                    >
                      立即注册
                    </button>
                  </div>
                </form>

                <form v-else key="register" class="auth-form space-y-4" @submit.prevent="onRegisterSubmit">
                  <label class="block space-y-2">
                    <span class="text-xs font-semibold text-muted-foreground">昵称（可选）</span>
                    <input
                      v-model="nickname"
                      autocomplete="nickname"
                      class="auth-input"
                      placeholder="输入昵称"
                      type="text"
                    />
                  </label>

                  <label class="block space-y-2">
                    <span class="text-xs font-semibold text-muted-foreground">用户名</span>
                    <input
                      v-model="username"
                      autocomplete="username"
                      class="auth-input"
                      placeholder="输入用户名"
                      type="text"
                    />
                  </label>

                  <label class="block space-y-2">
                    <span class="text-xs font-semibold text-muted-foreground">密码</span>
                    <div class="auth-password-field">
                      <input
                        v-model="password"
                        autocomplete="new-password"
                        class="auth-input auth-input-password"
                        placeholder="输入密码"
                        :type="showRegisterPasswords ? 'text' : 'password'"
                      />
                      <button
                        class="auth-password-toggle"
                        :aria-label="showRegisterPasswords ? '隐藏密码' : '显示密码'"
                        type="button"
                        @click="showRegisterPasswords = !showRegisterPasswords"
                      >
                        {{ showRegisterPasswords ? '隐藏' : '显示' }}
                      </button>
                    </div>
                  </label>

                  <label class="block space-y-2">
                    <span class="text-xs font-semibold text-muted-foreground">确认密码</span>
                    <div class="auth-password-field">
                      <input
                        v-model="confirmPassword"
                        autocomplete="new-password"
                        class="auth-input auth-input-password"
                        placeholder="再次输入密码"
                        :type="showRegisterPasswords ? 'text' : 'password'"
                      />
                      <button
                        class="auth-password-toggle"
                        :aria-label="showRegisterPasswords ? '隐藏密码' : '显示密码'"
                        type="button"
                        @click="showRegisterPasswords = !showRegisterPasswords"
                      >
                        {{ showRegisterPasswords ? '隐藏' : '显示' }}
                      </button>
                    </div>
                  </label>

                  <button class="auth-submit" :disabled="isLoading" type="submit">
                    {{ isLoading ? '注册中...' : '注册并登录' }}
                  </button>

                  <div class="auth-switch-row">
                    <span>已有账号？</span>
                    <button
                      class="auth-switch-link"
                      data-testid="switch-to-login-link"
                      type="button"
                      @click="switchMode('login')"
                    >
                      返回登录
                    </button>
                  </div>
                </form>
              </Transition>
            </div>

          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-stage {
  --auth-accent: #0f766e;
  --auth-accent-soft: #14b8a6;
  --auth-secondary: #2563eb;
  --auth-secondary-soft: #38bdf8;
  --auth-warm: #f59e0b;
  background:
    radial-gradient(
      circle at 14% 16%,
      color-mix(in oklab, var(--auth-accent-soft) 22%, transparent) 0%,
      transparent 32%
    ),
    radial-gradient(
      circle at 84% 14%,
      color-mix(in oklab, var(--auth-warm) 16%, transparent) 0%,
      transparent 24%
    ),
    radial-gradient(
      circle at 82% 84%,
      color-mix(in oklab, var(--auth-secondary-soft) 18%, transparent) 0%,
      transparent 34%
    ),
    linear-gradient(
      160deg,
      color-mix(in oklab, var(--background) 88%, #f7fbff) 0%,
      color-mix(in oklab, var(--sidebar) 78%, #edf7ff) 44%,
      color-mix(in oklab, var(--background) 92%, #f8fafc) 100%
    );
}

.auth-grid > section {
  animation: auth-rise 460ms cubic-bezier(0.2, 0.75, 0.3, 1) both;
}

.auth-noise {
  position: absolute;
  inset: 0;
  opacity: 0.045;
  background-image: radial-gradient(circle at 1px 1px, var(--foreground) 1px, transparent 0);
  background-size: 22px 22px;
  mask-image: linear-gradient(180deg, rgba(255, 255, 255, 0.6), transparent 88%);
}

.auth-orb {
  position: absolute;
  border-radius: 9999px;
  opacity: 0.5;
  filter: blur(82px);
  will-change: transform;
  animation: auth-float 10.5s ease-in-out infinite;
}

.auth-orb-primary {
  top: -8rem;
  left: -6rem;
  width: 24rem;
  height: 24rem;
  background: color-mix(in oklab, var(--auth-accent-soft) 30%, transparent);
}

.auth-orb-secondary {
  right: -7rem;
  bottom: -8rem;
  width: 26rem;
  height: 26rem;
  background: color-mix(in oklab, var(--auth-secondary-soft) 32%, transparent);
  animation-delay: -3.5s;
}

.auth-panel {
  position: relative;
  overflow: hidden;
  border-radius: 0;
  border: 1px solid color-mix(in oklab, white 56%, var(--border));
  background:
    linear-gradient(
      180deg,
      color-mix(in oklab, white 82%, var(--card)) 0%,
      color-mix(in oklab, #f5fbff 54%, var(--card)) 46%,
      color-mix(in oklab, white 78%, var(--card)) 100%
    );
  box-shadow:
    0 36px 80px -44px color-mix(in oklab, #0f172a 42%, transparent),
    0 20px 44px -36px color-mix(in oklab, var(--auth-secondary-soft) 22%, transparent),
    0 1px 0 color-mix(in oklab, white 70%, transparent) inset;
  backdrop-filter: blur(22px);
  width: 100%;
  max-width: 37rem;
  margin-inline: auto;
  padding: clamp(1.45rem, 3.8vw, 2.35rem);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.auth-panel::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 4px;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--auth-accent) 90%, transparent) 0%,
    color-mix(in oklab, var(--auth-secondary) 84%, transparent) 62%,
    color-mix(in oklab, var(--auth-warm) 76%, transparent) 100%
  );
}

.auth-panel::after {
  content: '';
  position: absolute;
  top: -4.5rem;
  right: -4.5rem;
  height: 13rem;
  width: 13rem;
  border-radius: 9999px;
  background:
    radial-gradient(circle, color-mix(in oklab, var(--auth-warm) 16%, transparent) 0%, transparent 66%);
  opacity: 0.8;
  pointer-events: none;
}

.auth-header {
  display: grid;
  gap: 0.58rem;
}

.auth-badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.auth-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid color-mix(in oklab, var(--border) 78%, white 22%);
  background: color-mix(in oklab, white 72%, var(--background));
  padding: 0.34rem 0.72rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: color-mix(in oklab, var(--foreground) 82%, var(--muted-foreground));
}

.auth-badge-primary {
  border-color: color-mix(in oklab, var(--auth-accent) 22%, white 78%);
  background: linear-gradient(
    135deg,
    color-mix(in oklab, var(--auth-accent) 14%, white 86%) 0%,
    color-mix(in oklab, var(--auth-secondary) 10%, white 90%) 100%
  );
  color: color-mix(in oklab, var(--auth-accent) 72%, var(--foreground));
}

.auth-logo-badge {
  display: grid;
  height: 3.2rem;
  width: 3.2rem;
  place-items: center;
  border-radius: 1rem;
  border: 1px solid color-mix(in oklab, white 34%, transparent);
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--primary-foreground);
  background: linear-gradient(
    130deg,
    color-mix(in oklab, var(--auth-accent) 90%, black) 0%,
    color-mix(in oklab, var(--auth-secondary) 82%, var(--auth-accent)) 72%,
    color-mix(in oklab, var(--auth-warm) 74%, var(--auth-secondary)) 100%
  );
  box-shadow:
    0 18px 30px -18px color-mix(in oklab, var(--auth-secondary) 45%, transparent),
    0 1px 0 rgba(255, 255, 255, 0.25) inset;
}

.auth-kicker {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--auth-accent) 46%, var(--muted-foreground));
}

.auth-title {
  font-family: var(--font-serif);
  max-width: 12ch;
  font-size: clamp(1.72rem, 2.55vw, 2.2rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.auth-subtitle {
  max-width: 38ch;
  font-size: 0.92rem;
  line-height: 1.7;
  color: color-mix(in oklab, var(--foreground) 46%, var(--muted-foreground));
}

.auth-highlight-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.auth-highlight-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 9999px;
  border: 1px solid color-mix(in oklab, var(--border) 75%, white 25%);
  background: color-mix(in oklab, white 62%, var(--background));
  padding: 0.38rem 0.78rem;
  font-size: 0.76rem;
  font-weight: 600;
  color: color-mix(in oklab, var(--foreground) 80%, var(--muted-foreground));
}

.auth-mode-switch {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  padding: 0.4rem;
  border-radius: 1.05rem;
  border: 1px solid color-mix(in oklab, white 42%, var(--border));
  background:
    linear-gradient(
      180deg,
      color-mix(in oklab, white 58%, var(--background)) 0%,
      color-mix(in oklab, #eef7ff 36%, var(--background)) 100%
    );
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.55) inset;
}

.auth-mode-button {
  height: 2.45rem;
  border: 0;
  border-radius: 0.8rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--muted-foreground);
  background: transparent;
  transition:
    background-color 170ms ease,
    color 170ms ease,
    box-shadow 170ms ease,
    transform 170ms ease;
}

.auth-mode-button:hover {
  color: var(--foreground);
}

.auth-mode-button.is-active {
  color: var(--primary-foreground);
  background: linear-gradient(
    125deg,
    color-mix(in oklab, var(--auth-accent) 92%, black) 0%,
    color-mix(in oklab, var(--auth-secondary) 78%, var(--auth-accent)) 72%,
    color-mix(in oklab, var(--auth-secondary-soft) 68%, var(--auth-secondary)) 100%
  );
  box-shadow:
    0 10px 24px -18px color-mix(in oklab, var(--auth-secondary) 55%, transparent),
    0 1px 0 rgba(255, 255, 255, 0.2) inset;
}

.auth-form-shell {
  height: auto;
  min-height: 0;
  display: block;
}

.auth-form {
  width: 100%;
}

.auth-input {
  width: 100%;
  height: 3.1rem;
  border-radius: 1rem;
  border: 1px solid color-mix(in oklab, white 35%, var(--border));
  background: color-mix(in oklab, white 76%, var(--background));
  padding: 0 1rem;
  font-size: 0.9rem;
  color: var(--foreground);
  transition:
    box-shadow 170ms ease,
    border-color 170ms ease,
    background-color 170ms ease;
}

.auth-input::placeholder {
  color: color-mix(in oklab, var(--muted-foreground) 82%, white 18%);
}

.auth-input:hover {
  border-color: color-mix(in oklab, var(--auth-secondary) 16%, var(--border));
}

.auth-password-field {
  position: relative;
}

.auth-input-password {
  padding-right: 4.8rem;
}

.auth-input:focus {
  border-color: color-mix(in oklab, var(--auth-secondary) 52%, var(--ring));
  box-shadow:
    0 0 0 3px color-mix(in oklab, var(--auth-secondary-soft) 18%, transparent),
    0 14px 28px -20px color-mix(in oklab, var(--auth-secondary) 38%, transparent);
  background: color-mix(in oklab, white 84%, var(--background));
}

.auth-password-toggle {
  position: absolute;
  top: 50%;
  right: 0.95rem;
  border: 0;
  padding: 0;
  background: transparent;
  transform: translateY(-50%);
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--muted-foreground);
  transition: opacity 160ms ease, color 160ms ease;
}

.auth-password-toggle:hover {
  color: var(--foreground);
}

.auth-password-toggle:focus-visible {
  outline: none;
  opacity: 0.9;
}

.auth-submit {
  width: 100%;
  height: 3.1rem;
  border: 0;
  border-radius: 1rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--primary-foreground);
  background: linear-gradient(
    118deg,
    color-mix(in oklab, var(--auth-accent) 92%, black) 0%,
    color-mix(in oklab, var(--auth-secondary) 74%, var(--auth-accent)) 58%,
    color-mix(in oklab, var(--auth-secondary-soft) 66%, var(--auth-secondary)) 100%
  );
  box-shadow:
    0 18px 32px -18px color-mix(in oklab, var(--auth-secondary) 52%, transparent),
    0 1px 0 color-mix(in oklab, white 42%, transparent) inset;
  transition:
    transform 170ms ease,
    filter 170ms ease,
    box-shadow 170ms ease;
}

.auth-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 20px 36px -18px color-mix(in oklab, var(--auth-secondary) 48%, transparent);
  filter: saturate(1.08);
}

.auth-submit:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.auth-switch-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.32rem;
  font-size: 0.76rem;
  color: var(--muted-foreground);
}

.auth-switch-link {
  border: 0;
  background: transparent;
  font-size: inherit;
  font-weight: 700;
  color: color-mix(in oklab, var(--auth-accent) 72%, var(--auth-secondary));
  transition: opacity 160ms ease;
}

.auth-switch-link:hover {
  opacity: 0.8;
}

.auth-form-fade-enter-active,
.auth-form-fade-leave-active {
  transition:
    opacity 170ms ease,
    transform 170ms ease;
}

.auth-form-fade-enter-from,
.auth-form-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .auth-grid > section,
  .auth-orb {
    animation: none;
  }

  .auth-form-fade-enter-active,
  .auth-form-fade-leave-active,
  .auth-submit,
  .auth-input,
  .auth-mode-button {
    transition: none;
  }
}

@keyframes auth-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes auth-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  50% {
    transform: translate3d(0, -12px, 0);
  }
}
</style>

<style>
/* 非 scoped：scoped 内 :global(html)…子选择器会被错误合并到 html，导致整页 display:none */
html[data-theme-color='mono'] .login-view.auth-stage {
  background: var(--background);
}

html[data-theme-color='mono'] .login-view .auth-orb {
  display: none;
}

html[data-theme-color='mono'] .login-view .auth-noise {
  opacity: 0;
}

html[data-theme-color='mono'] .login-view .auth-panel {
  background: var(--card);
  box-shadow:
    0 24px 56px -36px color-mix(in oklab, black 40%, transparent),
    0 1px 0 color-mix(in oklab, white 40%, transparent) inset;
}

html[data-theme-color='mono'] .login-view .auth-panel::before {
  background: var(--primary);
}

html[data-theme-color='mono'] .login-view .auth-panel::after {
  display: none;
}

html[data-theme-color='mono'] .login-view .auth-logo-badge {
  background: var(--primary);
  box-shadow: 0 10px 28px -16px color-mix(in oklab, var(--primary) 58%, transparent);
}

html[data-theme-color='mono'] .login-view .auth-badge-primary,
html[data-theme-color='mono'] .login-view .auth-highlight-chip {
  background: color-mix(in oklab, var(--primary) 10%, var(--card));
  color: var(--foreground);
}

html[data-theme-color='mono'] .login-view .auth-mode-button.is-active {
  background: var(--primary);
}

html[data-theme-color='mono'] .login-view .auth-submit {
  background: var(--primary);
  box-shadow:
    0 14px 28px -16px color-mix(in oklab, var(--primary) 62%, transparent),
    0 1px 0 color-mix(in oklab, white 42%, transparent) inset;
}

html[data-theme-color='mono'] .login-view .auth-submit:hover:not(:disabled) {
  filter: none;
}
</style>
