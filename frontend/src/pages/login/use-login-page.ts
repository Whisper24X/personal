import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@app/composables/useAuth'
import { useMessage } from '@app/composables/useMessage'
import {
  parseLoginRedirectQuery,
  resolveAuthenticatedRedirectPath,
} from '@app/utils/router/post-auth'
import { toErrorMessage } from '@api/shared/to-error-message'

export type AuthMode = 'login' | 'register'

export type LoginPageContext = ReturnType<typeof useLoginPage>

export function useLoginPage() {
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

  return reactive({
    confirmPassword,
    isLoading,
    mode,
    nickname,
    onLoginSubmit,
    onRegisterSubmit,
    password,
    showLoginPassword,
    showRegisterPasswords,
    switchMode,
    username,
  })
}
