---
name: ui-automation-prep
description: Use when ui-automation-master routes to UI automation Prep because TEST.md is missing, incomplete, or not executable.
---

# UI Automation Prep

## 作用

把 PRD / 变更 / diff / 现有测试文档，收敛成可执行的 `TEST.md`。
这是子 skill 执行层，只在 `ui-automation-master` 路由到 `Prep` 时使用。

## 负责范围

- 生成或改写测试用例
- 补齐 `Given / When / Then`
- 补齐 `覆盖范围 / 本轮是否执行 / 环境前提 / 不执行原因`
- 把抽象路径改成可执行导航
- 把 `Then` 收敛成页面可观测断言
- 必要时补元素选择提示，方便后续自动化执行
- UI 用例必须保持 BDD 结构与属性表
- 复杂导航必须遵循 Element Plus 侧栏/菜单/表格定位语义

## 输入

- PRD、设计、变更说明、diff
- 当前 `TEST.md` 或待优化测试稿
- 任务目录中的当前上下文
- 旧模板与协议参考：
  - `skills/ui-automation-prep/references/test-template.md`
  - `skills/ui-automation-prep/references/case-template-v2-lite.md`
  - `skills/ui-automation-prep/references/path-guide-template.md`
  - `skills/ui-automation-prep/references/element-plus-locators.md`

## 必须继承的协议

- `TEST.md` 仍需维持 `# 测试文档 -> ## 第一部分：测试用例` 的结构
- 每条 case 必须有属性表、Given、When、Then
- 生成 UI case 前必须先判定运行形态：原生小程序默认不可直接 Playwright 执行；Taro 跨端项目优先转为目标仓启动时的 H5 入口执行，类型标注为 `H5端`。
- 小程序需求只有在无可用 H5 入口、或断言依赖原生小程序专属能力时，才标注 `本轮是否执行=否`、`环境前提=不可 UI 自动化`，并写明原因。
- 若是 UI 用例，When 必须给出具体导航路径，并在每步后标注等待点
- Then 只能写页面上可直接观测的结果，不能写数据库/接口断言
- `覆盖范围`、`本轮是否执行`、`环境前提`、`不执行原因` 必须完整保留
- 候选扩展/不纳入本轮不得混进执行队列
- 当前不可执行的 case 应标注为不可执行，不要交给执行阶段制造 BLOCKED

## 输出

- 只写 `docs/{{gitBranch}}/tasks/{{taskId}}/TEST.md`
- 不产出执行报告，不做代码修复，不做 UI 跑单
- 完成后交回 `ui-automation-master` 重新判断下一阶段

## 约束

- 不直接调用 `ui-automation-run` 或 `ui-automation-repair`
- 不生成 Playwright 脚本；脚本生成属于 `ui-automation-run` 结合 `playwright-skill` 的职责
- 保持现有 `TEST.md` 格式不变
- 只保留本次功能和必要全局回归
- 候选扩展不得混进本轮执行
- 当前条件不齐备的 case，要明确标成不可执行，而不是交给执行阶段制造 BLOCKED
- 不弱化核心断言换通过率
- 若是 UI 用例，When 必须写具体导航路径并标等待点
- Then 只写页面可观测结果，不写数据库/接口断言
- 属性表必须保留覆盖范围、本轮是否执行、环境前提、不执行原因
- 生成或改写时，如需路径/定位细节，必须参考 `path-guide-template.md` 与 `element-plus-locators.md`

## 执行习惯

1. 先判 scope / executable
2. 再写任务目标与完成断言
3. 再补样本、入口、Stage0 预检
4. 再把 When 改成具体导航路径
5. 再把 Then 改成浏览器可观测结果
6. 最后自检并结束

