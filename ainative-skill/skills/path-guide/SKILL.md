---
name: path-guide
description: 读取 PRD，扫描项目前端源码（路由、菜单、页面组件），生成自动化就绪的测试用例：优化 Given 为可执行前提、补充 When 导航路径、优化 Then 为页面可观测断言。Use when 需要优化 TEST.md 中的 Given/When/Then、补充导航路径、将用例转为 Playwright 脚本，或涉及 Element Plus 表单/Tab/下拉的定位规范。
---

# 生成自动化就绪测试用例

读取 PRD → 扫描前端源码 → 优化 TEST.md 中 **Given** 为可执行前提 + 补充 **When** 导航路径 + 优化 **Then** 为页面可观测断言，使用例可直接转化为 Playwright 脚本。

## 核心目标

TEST.md 中的测试用例存在三类问题：
1. **Given 不可执行**：如「设备列表中有至少 3 台设备」，Playwright 无法控制数据量
2. **When 路径抽象**：如「进入学习模式管理页面」，缺少具体菜单点击路径
3. **Then 不可自动化**：如数据库断言、硬编码数量、主观描述，无法映射为 Playwright 断言

本 skill 通过扫描源码，将用例升级为**自动化就绪**状态 —— Given 可映射为 Playwright 可执行前提，When 可映射为 Playwright action，Then 可映射为 Playwright assertion。

**优化前**：

```markdown
**When**：
- 老师在学习模式管理页面选择目标门店
- 在设备列表中找到目标设备，点击「设置默认模式」

**Then**：
- 数据库中 defaultMode 已更新为 free_learning
- 2秒内出现提示
```

**优化后**：

```markdown
**When**：
- 侧栏点击「任务学管理」→ 点击子菜单「门店选择」→ 等待门店列表表格加载
- 在门店列表中点击目标门店行的「学习模式管理」按钮 → 等待设备列表加载
- 在设备列表中找到目标设备，点击「设置默认模式」下拉框
- 选择「自主学习模式」→ 等待系统自动保存完成

**Then**：
- 出现保存成功提示
- 设备列表中该设备的默认模式列显示为「自主学习」
```

## 引用文件

| 文件 | 何时读取 |
| --- | --- |
| [path-guide-template.md](references/path-guide-template.md) | Step 1 必须；Step 4.5/4.6/4.7 需 Given/When/Then 格式与元素选择示例时 |
| [element-plus-locators.md](references/element-plus-locators.md) | Step 4.7 补充元素选择块、生成 Playwright 脚本需定位策略时 |

## 流程概览

1. 读 template → 2. 读 PRD → 3. 扫描源码 → 4. 补充 When → 4.5 优化 Given → 4.6 元素描述 → 4.7 元素选择 → 5. 优化 Then → 6. 标注可行性 → 7. 验收

## 生成流程

### Step 1: 读取模板（必须执行）

读取 [path-guide-template.md](references/path-guide-template.md) 了解导航步骤的书写规范。

### Step 2: 读取 PRD，提取页面与功能映射

从 PRD 中提取：

- 每个功能对应的页面（如「学习模式管理页面」「设备列表」）
- PRD 中描述的操作入口（如「进入任务学 → 学习模式管理」）
- 用户角色与操作权限

> PRD 中的路径描述仅作为扫描线索，实际路径必须以源码为准。

### Step 3: 扫描前端源码

#### 3.0 项目结构（根目录下）

| 目录 | 说明 | 扫描用途 |
| --- | --- | --- |
| ainative-backend | 后端 | 不扫描（path-guide 仅扫描前端） |
| ainative-shadow | 管理后台前端 | 管理后台相关用例的菜单、路由、页面组件 |
| ainative-app | 用户侧前端 | 用户侧相关用例的菜单、路由、页面组件 |

根据 PRD/用例涉及的端（管理后台 vs 用户侧）选择对应目录扫描。

#### 3.1 查找路由文件

