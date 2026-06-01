<script setup lang="ts">
import { useLoginPage } from './use-login-page'

defineOptions({
  name: 'LoginView',
})

const vm = useLoginPage()
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
              <div class="brand-logo-badge">
                <img src="/logo.png" alt="葱搭" class="brand-logo-image" />
              </div>
              <p class="auth-kicker">葱搭工作空间</p>
              <h1 class="auth-title">{{ vm.mode === 'login' ? '欢迎回来' : '创建新账号' }}</h1>
              <p class="auth-subtitle">
                {{ vm.mode === 'login' ? '登录后继续你的项目、任务与自动化流程。' : '注册后自动登录，立即开始使用 葱搭平台。' }}
              </p>
            </header>

            <div class="auth-mode-switch" role="tablist" aria-label="登录注册切换">
              <button
                class="auth-mode-button"
                :class="vm.mode === 'login' ? 'is-active' : ''"
                data-testid="switch-to-login"
                type="button"
                @click="vm.switchMode('login')"
              >
                登录
              </button>
              <button
                class="auth-mode-button"
                :class="vm.mode === 'register' ? 'is-active' : ''"
                data-testid="switch-to-register"
                type="button"
                @click="vm.switchMode('register')"
              >
                注册
              </button>
            </div>

            <div class="auth-form-shell">
              <Transition name="auth-form-fade" vm.mode="out-in">
                <form
                  v-if="vm.mode === 'login'"
                  key="login"
                  class="auth-form space-y-4"
                  @submit.prevent="vm.onLoginSubmit"
                >
                  <label class="block space-y-2">
                    <span class="text-xs font-semibold text-muted-foreground">用户名</span>
                    <input
                      v-model="vm.username"
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
                        v-model="vm.password"
                        autocomplete="current-password"
                        class="auth-input auth-input-vm.password"
                        placeholder="输入密码"
                        :type="vm.showLoginPassword ? 'text' : 'password'"
                      />
                      <button
                        class="auth-password-toggle"
                        :aria-label="vm.showLoginPassword ? '隐藏密码' : '显示密码'"
                        type="button"
                        @click="vm.showLoginPassword = !vm.showLoginPassword"
                      >
                        {{ vm.showLoginPassword ? '隐藏' : '显示' }}
                      </button>
                    </div>
                  </label>

                  <button class="auth-submit" :disabled="vm.isLoading" type="submit">
                    {{ vm.isLoading ? '登录中...' : '登录' }}
                  </button>

                  <div class="auth-switch-row">
                    <span>没有账号？</span>
                    <button
                      class="auth-switch-link"
                      data-testid="switch-to-register-link"
                      type="button"
                      @click="vm.switchMode('register')"
                    >
                      立即注册
                    </button>
                  </div>
                </form>

                <form v-else key="register" class="auth-form space-y-4" @submit.prevent="vm.onRegisterSubmit">
                  <label class="block space-y-2">
                    <span class="text-xs font-semibold text-muted-foreground">昵称（可选）</span>
                    <input
                      v-model="vm.nickname"
                      autocomplete="nickname"
                      class="auth-input"
                      placeholder="输入昵称"
                      type="text"
                    />
                  </label>

                  <label class="block space-y-2">
                    <span class="text-xs font-semibold text-muted-foreground">用户名</span>
                    <input
                      v-model="vm.username"
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
                        v-model="vm.password"
                        autocomplete="new-password"
                        class="auth-input auth-input-vm.password"
                        placeholder="输入密码"
                        :type="vm.showRegisterPasswords ? 'text' : 'password'"
                      />
                      <button
                        class="auth-password-toggle"
                        :aria-label="vm.showRegisterPasswords ? '隐藏密码' : '显示密码'"
                        type="button"
                        @click="vm.showRegisterPasswords = !vm.showRegisterPasswords"
                      >
                        {{ vm.showRegisterPasswords ? '隐藏' : '显示' }}
                      </button>
                    </div>
                  </label>

                  <label class="block space-y-2">
                    <span class="text-xs font-semibold text-muted-foreground">确认密码</span>
                    <div class="auth-password-field">
                      <input
                        v-model="vm.confirmPassword"
                        autocomplete="new-password"
                        class="auth-input auth-input-vm.password"
                        placeholder="再次输入密码"
                        :type="vm.showRegisterPasswords ? 'text' : 'password'"
                      />
                      <button
                        class="auth-password-toggle"
                        :aria-label="vm.showRegisterPasswords ? '隐藏密码' : '显示密码'"
                        type="button"
                        @click="vm.showRegisterPasswords = !vm.showRegisterPasswords"
                      >
                        {{ vm.showRegisterPasswords ? '隐藏' : '显示' }}
                      </button>
                    </div>
                  </label>

                  <button class="auth-submit" :disabled="vm.isLoading" type="submit">
                    {{ vm.isLoading ? '注册中...' : '注册并登录' }}
                  </button>

                  <div class="auth-switch-row">
                    <span>已有账号？</span>
                    <button
                      class="auth-switch-link"
                      data-testid="switch-to-login-link"
                      type="button"
                      @click="vm.switchMode('login')"
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

<style scoped src="./login-auth-scoped.css"></style>

<style src="./login-auth-global.css"></style>
