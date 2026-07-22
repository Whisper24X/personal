---
name: openspec-superpowers-workflow
description: OpenSpec + Superpowers 融合编排流程。将 Superpowers 的工程纪律（Brainstorming、TDD、Verification、Code Review）与 OpenSpec 的结构化变更管理融合为统一流程，所有产出物统一归属到 OpenSpec change 目录。支持 Go、TypeScript、Android、Python、Rust、Java 等多技术栈，通过 Profile 机制适配各栈的构建/测试/lint 命令。当用户要求开发新功能、重构代码、或执行需要设计+实现的任务时使用。Use when developing features, refactoring code, or any task that benefits from design-first + spec-driven development.
---

# OpenSpec + Superpowers 融合编排流程

将 Superpowers 的工程纪律与 OpenSpec 的变更管理融合为一个不可跳过的编排流程。

## 前置条件检查（必须在阶段 1 之前执行）

### 0.1 检查 OpenSpec CLI 可用性

> **⚠️ 重要：openspec 在 Agent 的非交互式 Shell 环境中会直接 exit=1，不产生任何输出，也不执行任何文件系统操作（连目录都不创建）。这不是 TTY 输出问题，而是命令本身在非交互式环境下静默失败。**
>
> **根本解法：openspec 命令（`new change`、`instructions`、`validate`、`archive` 等）一律由用户在终端中手动执行。Agent 负责制品文件的内容创建和格式正确性。**
>
> **分工原则：**
> - **用户在终端执行**：所有 `openspec` CLI 命令（`/opsx-new`、`/opsx-continue`、`openspec validate`、`openspec archive` 等）
> - **Agent 负责**：读取 `openspec instructions` 输出（由用户粘贴）、编写所有制品文件内容
> - **Agent 可用 Shell 执行**：仅 `which openspec`（判断是否安装，不依赖输出内容）

```bash
# 仅用于判断 openspec 是否安装（不依赖输出）
which openspec 2>&1; echo "exit=$?"
# exit=0 → 已安装，要求用户在终端执行 /opsx-new 创建 change
# exit=1 → 未安装，完全降级为手动模式
```

- **已安装** → **标准模式**：
  - 告知用户「请在终端执行 `/opsx-new <change-id>` 创建 change 目录和初始结构」
  - 等待用户确认执行完毕（可通过 `ls openspec/changes/<change-id>/` 验证目录已创建）
  - 用户执行 `openspec instructions <artifact-id> --change "<change-id>" --json` 后，将输出粘贴给 Agent
  - Agent 根据 instructions 输出填写制品文件内容
  - 后续 `openspec validate`、`openspec archive` 同样由用户在终端执行
- **未安装** → **降级模式**：
  - 在对话中明确告知用户「OpenSpec CLI 不可用，将以手动方式创建制品」
  - `openspec new change` → `mkdir -p openspec/changes/<change-id>/specs/<capability>/`
  - `openspec instructions` → 按本 Skill 的制品格式规范手动编写
  - `openspec validate` → 人工检查格式是否符合规范
  - `openspec archive` → 手动在对话中声明归档完成
  - 所有其他 `openspec` 命令均用对应的手动步骤替代，**不得跳过该步骤对应的实质内容**

### 0.2 检查 Superpowers Skills 可用性

验证以下 skills 是否可以通过 Read 工具读取（路径中 `...` 为 Superpowers 插件的版本 hash，可通过 Glob 工具搜索 `**/superpowers/**/brainstorming/SKILL.md` 定位实际路径）：

```
<cursor-plugins-dir>/superpowers/<version-hash>/skills/brainstorming/SKILL.md
<cursor-plugins-dir>/superpowers/<version-hash>/skills/test-driven-development/SKILL.md
<cursor-plugins-dir>/superpowers/<version-hash>/skills/verification-before-completion/SKILL.md
<cursor-plugins-dir>/superpowers/<version-hash>/skills/requesting-code-review/SKILL.md
```

- **可读取** → 在对应阶段按规范调用（Read skill 文件后遵循其流程）
- **不可读取** → **降级模式**：
  - `superpowers:brainstorming` → 按本 Skill 1.1-1.4 的阶段描述手动执行 Brainstorming
  - `superpowers:test-driven-development` → 按 RED/GREEN/REFACTOR 循环手动执行，无法运行测试时在报告中注明
  - `superpowers:verification-before-completion` → 按当前技术栈 Profile 执行构建/测试/lint 命令并记录输出
  - `superpowers:requesting-code-review` → 手动执行七维度代码评审

**降级模式下不得跳过任何阶段的实质内容，只是命令执行方式改为手动等价操作。**

### 0.3 识别项目技术栈（阶段 3 之前必须完成）

阶段 3（TDD）和阶段 4（验证）的命令**因技术栈而异**。进入实现前，Agent 必须先识别当前项目技术栈，并在 `design.md` 或对话中记录所选 profile。

**识别顺序（由高到低优先级）：**

1. 用户在 Brainstorming 中明确指定的技术栈
2. `design.md` / `plan.md` 中的 Tech Stack 字段
3. 项目根目录特征文件（见下表）
4. 现有 CI 配置（`.github/workflows/`、`.gitlab-ci.yml`、`Makefile` 等）
5. 无法确定时 → **询问用户**，不得默认假设为 Go

**常见技术栈特征文件：**