```text
本项目：ainative-shadow → src/routers/modules/；ainative-app → [按实际路由目录]
通用：Vue 3: src/routers/ 或 src/router/；Vue 2: src/router/；React: src/routes/
```

从路由配置提取：

| 信息           | 来源                     | 用途                           |
| -------------- | ------------------------ | ------------------------------ |
| 菜单名称       | `meta.title`             | When 步骤中的「菜单名」       |
| 菜单可见性     | `meta.hidden`            | 判断是否需要通过页面内操作进入 |
| 路由层级       | 父子路由嵌套关系         | 确定菜单展开层级               |
| 动态参数       | 路径中的 `:param`        | 确定参数从哪一步获取           |

#### 3.2 分析页面组件

对路由指向的 `.vue` / `.tsx` 页面组件，提取：

- **导航按钮**：`<el-button @click="handleXxx">` 中的文案和跳转目标
- **路由跳转代码**：`router.push({ name: '...' })` 确定隐藏页面入口
- **表格操作列**：`<el-table-column label="操作">` 中的按钮文案
- **关键交互元素**：下拉框、搜索按钮、批量操作按钮等

**表单元素提取**（Element Plus）：

| 源码特征 | 提取内容 |
| --- | --- |
| `<el-form-item label="X">` 包裹 `<el-select>` | 区域 + label「X」+ 类型「下拉框」 |
| `<el-option :label="item.label">` 或静态 label | 下拉选项列表（如：抖音、微店、其他） |
| `<el-form-item label="X">` 包裹 `<el-input>` | 区域 + label「X」+ 类型「输入框」 |
| `<el-form-item label="X">` 包裹 `<el-date-picker>` | 区域 + label「X」+ 类型「日期选择器」 |
| `<el-table-column label="X">` | 表格列「X」 |
| `<el-button>文案</el-button>` | 按钮「文案」 |
| `<el-dialog>` + `title` / slot | 对话框「标题」 |
| `<el-tabs>` + `<el-tab-pane label="X">` | Tab「X」 |

#### 3.3 Element Plus 侧栏菜单结构

| 结构 | 源码特征 |
| --- | --- |
| `el-menu` > `el-sub-menu` > `el-menu-item` | `el-sub-menu__title` 点击展开子菜单，`el-menu-item` 为子项 |
| 子菜单展开 | 需先点击一级菜单展开，再点击子菜单项 |

#### 3.4 重点关注：隐藏路由

路由 `meta.hidden === true` 的页面不在侧栏菜单中显示，必须找到其进入方式：

| 进入方式         | 代码特征                                 |
| ---------------- | ---------------------------------------- |
| 表格行内按钮     | `<el-button @click="handleXxx(row)">`    |
| JS 路由跳转      | `router.push({ name: '...', params })` |
| 页面内链接       | `<router-link :to="...">`               |

### Step 4: 补充 When 导航路径

逐个检查 TEST.md 中的测试用例：

1. **匹配用例**：When 步骤中提到的页面/操作与 PRD 功能页面对应
2. **替换抽象步骤**：将「进入 XX 页面」替换为具体的菜单点击路径
3. **保留业务步骤**：只替换导航步骤，不改动业务操作

#### When 补充规则

| 规则                   | 说明                                                         |
| ---------------------- | ------------------------------------------------------------ |
| **菜单文案一致**       | When 中的「菜单名」必须与路由 `meta.title` 完全一致         |
| **标注等待点**         | 每步点击后标注等待内容，如「等待表格加载」「等待子菜单展开」 |
| **隐藏路由说明入口**   | 不在菜单中的页面，必须写明从哪个页面的哪个按钮进入           |
| **动态参数说明来源**   | 如「点击目标门店行的 XX」而非「进入 /path/:storeId」         |
| **步骤用 → 连接**      | 导航链路中多个操作用 → 连接，一行表达完整路径                |

#### 导航步骤书写格式

```text
侧栏点击「一级菜单名」→ 等待子菜单展开 → 点击子菜单「二级菜单名」→ 等待[页面内容]加载
→ 点击[目标行/区域]的「按钮名」→ 等待[下一页内容]加载
```

