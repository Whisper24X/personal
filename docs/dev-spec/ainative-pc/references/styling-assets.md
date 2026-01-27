# 样式与资源规范

## 全局样式
- 全局样式入口为 `src/assets/main.css`
- `src/assets/main.css` 内会引入 `src/assets/base.css`
- 需要全局生效的样式放在上述文件中

## 组件样式
- 组件内样式优先使用 `scoped`
- 公共样式建议提取到 `src/assets/` 或复用组件中

## 静态资源
- 代码内引用的图片等资源建议放在 `src/assets/`
- 需要原样拷贝的静态资源放在 `public/`
