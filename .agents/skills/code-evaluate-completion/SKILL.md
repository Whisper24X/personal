---
name: code-evaluate-completion
description: 评估代码完整性并修复问题。读取 applyResult.md 获取修改的文件列表，执行 AI 检查和工具检查，发现问题则修复。由 WriteCode Action 在 apply 之后调用。
---

# Code Evaluate Completion

评估代码完整性并修复发现的问题。在 `code-task-apply` 执行后调用，确保生成的代码完整且可运行。

## 输出规范（强制）

**文档路径**：输入、输出路径**必须**从 prompt 获取（如 `docs/{{gitBranch}}/applyResult.md`、`docs/{{gitBranch}}/evaluateResult.md`）。

| 项目         | 规范                                             |
| ------------ | ------------------------------------------------ |
| **输入文件** | 路径由 prompt 指定（如 `docs/{{gitBranch}}/applyResult.md`） |
| **输出文件** | 路径由 prompt 指定（如 `docs/{{gitBranch}}/evaluateResult.md`） |
| **检查范围** | 以 applyResult.md 中的文件为主，可扩展到相关代码 |
| **修复要求** | 发现问题必须全部修复，不允许标记为未解决         |

## 执行步骤

### 1. 读取执行结果

读取 prompt 指定的 applyResult 文件（如 `docs/{{gitBranch}}/applyResult.md`），获取：

- 本次修改的文件列表
- 本次完成的任务列表

如果文件不存在，输出错误并结束。

### 2. AI 检查

对 applyResult.md 中列出的每个文件进行扫描检查：

**检查项**：

| 检查项          | 检测方式                                   | 严重程度 |
| --------------- | ------------------------------------------ | -------- |
| TODO/FIXME 标记 | 搜索 `TODO`、`FIXME`、`XXX`、`HACK` 关键字 | 高       |
| 占位符          | 搜索 `...`、`// ...`、`/* ... */`、`pass`  | 高       |
| 空函数体        | 检测 `function xxx() {}`、`func xxx() {}`  | 高       |
| 空类/空接口     | 检测 `class Xxx {}`、`interface Xxx {}`    | 高       |
| 未实现方法      | 检测 `throw NotImplementedError`、`panic`  | 高       |
| 伪代码/注释实现 | 检测注释掉的代码块作为"实现"               | 中       |

**注意**：所有 TODO/FIXME 标记都必须处理，不允许有任何遗留。

### 3. 工具检查

执行构建和 Lint 检查，验证代码可运行且无语法错误。

**检查步骤**：

1. **判断项目类型和构建方式**：
   - 检查项目根目录的配置文件（Makefile、package.json 等）
   - 确定使用哪种构建命令

2. **执行构建检查**（根据项目配置）：

| 项目类型     | 构建命令         | 说明                      |
| ------------ | ---------------- | ------------------------- |
| 有 Makefile  | `make build`     | 直接执行             |
| 前端（pnpm） | `pnpm build`     | 检查 TypeScript 编译 |
| 前端（npm）  | `npm run build`  | 检查 TypeScript 编译 |
| Go 项目      | `go build ./...` | 直接执行             |

3. **执行 Lint 检查**（必须执行）：

| 项目类型     | Lint 命令                          | 说明                 |
| ------------ | ---------------------------------- | -------------------- |
| 前端（pnpm） | `pnpm lint`                        | ESLint/Prettier 检查 |
| 前端（npm）  | `npm run lint`                     | ESLint/Prettier 检查 |
| Go 项目      | `make lint` 或 `golangci-lint run` | 代码规范检查         |

4. **TypeScript 类型检查**（前端项目）：

```bash
pnpm type-check  # 或 npm run type-check
```

**注意事项**：

- Lint 检查能够发现语法错误（如 Missing semicolon）、类型错误等
- 如果项目没有配置 lint 脚本，至少执行构建检查

### 4. 问题修复

对于发现的每个问题：

1. **定位问题**：确定问题所在的文件和行号
2. **分析原因**：理解为什么代码不完整
3. **实现修复**：
   - TODO/FIXME → 实现完整逻辑
   - 空函数体 → 补全函数实现
   - 占位符 → 替换为实际代码
4. **验证修复**：确保修复后代码完整且可编译

**修复原则**：

- 只修复问题点，不改动其他代码
- 保持代码风格一致
- 确保修复后可编译通过

### 5. 输出结果

将评估结果写入 prompt 指定的路径（如 `docs/{{gitBranch}}/evaluateResult.md`）。

**完整通过格式**：

```markdown
完整
所有代码完整，无质量问题

## 检查摘要

- 检查文件数：5
- AI 检查：通过
- 工具检查：通过
- 发现问题：0
- 修复问题：0
```

**有问题但已修复格式**：

```markdown
完整
发现 3 个问题，已全部修复

## 检查摘要

- 检查文件数：5
- AI 检查：发现 2 个问题
- 工具检查：发现 1 个问题
- 发现问题：3
- 修复问题：3

## 已修复的问题

1. backend/src/biz/device_mode.go:45 - TODO: implement validation → 已实现参数验证逻辑
2. backend/src/biz/device_mode.go:78 - 空函数体 ApplyDefaultMode() → 已实现完整方法
3. frontend/src/pages/device/index.vue:120 - 占位符 ... → 已实现实际逻辑
```

## 注意事项

1. **检查范围**：以 applyResult.md 中的文件为主，但可以扩展到项目中相关的代码文件
2. **修复尽可能小**：只修复发现的问题，不进行大范围重构
3. **必须全部修复**：发现的问题必须全部修复，不允许标记为"未解决"或跳过
4. **修复后验证**：修复代码后必须重新执行构建检查，确保没有引入新问题
5. **任务状态**：本 Skill 不修改 tasks.md 中的任务状态，任务标记由 code-task-apply 负责
