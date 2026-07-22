# Element Plus 组件 → Playwright 定位映射

供 Playwright 浏览器自动化执行时参考，确保 When/Then 中的元素描述能映射为稳定定位策略。

## 类型 → 参数 → 定位速查表（供元素选择块引用）

| 类型 | 参数 | 定位策略 |
| --- | --- | --- |
| 表单项+下拉框 | label=X | `.el-form-item` filter hasText X + `.el-select` |
| 表单项+输入框 | label=X | `.el-form-item` filter hasText X + `.el-input input` |
| 表单项+日期选择器 | label=X | `.el-form-item` filter hasText X + `.el-date-editor` |
| 下拉选项 | 文本=X | `getByRole('listbox').getByRole('option', { name: X })`。**禁止** `.el-select-dropdown, .el-popper` + `.last()` |
| 侧栏一级菜单 | 文本=X | getByRole('link') or .el-sub-menu__title |
| 侧栏子菜单 | 文本=X | getByRole('link') or .el-menu-item |
| 按钮 | 文本=X | getByRole('button') or locator |
| Tab | 文本=X | .el-tabs__item filter hasText X |
| Tab 内表单/表格 | 在 Tab X 内 | .el-tab-pane[aria-hidden="false"] .el-form 或 .el-tab-pane.nth(i) |
| 成功提示 | — | .el-message--success |
| 对话框 | 标题=X | .el-dialog filter hasText X |
| 表格列 | label=X | .el-table th filter hasText X |

## 完整映射表

| 组件 | Playwright 定位策略 |
| --- | --- |
| 表单项 + 下拉框 | `page.locator('.el-form-item').filter({ hasText: 'X' }).locator('.el-select').first()` |
| 下拉选项 | `page.getByRole('listbox').getByRole('option', { name: '选项名' })`。**禁止** `page.locator('.el-select-dropdown, .el-popper').last()`（多 Tab 弹窗会匹配 60+ 个 dropdown，last 多为隐藏，导致 waitFor visible 超时） |
| 表单项 + 输入框 | `page.locator('.el-form-item').filter({ hasText: 'X' }).locator('.el-input input')` |
| 表单项 + 日期选择器 | `page.locator('.el-form-item').filter({ hasText: 'X' }).locator('.el-date-editor')` |
| 表格列 | `page.locator('.el-table th').filter({ hasText: 'X' })` 或 `page.locator('th:has-text("X")')` |
| 成功提示 | `page.locator('.el-message--success')` |
| 对话框 | `page.locator('.el-dialog').filter({ hasText: '标题' })` |
| Tab | `page.getByRole('tab', { name: 'X' })` 或 `page.locator('.el-tabs__item').filter({ hasText: 'X' })` |
| Tab 内表单/表格 | `dialog.locator('.el-tab-pane[aria-hidden="false"] .el-form')` 或 `dialog.locator('.el-tab-pane').nth(i).locator('.el-form')`。Element Plus pane 无 `is-active`，用 `aria-hidden="false"` |

## Tab 内表单定位禁止

| 禁止 | 原因 |
| --- | --- |
| `.el-tab-pane.is-active` | Element Plus pane 不挂载 `is-active`（仅 tab 头部有），会超时 |
| `.el-tabs__content, .el-tab-pane` 不加 `[aria-hidden="false"]` 限定 | 匹配多个 pane，易导致 strict mode violation |
| `.or(dialog.locator('.el-form'))` 等宽泛 or 组合 | 多个 form 叠加，匹配数激增 |
| 用 `filter(hasText)` 在多个 pane 上查找 | 每个 pane 可能含相同文案，匹配多个 |
| `page.locator('.el-select-dropdown, .el-popper').last()` 选下拉选项 | 多 Tab 弹窗中会匹配 60+ 个 dropdown，last 多为隐藏，waitFor visible 超时。**正确**：`page.getByRole('listbox').getByRole('option', { name: X })` |
