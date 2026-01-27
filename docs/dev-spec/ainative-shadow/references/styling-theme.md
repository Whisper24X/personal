# 样式与主题规范

## 样式入口
- 全局样式入口：`ainative-shadow/src/assets/styles/index.scss`
- Tailwind 入口：`ainative-shadow/src/assets/styles/core/tailwind.css`
- 在 `src/main.ts` 中全量引入

## Tailwind 使用规范
- 推荐在模板中优先使用 Tailwind 工具类进行布局
- 需要全局样式时统一放在 `src/assets/styles/custom/`

## SCSS 与主题
- Vite 会自动注入以下资源，可直接使用变量与 mixin：
  - `@styles/core/el-light.scss`
  - `@styles/core/mixin.scss`
- Element Plus 主题覆盖集中在：
  - `@styles/core/el-light.scss`
  - `@styles/core/el-dark.scss`
  - `@styles/core/el-ui.scss`

## 组件样式规范
- 组件内样式优先使用 `lang="scss"` + `scoped`
- 跨页面复用的样式抽到 `src/assets/styles/custom/` 下
- 主题切换相关样式放入 `src/assets/styles/core/`
