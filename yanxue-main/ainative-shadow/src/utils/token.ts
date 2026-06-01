const AUTH_KEY = 'authorization'

export const getToken = () => {
  return window.localStorage.getItem(AUTH_KEY)
}

export const resetToken = () => {
  window.localStorage.removeItem(AUTH_KEY)
}

export const setToken = (token: string) => {
  window.localStorage.setItem(AUTH_KEY, token)
}
