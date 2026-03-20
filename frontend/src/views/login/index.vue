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
  <div class="auth-stage relative h-[var(--app-viewport-height)] overflow-hidden text-foreground">
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
              <div class="auth-logo-badge">AI</div>
              <p class="auth-kicker">AI Native Workspace</p>
              <h1 class="auth-title">{{ mode === 'login' ? '欢迎回来' : '创建新账号' }}</h1>
              <p class="auth-subtitle">
                {{ mode === 'login' ? '登录后继续你的项目、任务与自动化流程。' : '注册后自动登录，立即开始使用 AI Native 平台。' }}
              </p>
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
  background:
    radial-gradient(
      circle at 12% 16%,
      color-mix(in oklab, var(--primary) 14%, transparent) 0%,
      transparent 34%
    ),
    radial-gradient(
      circle at 88% 82%,
      color-mix(in oklab, var(--secondary) 16%, transparent) 0%,
      transparent 36%
    ),
    linear-gradient(
      160deg,
      color-mix(in oklab, var(--sidebar) 92%, transparent) 0%,
      color-mix(in oklab, var(--background) 84%, transparent) 48%,
      color-mix(in oklab, var(--sidebar) 94%, transparent) 100%
    );
}

.auth-grid > section {
  animation: auth-rise 460ms cubic-bezier(0.2, 0.75, 0.3, 1) both;
}

.auth-noise {
  position: absolute;
  inset: 0;
  opacity: 0.06;
  background-image: radial-gradient(circle at 1px 1px, var(--foreground) 1px, transparent 0);
  background-size: 24px 24px;
}

.auth-orb {
  position: absolute;
  border-radius: 9999px;
  opacity: 0.44;
  filter: blur(72px);
  will-change: transform;
  animation: auth-float 10.5s ease-in-out infinite;
}

.auth-orb-primary {
  top: -8rem;
  left: -6rem;
  width: 24rem;
  height: 24rem;
  background: color-mix(in oklab, var(--primary) 28%, transparent);
}

.auth-orb-secondary {
  right: -7rem;
  bottom: -8rem;
  width: 26rem;
  height: 26rem;
  background: color-mix(in oklab, var(--secondary) 30%, transparent);
  animation-delay: -3.5s;
}

.auth-panel {
  position: relative;
  overflow: hidden;
  border-radius: 1.6rem;
  border: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
  background:
    linear-gradient(
      165deg,
      color-mix(in oklab, var(--card) 92%, transparent) 0%,
      color-mix(in oklab, var(--card) 86%, transparent) 100%
    );
  box-shadow:
    0 24px 56px -36px color-mix(in oklab, black 40%, transparent),
    0 1px 0 color-mix(in oklab, white 40%, transparent) inset;
  backdrop-filter: blur(18px);
  width: 100%;
  max-width: 35rem;
  margin-inline: auto;
  padding: clamp(1.35rem, 3.6vw, 2.1rem);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.auth-panel::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--primary) 88%, transparent) 0%,
    color-mix(in oklab, var(--secondary) 84%, transparent) 100%
  );
}

.auth-header {
  display: grid;
  gap: 0.42rem;
}

.auth-logo-badge {
  display: grid;
  height: 2.95rem;
  width: 2.95rem;
  place-items: center;
  border-radius: 0.9rem;
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--primary-foreground);
  background: linear-gradient(
    120deg,
    color-mix(in oklab, var(--primary) 90%, black) 0%,
    color-mix(in oklab, var(--secondary) 84%, var(--primary)) 100%
  );
  box-shadow: 0 10px 28px -16px color-mix(in oklab, var(--primary) 58%, transparent);
}

.auth-kicker {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.auth-title {
  font-family: var(--font-serif);
  font-size: clamp(1.54rem, 2.25vw, 1.95rem);
  font-weight: 700;
  line-height: 1.16;
  letter-spacing: -0.02em;
}

.auth-subtitle {
  max-width: 34ch;
  font-size: 0.89rem;
  line-height: 1.62;
  color: var(--muted-foreground);
}

.auth-mode-switch {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
  padding: 0.35rem;
  border-radius: 0.95rem;
  border: 1px solid color-mix(in oklab, var(--border) 84%, transparent);
  background: color-mix(in oklab, var(--background) 88%, transparent);
}

.auth-mode-button {
  height: 2.25rem;
  border: 0;
  border-radius: 0.72rem;
  font-size: 0.79rem;
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
    120deg,
    color-mix(in oklab, var(--primary) 88%, black) 0%,
    color-mix(in oklab, var(--secondary) 78%, var(--primary)) 100%
  );
  box-shadow: var(--shadow-sm);
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
  height: 2.95rem;
  border-radius: 0.9rem;
  border: 1px solid color-mix(in oklab, var(--border) 90%, transparent);
  background: color-mix(in oklab, var(--background) 93%, transparent);
  padding: 0 0.9rem;
  font-size: 0.9rem;
  color: var(--foreground);
  transition:
    box-shadow 170ms ease,
    border-color 170ms ease,
    background-color 170ms ease;
}

.auth-password-field {
  position: relative;
}

.auth-input-password {
  padding-right: 4.3rem;
}

.auth-input:focus {
  border-color: color-mix(in oklab, var(--primary) 56%, var(--ring));
  box-shadow:
    0 0 0 3px color-mix(in oklab, var(--primary) 18%, transparent),
    0 10px 20px -16px color-mix(in oklab, var(--primary) 46%, transparent);
  background: color-mix(in oklab, var(--background) 98%, transparent);
}

.auth-password-toggle {
  position: absolute;
  top: 50%;
  right: 0.85rem;
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
  height: 2.95rem;
  border: 0;
  border-radius: 0.92rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--primary-foreground);
  background: linear-gradient(
    118deg,
    color-mix(in oklab, var(--primary) 92%, black) 0%,
    color-mix(in oklab, var(--primary) 70%, var(--secondary)) 58%,
    color-mix(in oklab, var(--secondary) 86%, var(--primary)) 100%
  );
  box-shadow:
    0 14px 28px -16px color-mix(in oklab, var(--primary) 62%, transparent),
    0 1px 0 color-mix(in oklab, white 42%, transparent) inset;
  transition:
    transform 170ms ease,
    filter 170ms ease,
    box-shadow 170ms ease;
}

.auth-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 16px 28px -16px color-mix(in oklab, var(--primary) 58%, transparent);
  filter: saturate(1.06);
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
  color: var(--primary);
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
