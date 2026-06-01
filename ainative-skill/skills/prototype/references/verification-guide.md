# 原型生成后验证与修复指南

生成 `index.html` 后，**必须**按以下四步流程完成验证和修复，确保页面能正常在浏览器中打开。

---

## 第一步：检查 HTML 结构完整性

读取生成的 `index.html`，逐条确认：

- [ ] 文件大小 > 2KB（防止内容截断）
- [ ] 包含 `<!DOCTYPE html>`
- [ ] 包含 `<html` 和 `</html>`
- [ ] 包含 `<head>` / `</head>` 和 `<body>` / `</body>`
- [ ] `<script` 与 `</script>` 标签数量完全相等
- [ ] 包含 Vue3 CDN 引用：`fp.yangcong345.com/.../vue.global.prod.min`
- [ ] 包含 Element Plus CSS 引用：`fp.yangcong345.com/.../element-38098fc849a985d85be870cf856da4a1.css`（管理后台）
- [ ] 包含 Element Plus JS 引用：`fp.yangcong345.com/.../element-f355e990744f69cea3292feaf7b43b40.js`（管理后台）
- [ ] 若使用图表，包含 ECharts 引用：`fp.yangcong345.com/.../echarts.min-b91b9de4da1677c82825c679112da8b2.js`
- [ ] 所有 script/link 的 href/src 均以 `https://fp.yangcong345.com/` 开头，无 unpkg/jsdelivr/cdnjs 等其他 CDN 域名
- [ ] 包含 Vue 应用挂载：`.mount('#app')` 或 `.mount("#app")`
- [ ] JS 代码大括号 `{}` 已配对（无明显截断）

---

## 第二步：检查 JS 运行时安全性

审查 `<script>` 内的 JS 代码，排查以下高频运行时错误根因：

**空值访问（防止 `Uncaught TypeError: Cannot read properties of null/undefined`）**

- [ ] `setup()` 中所有 `ref` / `reactive` 变量均已给初始值，禁止使用 `null` 或 `undefined` 作为初始值：
  - 字符串 → `ref('')`
  - 数字 → `ref(0)`
  - 布尔 → `ref(false)`
  - 数组 → `ref([])`
  - 对象 → `ref({})` 或 `reactive({})`
- [ ] 访问嵌套属性时使用可选链 `?.`，例如 `item?.title` 而非 `item.title`
- [ ] `v-for` 绑定的数组初始值为 `[]`，不得为 `null`
- [ ] `v-if` 条件涉及对象属性时，先判断对象是否存在（`obj && obj.prop` 或 `obj?.prop`）

**DOM 操作安全**

- [ ] 若有 `document.getElementById` / `querySelector`，返回值使用前先判断非空

---

## 第三步：修复所有未通过项

若发现任何检查项未通过，**立即在文件中修复**：

| 问题类型                     | 修复方式                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 标签未闭合                   | 补全缺失的闭合标签                                                                                                                                                |
| `</script>` 数量不足         | 补全缺失的 `</script>`                                                                                                                                            |
| Vue 挂载调用缺失             | 在 script 末尾补全 `.mount('#app')`                                                                                                                               |
| `ref` 初始值为 `null`        | 改为对应类型的空值（`''` / `[]` / `{}`）                                                                                                                          |
| 嵌套属性访问无保护           | 改为可选链写法 `?.`                                                                                                                                               |
| 文件被截断                   | 重新生成完整文件                                                                                                                                                  |
| CDN 引用非 templates.md 标准 | 用正则 `href="https?://[^"]+"` 和 `src="https?://[^"]+"` 扫描所有外部 URL；若域名不是 `fp.yangcong345.com`，替换为 templates.md 第 166-177 行中对应资源的完整 URL |

修复完成后，**重新执行第一步和第二步**，直到所有检查项全部通过。

---

## 第四步：确认完成

所有检查通过后，输出确认信息：

```
✅ 原型验证通过
   路径：docs/prototype/{feature}/index.html
   文件大小：{实际大小}
   HTML 结构：完整
   JS 安全性：无空值风险
```
