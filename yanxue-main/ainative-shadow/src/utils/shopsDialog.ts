const SHOPS_DIALOG_KEY = 'ShopsDialog'

export const getShopsDialog = () => {
  return window.localStorage.getItem(SHOPS_DIALOG_KEY)
}

export const resetShopsDialog = () => {
  window.localStorage.removeItem(SHOPS_DIALOG_KEY)
}

export const setShopsDialog = (token: string) => {
  window.localStorage.setItem(SHOPS_DIALOG_KEY, token)
}
