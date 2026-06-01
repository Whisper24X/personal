---
name: maintain-test-xmind-from-codebase
description: Analyze a codebase and maintain a testing mind map or XMind from real routes, pages, APIs, and risk flows. Use when the user asks to update test cases, test strategy, XMind, 脑图, 用例库, or to maintain testing artifacts from code rather than PRD.
disable-model-invocation: true
---

# Maintain Test XMind From Codebase

## Goal

把“根据代码维护测试脑图 / 测试用例库”变成稳定流程，避免只做页面冒烟，遗漏真正高风险链路。

## Inputs To Confirm

开始前优先确认这 3 项：

1. **源代码目录**：实际要分析的项目路径。
2. **目标产物**：要维护的是 `.xmind`、旁路 `json/md`，还是两者都要。
3. **同步机制**：是否已有生成脚本、结构化源文件，或约定的单一数据源。

如果用户没说清楚，优先从当前会话上下文和相邻文件名推断；仍不清楚再追问。

## Workflow

### 1. 先找“单一事实源”

不要先手工改 `.xmind`。

优先检查：

- 是否存在与脑图同名的结构化文件，例如 `xxx-xmind.json`
- 是否存在生成脚本，例如 `build-*.py`、`sync-*.py`
- `.xmind` 是否本质为 zip 包，内部是否由 `content.json` 驱动

判断原则：

- **有结构化源**：先改结构化源，再生成脑图
- **有脚本**：沿用脚本，不重复发明流程
- **没有结构化源也没有脚本**：再直接改 `.xmind` 内的 `content.json`

### 2. 从代码反推真实功能

围绕“用户能做什么”和“哪里最容易坏”收集信息，而不是只看 README。

优先读取：

- 前端路由：`routes`、`router`、guard、菜单 access config
- 关键页面和 composable：`pages/`、`features/`
- 前端 API：`frontend/src/api/*`
- 后端接口：`*.controller.ts`
- 关键状态/权限：access control、auth、feature guard、平台管理员限制

输出时至少整理出：

1. 主要用户旅程
2. 关键页面与路由
3. 关键后端接口域
4. 高风险链路
5. 建议新增或细化的用例主题

### 3. 用例写法保持统一

优先使用固定结构，不要混入长篇解释：

- `title`
- `preconditions`
- `steps`
- `expectedResults`

写法要求：

- 步骤可执行，避免空泛描述
- 预期结果可观察，尽量体现状态变化、错误提示、权限回退、上下文保留、流式返回、异步完成、刷新行为
- 少写“页面可打开”这类低价值表述，除非它就是当前唯一目标
- 若某链路包含明显状态机，明确列出关键状态或阻断条件

### 4. 优先补强这些高价值链路

如果项目具备下列能力，优先从这里补用例：

- 认证、会话刷新、权限守卫、无权限回退
- 任务执行链路、异步轮询、SSE / WebSocket / Worker 通知
- 环境启停、预览、工作区文件、终端
- Git 操作：status / diff / stage / commit / merge / rebase / push / PR link
- 需求到任务：生成 PRD、生成计划、物化任务、依赖校验
- 知识库：文档树、预览、上传、编辑、问答、流式响应
- 配置型能力：Skill、MCP、Agent CLI、自动化计划、平台母版

### 5. 改动顺序

推荐顺序：

1. 先更新结构化 `useCases`
2. 再重建 `outline`
3. 最后生成 `.xmind`

如果项目已经有结构化源但没有自动同步逻辑，可以顺手补一个小脚本，把：

- `useCases` -> `outline`
- `useCases` -> `content.json` / `.xmind`

做成一键同步。

### 6. 验证

至少验证这几件事：

- `useCases` 数量与 `outline` 数量一致
- `.xmind` 根节点子项数量与 `useCases` 一致
- 最新新增用例标题已出现在 `.xmind`
- 新增脚本本身无明显 lint / 语法错误

如果能快速做到，再补一层：

- 打印最后 3-5 条用例标题，确认落盘内容正确

## Editing Rules

- 默认把结构化文件当主编辑面，不要同时手工维护两份同构内容
- 不要覆盖用户已有用例的业务语义，除非代码明确证明现状已变化
- 若发现现有脑图结构存在自动生成痕迹，优先补“同步脚本”而不是继续手工堆内容

## Response Format

完成后向用户简要说明：

1. 更新了哪些高价值链路
2. 改了哪些文件
3. 是否已同步 `.xmind`
4. 做了哪些校验
5. 若未运行应用级测试，要明确说明

## Example Triggers

- “根据项目代码维护测试脑图”
- “更新 xmind 测试用例”
- “按代码现状补测试策略，不看 PRD”
- “把现有用例从页面冒烟补到真实业务链路”