| 技术栈 | 特征文件 | 默认 Profile ID |
|--------|----------|-----------------|
| Go | `go.mod` | `go` |
| TypeScript / Node.js | `package.json` + `tsconfig.json` | `typescript` |
| JavaScript (Node.js) | `package.json`（无 tsconfig） | `javascript` |
| Android (Kotlin/Java) | `build.gradle` / `build.gradle.kts` + `AndroidManifest.xml` | `android` |
| Python | `pyproject.toml` / `setup.py` / `requirements.txt` | `python` |
| Rust | `Cargo.toml` | `rust` |
| Java (非 Android) | `pom.xml` / `build.gradle`（无 Android 特征） | `java` |

识别完成后，从本文档末尾 **[技术栈 Profile 参考](#技术栈-profile-参考)** 选取对应 profile，后续 TDD 与验证阶段一律使用该 profile 中的命令与约定。

**多模块 / Monorepo 项目：** 若变更仅涉及子模块，profile 命令中的路径需限定到该子模块（如 `packages/foo/`、`app/`、`module-name/`），优先复用子模块内已有的 `package.json` / `build.gradle` 等配置。

---

- OpenSpec CLI 已安装且项目已初始化（openspec/ 目录存在）
- Superpowers 插件已安装（brainstorming、tdd、verification 等 Skill 可用）
- 项目技术栈已识别（阶段 3 开始前）

### 0.4 阶段账本（workflow-state.md）

为了避免长对话、session 摘要、模式切换或实现完成后的惯性收尾导致后续阶段漏跑，每个 OpenSpec change 必须维护阶段账本：

```
openspec/changes/<change-id>/workflow-state.md
```

**账本是恢复和收尾判断的唯一可信来源**。每次启动或恢复 `/openspec-superpowers-workflow` 时，Agent 必须：

1. 确认 `change-id`
2. 如果 `workflow-state.md` 已存在，先读取它，再读取 `tasks.md`
3. 找到第一个未完成阶段，从该阶段继续
4. 不得仅凭聊天摘要、上一轮最终回复或 `tasks.md` 全 `[x]` 判断 workflow 已完成

阶段账本模板：

```markdown
# Workflow State

- [ ] phase-1-brainstorming
- [ ] phase-2-openspec-artifacts
- [ ] phase-2.4-user-confirmation
- [ ] phase-3-implementation
- [ ] phase-3-report
- [ ] phase-4-verification
- [ ] phase-4-report
- [ ] phase-5-code-review
- [ ] phase-5-report
- [ ] phase-6-closeout
- [ ] phase-6-report
```

更新规则：
- 每完成一个阶段，只能在对应产出物存在且内容完整后，把账本中的对应项改为 `[x]`
- 阶段 3/4/5/6 必须先写入对应 `stage-reports/stage-*.md`，再勾选 `phase-*-report`
- 如果用户中断或要求暂停，不得预先勾选未完成阶段
- final 前必须重新读取 `workflow-state.md`；若仍有未完成项，不能声称 workflow 完成，只能报告当前进度和下一阶段

## 阶段 1: Brainstorming

**调用 Superpowers skill**: superpowers:brainstorming

产出物先按原生 brainstorming Skill 的路径生成（`docs/superpowers/specs/`），后续在阶段 2 生成 OpenSpec 制品后统一迁移到 `openspec/changes/<change-id>/` 目录。

### 1.1 探索项目上下文

检查相关代码、文档、最近 git 提交，了解项目现状。

如需查看已有 OpenSpec change 列表，提示用户在终端执行：
```bash
# 用户在终端执行（Agent 不执行）：
openspec list
```
用户将输出粘贴给 Agent，Agent 据此判断是否有相关的已有 change。

确定 change-id（kebab-case，动词开头）。

### 1.2 逐个澄清问题

按 superpowers:brainstorming 要求，一次一个问题，优先用选择题。

### 1.3 提出 2-3 个候选方案

每个方案列出优点、缺点、适用场景，给出推荐方案及理由。

### 1.4 【卡点】等待用户确认方案

不得在用户确认前进入下一阶段。

### 1.5 写入设计文档（按原生 brainstorming 路径）

按原生 brainstorming Skill 的要求，将设计文档写入 `docs/superpowers/specs/` 目录（用户如有自定义位置偏好则遵从）。

**设计文档**写入 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`：

```markdown
# [接口名] 设计文档

## 澄清问题及结论
<!-- 记录 Brainstorming 中的关键问题和结论 -->

## 候选方案对比
<!-- 2-3 个方案，含优缺点和推荐理由 -->

## 最终选择及理由

## 技术设计
### 架构分层
### 关键决策
### 风险与约束
### Open Questions（供 Code Review 阶段补充）
```

写入后通知用户审阅。只有在用户**明确要求**提交时，才执行 git commit。

### 1.6 Spec Review Loop

按原生 brainstorming Skill 的步骤 7 执行，但使用当前环境可用的审查能力：

1. 使用 `Subagent` 工具派发 `subagent_type="code-reviewer"`，聚焦审查设计文档本身
2. prompt 中提供设计文档路径、任务背景、需要重点检查的设计一致性/完整性/可执行性
3. 如有问题 → 修复后重新派发审查，直到通过
4. 如循环超过 3 轮仍未通过 → 将问题呈报给用户人工决策

### 1.7 【卡点】User Review Gate

按原生 brainstorming Skill 的步骤 8 执行：

> "Spec written to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Please review it and let me know if you want to make any changes before we start writing out the implementation plan."

等待用户审批。如果用户要求修改，修改后重新执行 1.6 Spec Review Loop。只有用户审批通过后才进入下一步。

### 1.8 调用 writing-plans 生成实现计划

按原生 brainstorming Skill 的步骤 9，调用 superpowers:writing-plans 生成实现计划。

实现计划写入 `docs/superpowers/specs/YYYY-MM-DD-<topic>-plan.md`：

```markdown
# [接口名] 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [一句话描述目标]

**Architecture:** [2-3 句描述方案]

**Tech Stack:** [从 0.3 识别的技术栈，如 Go / TypeScript / Android 等]

---

### Task 1: [组件名]

**Files:**
- Create/Modify: `exact/path/to/file.[ext]`

**Step 1: Write the failing test**
...

**Step 2: Run test to verify it fails**
```bash
# 使用当前技术栈 profile 的 test_single 命令，见文末参考
${TEST_SINGLE_CMD}
# 预期输出: FAIL
```

**Step 3: Write minimal implementation**
...

**Step 4: Run test to verify it passes**
```bash
${TEST_SINGLE_CMD}
# 预期输出: PASS
```

**Step 5: Commit**
...
```

> **注意**：阶段 1 的产出物（设计文档 + 实现计划）暂存在 `docs/superpowers/specs/` 下，后续在阶段 2 生成 OpenSpec 制品后，统一迁移到 `openspec/changes/<change-id>/` 目录。

## 阶段 2: OpenSpec Artifacts

使用 `/opsx-continue` 命令流程逐个创建制品（标准模式），或按格式规范手动编写（降级模式）。

### 2.1 获取 artifact 创建指引并逐个创建

**标准模式（CLI 已安装）：**

提示用户在终端逐个执行（每次创建一个制品）：
```bash
# 用户在终端执行（Agent 不执行）：
openspec status --change "<change-id>" --json
openspec instructions <artifact-id> --change "<change-id>" --json
```
用户将 `openspec instructions` 的 JSON 输出粘贴给 Agent，Agent 根据其中的 `template`、`context`、`rules` 字段填写制品内容并写入 `outputPath`。

> **注意**：`context` 和 `rules` 是对 Agent 的约束，**不得**复制到制品文件中。

**降级模式（CLI 未安装）：**

直接按以下格式手动编写制品文件：
- `proposal.md`：目标、方案、影响范围
- `specs/<capability>/spec.md`：`## ADDED Requirements` + `### Requirement` + `#### Scenario:`
- `tasks.md`：任务列表，含 TDD 步骤 `- [ ]`
- `workflow-state.md`：使用 [0.4 阶段账本](#04-阶段账本workflow-statemd) 模板，记录阶段推进状态

无论标准模式还是降级模式，在阶段 2 创建 OpenSpec 制品时都必须创建或更新 `workflow-state.md`：
- 阶段 1 已完成并迁移设计/计划后，勾选 `phase-1-brainstorming`
- `proposal.md`、`specs/`、`tasks.md` 写入并格式检查后，勾选 `phase-2-openspec-artifacts`
- `phase-2.4-user-confirmation` 只能在用户明确确认 OpenSpec 制品后勾选

### 2.2 验证 artifacts 格式

**标准模式：** 提示用户在终端执行：
```bash
# 用户在终端执行：
openspec validate "<change-id>" --strict
# exit=0 → 验证通过
# exit=1 → 有格式错误，常见问题：
#   - spec.md 必须在 specs/<capability>/spec.md 路径下（不是直接 spec.md）
#   - 必须有 ## ADDED/MODIFIED/REMOVED/RENAMED Requirements 标题
#   - 每个 Requirement 必须有至少一个 #### Scenario: 块
```

**降级模式：** Agent 人工检查格式要求（同上）。

### 2.3 迁移 Brainstorming 产出物到 OpenSpec change 目录

在 OpenSpec 制品（proposal.md、specs/、tasks.md）生成完毕后，将阶段 1 的 Brainstorming 产出物从 `docs/superpowers/specs/` 迁移到 `openspec/changes/<change-id>/`，集中管理所有制品。

```bash
# 迁移设计文档（重命名为 design.md）
mv docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md openspec/changes/<change-id>/design.md

# 迁移实现计划
mv docs/superpowers/specs/YYYY-MM-DD-<topic>-plan.md openspec/changes/<change-id>/plan.md

# 删除 Brainstorming 留下的空目录（仅当目录为空时删除）
rmdir docs/superpowers/specs/ 2>/dev/null
rmdir docs/superpowers/ 2>/dev/null
```

迁移后确认文件到位：
```bash
ls openspec/changes/<change-id>/ 2>&1
```

### 2.4 【强制卡点 🚨】等待用户确认 OpenSpec 制品

```bash
# 确认文件存在（Agent 可执行）：
ls openspec/changes/<change-id>/ 2>&1
# 然后 Read 读取 proposal.md、specs/*/spec.md、tasks.md、design.md 展示内容
```

**此卡点不可跳过，不可由 session 摘要恢复状态绕过，不可以「继续」指令隐式通过。**

必须执行：
1. 向用户展示 proposal.md 核心内容（目标、方案、影响范围）
2. 展示 spec.md 的 Requirements 列表
3. 展示 tasks.md 的任务列表
4. 确认 design.md 和 plan.md 已迁移到位
5. 确认 `workflow-state.md` 已存在且 `phase-2.4-user-confirmation` 尚未勾选
6. **明确等待用户输入「确认」或「继续」，再进入阶段 3**

用户确认后，Agent 才能勾选 `phase-2.4-user-confirmation`。即使是从 session 摘要恢复，若阶段 3 尚未开始，必须重新展示制品并等待确认。

## 阶段 3: 实现

**调用 Superpowers skill**: superpowers:test-driven-development

> **⚠️ 前置条件：** 已完成 [0.3 技术栈识别](#03-识别项目技术栈阶段-3-之前必须完成)，并选定对应 Profile。
>
> **⚠️ TDD 铁律：每个 task 必须先写测试再写实现。没有对应测试文件的实现代码不允许存在。**
>
> 如果发现自己在没有测试的情况下写了实现代码 → 删除实现代码，从 RED 步骤重新开始。

### 3.1 获取实现指引

**标准模式：** 提示用户在终端执行：
```bash
# 用户在终端执行：
openspec instructions apply --change "<change-id>" --json
```
用户将输出粘贴给 Agent，Agent 根据 `contextFiles` 和 `tasks` 列表执行实现。

**降级模式：** 直接读取 tasks.md，按任务列表顺序执行 TDD 循环：
```bash
Read openspec/changes/<change-id>/tasks.md
```

### 3.2 对每个 task 执行 TDD 循环

**每个 task 必须严格按 RED → GREEN → REFACTOR 顺序执行，不得跳过任何步骤。**

命令一律使用当前技术栈 Profile 中的 `test_single` / `test_all`（见文末 **[技术栈 Profile 参考](#技术栈-profile-参考)**）。若项目有自定义脚本（如 `make test`、`npm run test:unit`），优先使用项目已有约定并在 `design.md` 中记录。

#### RED — 写失败测试（不可跳过）

```bash
# 1. 先创建/编辑测试文件，描述该 task 的期望行为
#    测试文件命名与位置遵循当前 Profile 的 test_mapping 约定
# 2. 运行测试，确认失败且失败原因正确：
${TEST_SINGLE_CMD}   # 替换为 Profile 中的 test_single 命令
# 预期输出: FAIL
# 3. 确认失败原因是"功能未实现"而非语法/编译错误
```

**RED 步骤的自检：**
- 测试文件是否已创建？（按 Profile 的 `test_mapping` 规则检查）
- 测试是否运行并失败了？（必须看到 FAIL 输出）
- 失败原因是否正确？（因功能缺失而非编译/语法错误）

如果以上三项任一不满足，不得进入 GREEN 步骤。

#### GREEN — 最小实现

```bash
# 写最小代码让测试通过
# 运行测试，确认通过：
${TEST_SINGLE_CMD}
# 预期输出: PASS
```

#### REFACTOR — 重构

```bash
# 在测试保护下重构代码
# 确认测试仍然通过：
${TEST_ALL_CMD}   # 或 ${TEST_SINGLE_CMD}，替换为 Profile 命令
# 预期输出: PASS
```

#### 更新 tasks.md

将对应任务的 - [ ] 改为 - [x]。

### 3.3 TDD 常见跳过模式（必须识别并阻止）

以下是 Agent 常见的跳过单元测试的模式，遇到这些想法时必须停下来：

| 想法 | 正确做法 |
|------|----------|
| "这个功能太简单，不需要测试" | 简单功能的测试也简单，30 秒就写完，没有理由跳过 |
| "项目没有测试基础设施" | 创建测试基础设施是第一个 task，先搭好再继续 |
| "先把实现写完再补测试" | 删除实现代码，从 RED 开始。测试后补 ≠ TDD |
| "这个是配置/路由/IDL，不需要测试" | 配置可以测解析，路由可以测注册，IDL 可以测序列化/契约 |
| "外部依赖太多，没法测" | 用 interface / mock / fake 隔离外部依赖，这正是 TDD 驱动好设计的价值 |
| "UI 组件不好测" | 使用对应栈的组件测试工具（如 Testing Library、Compose UI Test、Espresso） |
| "时间紧，先跳过测试" | 测试是投资不是成本，跳过测试的代码返工率更高 |
| "等全部实现完再统一写测试" | 这不是 TDD。每个 task 独立完成 RED-GREEN-REFACTOR |

### 3.4 测试基础设施缺失的处理

如果项目当前缺少测试基础设施（如 mock 框架、测试 helper、测试 runner 配置），**不得以此为由跳过测试**，正确做法是：

1. 将"搭建测试基础设施"作为 tasks.md 的第一个 task
2. 在该 task 中创建必要的 mock、helper、testutil / 测试配置
3. 后续 task 基于该基础设施编写测试
4. 如果确实无法为某个具体 task 编写自动化测试（如纯代码生成产物、纯样式调整），在 tasks.md 该 task 旁标注原因，并在 design.md 的风险部分记录，同时补充可执行的替代验证（如 snapshot test、手动测试清单）

### 3.5 生成阶段报告

阶段 3 完成后、进入阶段 4 前，必须写入 `openspec/changes/<change-id>/stage-reports/stage-3-implementation.md`。报告至少包含：
- 实际完成的 tasks 列表，以及对应测试文件和实现文件
- 每个 task 的 RED/GREEN/REFACTOR 结果摘要
- `tasks.md` 更新结果和是否仍有未完成任务
- 无法自动化测试的例外项及替代验证（如有）

报告写入并复读确认后，更新 `workflow-state.md`：
- `phase-3-implementation`：所有实现 task 已完成且相关测试通过
- `phase-3-report`：`stage-3-implementation.md` 已存在且内容完整

只有这两项都勾选后，才能进入阶段 4。

## 阶段 4: 验证

**调用 Superpowers skill**: superpowers:verification-before-completion

铁律：没有运行命令并看到输出，就不能声称验证通过。

> **⚠️ 前置条件：** 已完成 [0.3 技术栈识别](#03-识别项目技术栈阶段-3-之前必须完成)。以下各步骤使用当前 Profile 中的命令；若项目有 `Makefile` / `package.json scripts` / CI 中已定义的等价命令，优先复用并在报告中注明。

### 4.0 确定评审基线

以下脚本用于获取 git diff 基线，**所有技术栈通用**：

```bash
BASE_BRANCH=${BASE_BRANCH:-$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')}
if [ -z "$BASE_BRANCH" ]; then
  for b in master main develop; do
    if git show-ref --verify --quiet "refs/heads/$b" || git show-ref --verify --quiet "refs/remotes/origin/$b"; then
      BASE_BRANCH=$b
      break
    fi
  done
fi
[ -n "$BASE_BRANCH" ] || BASE_BRANCH=master
BASE_SHA=$(git merge-base HEAD "$BASE_BRANCH")
echo "BASE_BRANCH=$BASE_BRANCH BASE_SHA=$BASE_SHA"
```

### 4.1 编译 / 类型检查验证

```bash
${BUILD_CMD}   # 替换为 Profile 中的 build 命令
# 预期: exit 0
```

若 Profile 包含独立的 `typecheck` 命令（如 TypeScript），也应执行：
```bash
${TYPECHECK_CMD}   # 若有
# 预期: exit 0
```

### 4.2 测试文件存在性验证

检查本次变更中每个新增或修改的**实现源文件**是否有对应测试。具体规则因栈而异，见 Profile 的 `impl_glob`、`test_mapping`、`exclude_globs` 字段。

**通用流程：**

```bash
# 1. 列出变更中的实现文件（排除测试文件和生成文件）
git diff --name-only "${BASE_SHA}..HEAD" -- ${IMPL_GLOB} ${EXCLUDE_GLOBS}

# 2. 对每个文件，按 Profile 的 test_mapping 规则推导测试文件路径并检查是否存在
# 3. 若有 MISSING TEST，必须回到阶段 3 补写测试，不得继续后续验证
```

**各 Profile 的 test_mapping 示例：**

| Profile | 实现文件 | 对应测试文件 |
|---------|----------|--------------|
| `go` | `foo.go` | 同目录 `foo_test.go` |
| `typescript` | `foo.ts` / `foo.tsx` | 同目录 `foo.test.ts` 或 `foo.spec.ts` |
| `javascript` | `foo.js` / `foo.jsx` | 同目录 `foo.test.js` 或 `__tests__/foo.js` |
| `android` | `Foo.kt` / `Foo.java` | `src/test/` 或 `src/androidTest/` 下 `FooTest.kt` |
| `python` | `foo.py` | `test_foo.py` 或 `tests/test_foo.py` |
| `rust` | `foo.rs` | 同文件 `#[cfg(test)]` 模块，或 `foo.rs` 旁 `tests/` 集成测试 |
| `java` | `Foo.java` | `FooTest.java`（通常于 `src/test/java/` 镜像包路径） |

**豁免规则（所有 Profile 通用）：**
- 纯生成文件（如 `*.pb.go`、`*.generated.ts`）
- 纯配置 / 声明文件（如 `.env.example`、静态资源），但须在 tasks.md 标注原因
- 用户在 design.md 中明确标注为"无自动化测试"的文件，且提供了替代验证方式

### 4.3 测试运行验证

```bash
${TEST_ALL_CMD}   # 替换为 Profile 中的 test_all 命令
# 预期: 全部 PASS；若 Profile 支持覆盖率，一并记录
```

### 4.4 Lint / 静态分析验证

按优先级执行（有则跑，无则跳过并在报告中注明）：

```bash
# 1. 项目自定义 lint 命令（Profile 的 lint 字段，或 make lint / npm run lint）
${LINT_CMD}

# 2. IDE / 编辑器诊断（Cursor ReadLints 工具，检查已修改文件）

# 3. 类型检查（若 4.1 未单独执行且 Profile 有 typecheck）
${TYPECHECK_CMD}
# 预期: 0 errors
```

### 4.5 OpenSpec Spec 覆盖验证

读取 spec 文件，逐条检查每个 Scenario 的 WHEN/THEN 是否有对应实现代码：
```bash
Read openspec/changes/<change-id>/specs/<capability>/spec.md
```

### 4.6 Tasks 完成验证

**标准模式：** 提示用户在终端执行：
```bash
# 用户在终端执行：
openspec status --change "<change-id>"
```

**降级模式：** 直接读取 tasks.md 统计完成情况：
```bash
Read openspec/changes/<change-id>/tasks.md
# 统计 [x]（完成）与 [ ]（未完成）数量，在对话中报告完成率
```

确认所有任务已标记为 [x]。

### 4.7 验证报告格式

验证完成后，在对话中输出结构化报告（便于用户审阅）：

```markdown
## 验证报告 — <change-id>

**技术栈 Profile:** [profile-id]
**基线:** ${BASE_BRANCH} @ ${BASE_SHA}

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 编译/构建 | `${BUILD_CMD}` | ✅ / ❌ |
| 类型检查 | `${TYPECHECK_CMD}` | ✅ / ❌ / N/A |
| 测试存在性 | git diff + test_mapping | ✅ / ❌ (列出缺失项) |
| 测试运行 | `${TEST_ALL_CMD}` | ✅ / ❌ |
| Lint | `${LINT_CMD}` | ✅ / ❌ / N/A |
| Spec 覆盖 | 人工核对 | ✅ / ❌ |
| Tasks 完成 | tasks.md | N/M |
```

### 4.8 生成阶段报告

阶段 4 完成后、进入阶段 5 前，必须将验证报告写入 `openspec/changes/<change-id>/stage-reports/stage-4-verification.md`。报告至少包含：
- 技术栈 Profile、基线分支和 BASE_SHA
- 构建、类型检查、测试、Lint、Spec 覆盖、Tasks 完成情况
- 失败命令的关键输出和修复动作；若全部通过，明确记录通过结论
- 未执行项的原因（例如 Profile 无 typecheck）

报告写入并复读确认后，更新 `workflow-state.md`：
- `phase-4-verification`：验证命令已运行并记录结果
- `phase-4-report`：`stage-4-verification.md` 已存在且内容完整

只有这两项都勾选后，才能进入阶段 5。不得在阶段 4 后直接 final。

## 阶段 5: Code Review

**调用 Superpowers skill**: superpowers:requesting-code-review

### 5.1 获取变更范围

```bash
BASE_BRANCH=${BASE_BRANCH:-$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')}
if [ -z "$BASE_BRANCH" ]; then
  for b in master main develop; do
    if git show-ref --verify --quiet "refs/heads/$b" || git show-ref --verify --quiet "refs/remotes/origin/$b"; then
      BASE_BRANCH=$b
      break
    fi
  done
fi
[ -n "$BASE_BRANCH" ] || BASE_BRANCH=master
BASE_SHA=$(git merge-base HEAD "$BASE_BRANCH")
HEAD_SHA=$(git rev-parse HEAD)
git diff ${BASE_SHA}..${HEAD_SHA} --stat
```

### 5.2 派发 code-reviewer subagent

使用 `Subagent` 工具派发 `subagent_type="code-reviewer"`，prompt 中提供：
- WHAT_WAS_IMPLEMENTED: 读取 openspec/changes/<change-id>/proposal.md
- PLAN_OR_REQUIREMENTS: 读取 openspec/changes/<change-id>/specs/<capability>/spec.md
- BASE_SHA: ${BASE_SHA}
- HEAD_SHA: ${HEAD_SHA}

### 5.3 处理反馈

- CRITICAL：立即修复，修复后回到阶段 4 重新验证
- IMPORTANT：修复后继续
- SUGGESTION：记录到 design.md 的 Open Questions 部分

### 5.4 生成阶段报告

阶段 5 完成后、进入阶段 6 前，必须写入 `openspec/changes/<change-id>/stage-reports/stage-5-code-review.md`。报告至少包含：
- Code Review 的输入范围（BASE_SHA、HEAD_SHA、关键 diff 统计）
- code-reviewer 的结论摘要和问题分级
- 已处理的 CRITICAL / IMPORTANT 反馈及对应修复
- 保留为 SUGGESTION / Open Questions 的事项

报告写入并复读确认后，更新 `workflow-state.md`：
- `phase-5-code-review`：已派发 code-reviewer 或完成降级手动评审，且 CRITICAL/IMPORTANT 已处理
- `phase-5-report`：`stage-5-code-review.md` 已存在且内容完整

只有这两项都勾选后，才能进入阶段 6。若 review 发现需要改代码，必须回到阶段 3/4 的相应步骤，重新验证后再更新账本。

## 阶段 6: 收尾与归档

### 6.1 最终状态确认

```bash
# Agent 确认制品文件完整（可执行）：
ls openspec/changes/<change-id>/ 2>&1
ls openspec/changes/<change-id>/specs/ 2>&1
# Read openspec/changes/<change-id>/tasks.md，确认全部为 [x]
```

**标准模式：** 提示用户在终端执行格式验证：
```bash
# 用户在终端执行：
openspec validate "<change-id>" --strict
# exit=0 → 验证通过，继续归档
# exit=1 → 格式有问题，检查 specs/<capability>/spec.md 格式
```

**降级模式：** Agent 人工检查格式。

### 6.2 执行归档

**标准模式：** 提示用户在终端执行：
```bash
# 用户在终端执行：
openspec archive "<change-id>" --yes
# 或使用 Cursor Command：/opsx-archive <change-id>
```

**降级模式：** 在对话中声明「change `<change-id>` 已完成，制品保留在 `openspec/changes/<change-id>/`」。

### 6.3 提交与推送（仅在用户明确要求时）

```bash
# 仅当用户明确要求提交时执行：
git add -A
git commit -m "feat: <change-id> - <简要描述>"

# 仅当用户明确要求推送时执行：
git push -u origin HEAD
```

### 6.4 生成阶段报告

阶段 6 完成后，必须写入 `openspec/changes/<change-id>/stage-reports/stage-6-closeout.md`。报告至少包含：
- 最终制品完整性检查结果
- `openspec validate` / 人工格式检查结果
- 归档执行结果或降级模式下的完成声明
- 是否执行了提交、推送；未执行时注明原因（例如用户未明确要求）

报告写入并复读确认后，更新 `workflow-state.md`：
- `phase-6-closeout`：最终制品检查、validate/archive 指引或降级完成声明已处理
- `phase-6-report`：`stage-6-closeout.md` 已存在且内容完整

只有 `workflow-state.md` 全部为 `[x]` 后，Agent 才能在 final 中声称 `/openspec-superpowers-workflow` 完整完成。

## 产出物归属规则

所有产出物统一在 OpenSpec change 目录下：

```
openspec/changes/<change-id>/
  proposal.md       # 阶段 2 产出
  design.md          # 阶段 1 产出（Brainstorming 设计文档，从 docs/superpowers/specs/ 迁移并重命名）
  plan.md            # 阶段 1 产出（实现计划，从 docs/superpowers/specs/ 迁移）
  specs/
    <capability>/
      spec.md        # 阶段 2 产出
  tasks.md           # 阶段 2 产出
  workflow-state.md  # 阶段账本；恢复和 final 前检查的唯一可信来源
  stage-reports/     # 阶段 3 之后每阶段完成报告
    stage-3-implementation.md
    stage-4-verification.md
    stage-5-code-review.md
    stage-6-closeout.md
```

Brainstorming 产出物先按原生 Skill 路径生成到 `docs/superpowers/specs/`，在阶段 2.3 迁移到 change 目录。最终一个 change，一个目录，所有上下文集中管理。

## 护栏（不可跳过）

- 不跳过阶段 1 的 Brainstorming（即使任务看起来简单）
- 每次启动、恢复或准备 final 前，必须读取 `workflow-state.md`；如果文件不存在，必须先创建并根据现有制品保守回填，不能靠聊天摘要判断完成状态
- **【最高优先级】阶段 2.4 的 OpenSpec 制品确认卡点必须人工确认，任何情况下不得绕过：**
  - 不得因 session 摘要显示「制品已完成」而跳过
  - 不得因用户发送「继续」而隐式视为确认（「继续」只能用于恢复已明确确认过的阶段）
  - 恢复 session 时，若进度处于阶段 2 完成但阶段 3 未开始，必须重新展示制品并等待确认
- 必须在用户明确确认 OpenSpec 制品后才能开始写实现代码
- **不跳过 TDD 循环（每个 task 必须先写测试再写实现，违反则删除实现代码重来）：**
  - 不得以"功能简单"为由跳过测试
  - 不得以"缺少测试基础设施"为由跳过测试（应先搭建基础设施）
  - 不得先写实现再补测试（这不是 TDD）
  - 不得将多个 task 的测试合并到最后统一编写
- 阶段 3 之后每个阶段完成后必须写入对应 `stage-reports/stage-*.md`，再进入下一阶段
- `tasks.md` 全部 `[x]` 只代表实现任务完成，不代表 workflow 完成；只有 `workflow-state.md` 全部 `[x]` 才代表阶段 1-6 完整完成
- 不在没有运行验证命令的情况下声称完成
- 不跳过 Code Review
- final 前若 `workflow-state.md` 存在任何未完成项，必须继续执行第一个未完成阶段或向用户报告阻塞；不得输出“全部完成”
- 遇到任何一个护栏想要跳过时，停下来问用户是否允许

## 可选跳过的阶段

以下阶段用户可明确指示跳过：

- **Brainstorming 中的候选方案讨论**：若用户已明确指定方案，可简化
- **类型检查步骤（4.1 / 4.4）**：若 Profile 无 `typecheck` 且编译已覆盖，可跳过并在报告中标注 N/A

以下阶段**不可跳过**，即使用户要求也必须提示风险：

- 阶段 2.4 OpenSpec 制品人工确认
- 阶段 4 编译/构建 + Lint/静态分析验证（按当前 Profile 执行）

## 与原生工具的关系

本 Skill 不修改 Superpowers 和 OpenSpec 的任何原生文件，仅在外部定义调用顺序和产出物归属规则。两个工具各自升级不会影响本 Skill。

如果 Superpowers 或 OpenSpec 升级后新增了能力，可以在本 Skill 中添加对应的阶段来集成，无需改动原生 Skill。

---

## 技术栈 Profile 参考

Agent 在 [0.3](#03-识别项目技术栈阶段-3-之前必须完成) 识别技术栈后，选取下表对应 Profile。命令中的 `<module>` 表示子模块路径（Monorepo 时替换；单模块项目可省略或使用 `./`）。

**自定义 Profile：** 若项目技术栈不在下表中，参照现有 Profile 结构在 `design.md` 中定义：`build`、`typecheck`（可选）、`test_single`、`test_all`、`lint`、`impl_glob`、`exclude_globs`、`test_mapping` 说明。

### Profile: `go`

| 字段 | 命令 / 约定 |
|------|------------|
| `build` | `go build ./...` 或 `make build` |
| `typecheck` | N/A（编译即类型检查） |
| `test_single` | `go test ./path/to/package/... -run TestXxx -v` |
| `test_all` | `go test ./... -cover` |
| `lint` | `golangci-lint run ./...` 或 `make lint` |
| `impl_glob` | `'*.go'` |
| `exclude_globs` | `':!**/*_test.go' ':!**/*.pb.go' ':!**/*.pb.validate.go'` |
| `test_mapping` | `foo.go` → 同目录 `foo_test.go` |

### Profile: `typescript`

| 字段 | 命令 / 约定 |
|------|------------|
| `build` | `npm run build` 或 `pnpm build` 或 `yarn build` |
| `typecheck` | `npx tsc --noEmit` 或 `npm run typecheck` |
| `test_single` | `npx vitest run path/to/foo.test.ts` 或 `npx jest path/to/foo.test.ts` |
| `test_all` | `npm test` 或 `npx vitest run` 或 `npx jest --coverage` |
| `lint` | `npm run lint` 或 `npx eslint .` |
| `impl_glob` | `'*.ts' '*.tsx'` |
| `exclude_globs` | `':!**/*.test.ts' ':!**/*.spec.ts' ':!**/*.test.tsx' ':!**/*.spec.tsx' ':!**/*.d.ts'` |
| `test_mapping` | `foo.ts(x)` → 同目录 `foo.test.ts(x)` 或 `foo.spec.ts(x)` |

### Profile: `javascript`

| 字段 | 命令 / 约定 |
|------|------------|
| `build` | `npm run build`（若有） |
| `typecheck` | N/A |
| `test_single` | `npx jest path/to/foo.test.js` 或 `node --test path/to/foo.test.js` |
| `test_all` | `npm test` |
| `lint` | `npm run lint` 或 `npx eslint .` |
| `impl_glob` | `'*.js' '*.jsx' '*.mjs'` |
| `exclude_globs` | `':!**/*.test.js' ':!**/*.spec.js' ':!**/__tests__/**'` |
| `test_mapping` | `foo.js` → `foo.test.js` 或 `__tests__/foo.js` |

### Profile: `android`

| 字段 | 命令 / 约定 |
|------|------------|
| `build` | `./gradlew assembleDebug` 或 `./gradlew :<module>:assembleDebug` |
| `typecheck` | N/A（Kotlin 编译器负责） |
| `test_single` | `./gradlew :<module>:test --tests "com.example.FooTest"` |
| `test_all` | `./gradlew :<module>:test` 或 `./gradlew test` |
| `lint` | `./gradlew :<module>:lint` 或 `./gradlew lint` |
| `impl_glob` | `'*.kt' '*.java'`（限定 `src/main/`） |
| `exclude_globs` | `':!**/src/test/**' ':!**/src/androidTest/**' ':!**/build/**'` |
| `test_mapping` | `src/main/.../Foo.kt` → `src/test/.../FooTest.kt`（包路径镜像） |

> Android 单元测试位于 `src/test/`，仪器测试位于 `src/androidTest/`。纯 UI 逻辑优先 `src/test/` 单元测试；需要 Context / Instrumentation 的用 `src/androidTest/`。

### Profile: `python`

| 字段 | 命令 / 约定 |
|------|------------|
| `build` | `python -m build`（库项目）或跳过（应用项目） |
| `typecheck` | `mypy .` 或 `pyright` |
| `test_single` | `pytest path/to/test_foo.py -v` 或 `pytest path/to/test_foo.py::test_name -v` |
| `test_all` | `pytest --cov` |
| `lint` | `ruff check .` 或 `flake8` 或 `pylint` |
| `impl_glob` | `'*.py'` |
| `exclude_globs` | `':!**/test_*.py' ':!**/tests/**' ':!**/__pycache__/**'` |
| `test_mapping` | `foo.py` → `test_foo.py`（同目录）或 `tests/test_foo.py` |

### Profile: `rust`

| 字段 | 命令 / 约定 |
|------|------------|
| `build` | `cargo build` |
| `typecheck` | N/A（编译即类型检查） |
| `test_single` | `cargo test test_name` 或 `cargo test -p crate_name test_name` |
| `test_all` | `cargo test` |
| `lint` | `cargo clippy -- -D warnings` 或 `cargo fmt --check` |
| `impl_glob` | `'*.rs'` |
| `exclude_globs` | `':!**/tests/**' ':!**/target/**'` |
| `test_mapping` | 同文件 `#[cfg(test)] mod tests` 或 `tests/integration_test.rs` |

### Profile: `java`

| 字段 | 命令 / 约定 |
|------|------------|
| `build` | `./mvnw compile` 或 `./gradlew compileJava` |
| `typecheck` | N/A |
| `test_single` | `./mvnw test -Dtest=FooTest` 或 `./gradlew test --tests FooTest` |
| `test_all` | `./mvnw test` 或 `./gradlew test` |
| `lint` | `./gradlew checkstyleMain` 或 SpotBugs 等项目配置 |
| `impl_glob` | `'*.java'`（限定 `src/main/java/`） |
| `exclude_globs` | `':!**/src/test/**' ':!**/target/**' ':!**/build/**'` |
| `test_mapping` | `src/main/java/.../Foo.java` → `src/test/java/.../FooTest.java` |