### Step 4.5: 优化 Given 前置条件（Playwright 可执行化）

Given 描述脚本运行前的初始状态。优化目标是将 Given 转化为 Playwright 脚本可以**执行或验证**的 UI 操作/状态。

#### Given 优化规则

| 原始 Given 类型 | 问题 | 优化方式 |
| --- | --- | --- |
| 数据数量要求（"至少 3 台设备"） | Playwright 无法控制数据量 | 改为"页面设备列表已加载且有可见设备行"，不指定数量 |
| 数据状态要求（"设备当前为任务学模式"） | Playwright 无法预设数据库 | 删除或改为"设备列表中存在可操作的设备" |
| 用户角色/登录状态 | Playwright 可以处理 | 保留，描述为"已通过账号密码登录管理后台" |
| 权限要求（"有目标门店的设备查看权限"） | 隐含在登录账号中 | 改为"已登录有权限的账号" |
| 模拟故障（"网络异常"） | 需要 Playwright route 拦截 | 保留，补充说明"通过 page.route 拦截接口模拟" |
| 复合前提（角色 + 数据 + 状态） | 拆分可执行/不可执行 | 仅保留 Playwright 可操作部分 |

#### Given 禁止写法

见 [path-guide-template.md](references/path-guide-template.md) 一、Given 禁止写法。

### Step 4.6: 元素描述规范（辅助 Playwright 定位）

When/Then 中须明确「区域 + label + 控件类型」。格式与示例见 [path-guide-template.md](references/path-guide-template.md) 二、元素描述规范。

### Step 4.7: 补充元素选择信息

涉及表单/下拉/Tab/按钮的用例，在 Then 之后增加 **元素选择** 块。格式见 [path-guide-template.md](references/path-guide-template.md) TC-CHANNEL-001；类型速查见 [element-plus-locators.md](references/element-plus-locators.md)。

书写规则：按 When 步骤顺序、仅列关键元素、参数与源码一致、简单用例可省略。

### Step 5: 优化 Then 断言（与 When 联动）

When 步骤确定后，Then 必须只描述 **When 最后一步所在页面上可直接观测到的 UI 变化**，确保每条 Then 都能映射为 Playwright 断言。

#### Then 优化规则

| 规则 | 说明 |
| --- | --- |
| **页面可观测** | 每条 Then 必须是用户在当前页面上肉眼可见的变化 |
| **与 When 终点页面一致** | Then 断言的目标元素必须存在于 When 最后一步到达的页面上 |
| **可映射 Playwright 断言** | 每条 Then 需对应一种断言类型：元素可见、文本包含、元素状态变化 |

#### When 操作类型 → Then 断言模式

| When 操作类型 | Then 断言模式 |
| --- | --- |
| 下拉框选择（自动保存） | 出现保存成功提示 + 目标字段显示值更新 |
| 按钮点击（提交表单） | 出现操作成功提示 + 列表/页面内容更新 |
| 筛选 + 搜索 | 列表仅展示符合条件的记录 |
| 批量操作 + 确认对话框 | 出现批量成功提示 + 选中项状态更新 |
| 页面跳转 | 目标页面关键内容已加载并可见 |

#### Then 禁止写法

| 禁止类型 | 错误示例 | 原因 |
| --- | --- | --- |
| 数据库断言 | `数据库中 defaultMode 已更新` | Playwright 无法查询数据库 |
| 接口断言 | `接口返回 xxx 字段` | UI 测试不直接验证接口 |
| 硬编码时间 | `2秒内出现提示` | 环境差异导致 flaky，改为「出现xxx提示」 |
| 硬编码数量 | `已成功设置 3 台设备` | 依赖运行时数据，改为「出现成功数量反馈」 |
| 主观描述 | `便于快速找到老师设备` | 无法自动化验证 |
| 跨页面断言 | 断言跳转前页面的状态 | When 包含页面跳转时，只断言最终页面 |
| 模糊形容/主观一致 | `「X」与「Y」展示形式一致`、`「X」与 A、B 等选项展示形式一致` | 无法自动化验证「一致」，应改为「选项列表中「X」可见」或「表格某行 A 列显示为「X」」 |

