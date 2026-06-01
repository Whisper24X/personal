const DEPT_DIALOG_KEY = 'DeptDialog'

export const getDeptDialog = () => {
  return window.localStorage.getItem(DEPT_DIALOG_KEY)
}

export const resetDeptDialog = () => {
  window.localStorage.removeItem(DEPT_DIALOG_KEY)
}

export const setDeptDialog = (token: string) => {
  window.localStorage.setItem(DEPT_DIALOG_KEY, token)
}
