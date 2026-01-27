import { App } from "vue"

// @ts-ignore
const res = require.context('./modules', false, /.+\.ts|js$/)

export const installDirectives = (app: App<Element>) => {
  res.keys().forEach((key: string) => {
    const module = res(key)
    if (module) {
      Object.keys(module)?.forEach(item => {
        app.directive(item, module[item])
      })
    }
  })
}