### Step 6: 标注自动化可行性

对每个用例判断是否可通过 UI 自动化验证：

| 场景 | 处理方式 |
| --- | --- |
| When/Then 均为 UI 操作 | 保持 `类型: 管理后台` 等原有类型 |
| When 涉及后台定时任务、cron job | 在属性表 `类型` 列标注为 `通用（不可UI自动化）` |
| When 涉及数据库直接操作 | 在属性表 `类型` 列标注为 `通用（不可UI自动化）` |
| Then 无法在页面上验证 | 在属性表 `类型` 列标注为 `通用（不可UI自动化）` |

### Step 7: 验收检查

- [ ] When 中的导航路径与源码 `meta.title` 和按钮文案一致
- [ ] 隐藏路由的进入方式已在 When 中写明
- [ ] 每步导航操作后标注了等待点
- [ ] 无导航跳级（如直接从首页到三级页面，缺少中间步骤）
- [ ] Then 每条断言均为页面可观测结果，可映射为 Playwright 断言
- [ ] Then 无数据库断言、接口断言、硬编码时间/数量、主观描述
- [ ] 非 UI 可验证用例已在属性表标注 `不可UI自动化`
- [ ] Given 中无硬编码数据量、指定数据状态或数据库条件
- [ ] Given 仅包含 Playwright 可执行的操作（登录）或可观测的 UI 状态
- [ ] PRD 涉及的所有功能页面对应的用例都已处理
- [ ] 涉及表单/下拉/Tab/按钮的用例已补充元素选择块，类型与参数与源码一致
- [ ] Tab 内表单/表格定位使用 `.el-tab-pane[aria-hidden="false"]`，未使用 `.el-tab-pane.is-active`
- [ ] 下拉选项定位使用 `getByRole('listbox').getByRole('option', { name: X })`，未使用 `.el-select-dropdown` + `.last()`
- [ ] Then 无「展示形式一致」「样式一致」等模糊形容，每条均可映射为 Playwright 断言

## Element Plus 定位映射

供生成 Playwright 脚本时参考。完整映射见 [element-plus-locators.md](references/element-plus-locators.md)。

**常见定位错误 → 正确写法**：

| 错误写法 | 正确写法 |
| --- | --- |
| `.el-tab-pane.is-active` | `.el-tab-pane[aria-hidden="false"]` |
| `page.locator('.el-select-dropdown, .el-popper').last()` | `page.getByRole('listbox').getByRole('option', { name: 'X' })` |

## 禁止事项

1. ❌ 不扫描源码，直接根据 PRD 描述编写路径
2. ❌ 菜单/按钮文案与源码不一致
3. ❌ 隐藏路由的进入方式缺失
4. ❌ 导航步骤跳级（省略中间层级）
5. ❌ 生成独立文件（必须直接修改 TEST.md 中的用例）
6. ❌ Then 中写数据库断言、接口断言、硬编码时间/数量或主观描述
7. ❌ Then 断言跨页面（断言必须针对 When 最后一步所在页面）
8. ❌ Given 中写硬编码数据数量（如"至少 3 台"）或指定数据库状态
9. ❌ Tab 内表单/表格的定位未限定在 `.el-tab-pane[aria-hidden="false"]` 内，或使用 `.or()` 等组合导致匹配多个元素（strict mode violation）
10. ❌ 下拉选项使用 `page.locator('.el-select-dropdown, .el-popper').last()`（多 Tab 弹窗会匹配隐藏元素导致超时），改用 `getByRole('listbox').getByRole('option', { name: X })`
11. ❌ Then 中写「展示形式一致」「样式一致」等模糊形容，改为「选项列表中「X」可见」或「表格某行某列显示为「X」」等可断言表述
