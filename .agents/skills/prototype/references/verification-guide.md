# 原型生成后验证与修复指南

生成 `index.html` 后，**必须**通过运行时验证。采用「脚本验证 + 错误驱动修复」，遇到新问题按实际错误信息修复即可。

**前置条件**：首次使用需安装 Playwright 浏览器：`cd skills/playwright-skill/skills/playwright-skill && npm run setup`

---

## 验证流程

### 第一步：运行验证脚本

```bash
node skills/prototype/scripts/verify.js <path-to-index.html>
```

示例（从项目根或 workspace 根执行）：

```bash
node skills/prototype/scripts/verify.js docs/prototype/index.html
```

### 第二步：若有错误，按错误信息修复

| 错误类型                                    | 修复方式                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `Cannot read properties of null/undefined`  | 使用可选链 `?.`，或确保 `ref`/`reactive` 初始值非 null（用 `''`/`[]`/`{}`）             |
| `compiler-30` / `v-else` 相关               | 将 `v-else` 改为 `v-if="!condition"`，`v-else-if` 改为 `v-if="condition2"`              |
| 文件过小 / 截断                             | 重新生成完整文件（需 > 2KB）                                                            |
| CDN / 网络加载失败                          | 确认所有 script/link 使用 [templates.md](templates.md) 指定的 `fp.yangcong345.com` 链接 |
| `#app` 未挂载                               | 检查 `.mount('#app')` 是否存在，script 是否完整；管理后台需 `.use(ElementPlus)`         |
| `ElMessage is not defined`                  | 在 script 顶部添加 `const { ElMessage, ElMessageBox } = ElementPlus;`                   |
| `echarts is not defined`                    | 确认已引入 ECharts CDN，且在 `onMounted` 中调用                                         |
| `[warning] Extraneous non-props attributes` | 检查组件 attribute 透传，或加 `inheritAttrs: false`                                     |

### 第三步：重复直到通过

修复后重新运行脚本，直到输出 `✅ 原型验证通过`。

---

## 编码原则（生成时遵循，减少错误）

- **防御式编码**：`ref` 用空值初始化（`''`/`[]`/`{}`），访问嵌套属性用 `?.`
- **模板安全**：避免 `v-else`，用 `v-if="!condition"` 替代；避免 `v-else-if`
- **CDN**：仅使用 [templates.md](templates.md) 指定链接，禁止 unpkg/jsdelivr 等
- **管理后台必须**：`.use(ElementPlus)` 挂载后才能使用 el-\* 组件

---

## 完成确认

验证通过后输出：

```
✅ 原型验证通过
   路径：docs/prototype/{feature}/index.html
   文件大小：{实际大小}
```
