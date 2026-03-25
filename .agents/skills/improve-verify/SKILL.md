---
name: improve-verify
description: 校验 issues 与代码质量；完成时归档 improveAnalyzeResult.md 至 improveHistory 后删除该文件，并写入 improveVerifyResult.md。
---

# VerifyImprovement - 验证改进效果

在代码改进执行后，依据 `improveAnalyzeResult.md` 中的 JSON、执行阶段输出与代码质量，判定改进是否全部完成。

## 输出规范（强制）

> **重要**：验证结果必须写入文件，不是输出到终端。

**文档路径**：输入/输出路径**必须**从节点 Prompt 获取（工作流 v2 ImproveCode）；示例：`docs/{{gitBranch}}/improveAnalyzeResult.md`、`docs/{{gitBranch}}/improveExecuteResult.md`、`docs/{{gitBranch}}/improveVerifyResult.md`、`docs/{{gitBranch}}/improveHistory.md`。

| 项目         | 规范                                               |
| ------------ | -------------------------------------------------- |
| **输入文件** | `docs/{{gitBranch}}/improveAnalyzeResult.md`（issues 及 status） |
| **输入文件** | `docs/{{gitBranch}}/improveExecuteResult.md`（执行结果）    |
| **结果文件** | `docs/{{gitBranch}}/improveVerifyResult.md`                 |
| **文件格式** | **纯文本固定三行**（见下文「三行格式」）           |
| **状态值**   | 第 1 行：`已完成` / `未完成` / `验证失败`（三选一） |

## 执行步骤

### 1. 检查问题解决状态

**读取 `docs/{{gitBranch}}/improveAnalyzeResult.md`**：

- 解析 JSON，检查 `issues` 中是否仍存在 `status === "pending"`
- 统计已解决与待解决数量
- 若文件不存在或 JSON 无效，输出 `验证失败`

**读取 `docs/{{gitBranch}}/improveExecuteResult.md`**：

- 获取执行阶段的状态和说明
- 若执行失败，记录失败原因

**状态汇总**：

| 情况                              | 判定         |
| --------------------------------- | ------------ |
| 所有 issue 均为 `resolved`（或无 pending） | 进入质量检查 |
| 存在 `pending`                    | 未完成       |
| improveAnalyzeResult.md 不存在或无效 | 验证失败     |

### 2. 验证代码质量

对修复涉及的代码执行质量检查（参照 `code-evaluate-completion` 的检查标准）：

**AI 检查**：

| 检查项          | 检测方式                                   | 严重程度 |
| --------------- | ------------------------------------------ | -------- |
| TODO/FIXME 标记 | 搜索 `TODO`、`FIXME`、`XXX`、`HACK` 关键字 | 高       |
| 占位符          | 搜索 `...`、`// ...`、`/* ... */`          | 高       |
| 空函数体        | 检测 `function xxx() {}`                   | 高       |
| 逻辑错误        | 检查修复代码的逻辑正确性                   | 高       |

**工具检查**（根据项目类型）：

| 项目类型     | 检查命令                         | 说明              |
| ------------ | -------------------------------- | ----------------- |
| 前端（pnpm） | `pnpm lint` / `pnpm build`       | ESLint/TypeScript |
| 前端（npm）  | `npm run lint` / `npm run build` | ESLint/TypeScript |
| Go 项目      | `make lint` / `go build ./...`   | 代码规范/编译检查 |
| 有 Makefile  | `make build`                     | 项目构建检查      |

**Sandbox 环境规则**：

- 有 Sandbox → 所有构建命令在 sandbox 内执行
- 无 Sandbox → 直接执行

### 3. 判定是否完成

**"已完成"必须同时满足以下所有条件**：

1. `improveAnalyzeResult.md` 中 `issues` 无 `pending`（全部 `resolved` 或列表为空且 result 已为无需改进）
2. 代码中无 TODO/FIXME/占位符/空实现
3. 代码构建/lint 检查通过（或项目无相关配置）

**以下任一情况判定为"未完成"**：

1. 仍存在 `status === "pending"` 的 issue
2. 修复的代码引入了新的 TODO/占位符
3. 代码构建失败或 lint 检查不通过

### 4. 追加历史记录并删除状态文件（仅在全部完成时执行）

**当且仅当判定为"已完成"时**，按顺序执行以下操作：

#### 4.1 追加历史记录

在删除 `improveAnalyzeResult.md` 之前，将其完整内容追加到历史记录文档：

1. 读取 `docs/{{gitBranch}}/improveAnalyzeResult.md` 的完整内容（原始文本）
2. 通过 shell 命令获取真实系统时间（**不得自行估算时间**）：

```bash
date '+%Y-%m-%d %H:%M:%S'
```

3. 若 `docs/{{gitBranch}}/improveHistory.md` 不存在，先创建并写入首行：`# 代码改进历史记录`
4. 向 `docs/{{gitBranch}}/improveHistory.md` 末尾追加以下内容（注意是追加，不是覆盖）：

```
---

## YYYY-MM-DD HH:mm:ss

[improveAnalyzeResult.md 的完整内容]

```

- 若内容为空，跳过追加，不影响后续删除步骤

#### 4.2 删除状态文件

使用与节点 Prompt 中 **improveAnalyzeResult.md** **相同的实际路径**删除（即 `docs/<当前任务分支名>/improveAnalyzeResult.md`）。**勿**在 shell 中照抄字面量 `{{gitBranch}}` 作为目录名。

**删除规则**：

- **必须执行删除**：不要写"由于权限限制无法删除"之类的借口，直接删除文件
- **删除文件是标记任务完成的信号之一**：全部完成后删除 `improveAnalyzeResult.md`，便于区分「仍有待办」与「本轮已收尾」
- 你有完整的文件读写和删除权限，请直接执行删除操作
- 如果判定为"未完成"，**不要删除**该文件，系统会再次执行改进循环

### 5. 输出验证结果

将结果以**纯文本**写入 `docs/{{gitBranch}}/improveVerifyResult.md`。

**三行格式（强制）**：

1. **第 1 行**：状态，仅为 `已完成`、`未完成`、`验证失败` 之一（无前后空格）。
2. **第 2 行**：原因摘要（单行，行内禁止换行）。
3. **第 3 行**：详情摘要（单行）：可含 issue 统计、待办摘要、代码质量/构建/lint 结论等；无补充信息时写 `无`。

文件共 **恰好三行**（第 3 行后可跟一个结尾换行符）；不要输出 JSON、不要额外空行。

**确保 `docs/{{gitBranch}}/` 目录存在**，不存在则先创建。

### 示例 - 已完成

```
已完成
所有问题已解决，代码质量检查通过，improveAnalyzeResult.md 已归档并删除
issues 总计 5、已解决 5、待处理 0；代码质量：通过；构建：通过；lint：通过
```

### 示例 - 未完成（仍有未解决问题）

```
未完成
仍有 2 个问题未解决
issues 总计 5、已解决 3、待处理 2（#2 列表加载超过 3 秒 medium；#3 变量命名不规范 low）；代码质量：通过
```

### 示例 - 未完成（代码质量不通过）

```
未完成
所有问题已在 JSON 中标记解决，但代码构建失败
issues 总计 3、已解决 3、待处理 0；代码质量：未通过；构建：失败 TypeScript 编译错误 2 处；lint：通过
```

### 示例 - 验证失败

```
验证失败
docs/{{gitBranch}}/improveAnalyzeResult.md 不存在或无法解析
无
```

## 重要提醒

1. **必须写入文件**：结果必须写入 `docs/{{gitBranch}}/improveVerifyResult.md`，不是输出到终端
2. **三行纯文本**：严格三行，第 2、3 行内不换行；下游按行读取第 1 行即可得状态
3. **确保目录存在**：如果 `docs/{{gitBranch}}/` 目录不存在，需要先创建
4. **已完成时必须先追加历史再删除 improveAnalyzeResult.md**：顺序不能反
5. **历史文件是追加写入**：`docs/{{gitBranch}}/improveHistory.md` 每次追加新条目，不是覆盖
6. **时间必须通过 shell 命令获取**：执行 `date '+%Y-%m-%d %H:%M:%S'` 获取真实系统时间，禁止自行估算
7. **未完成时不要删除 improveAnalyzeResult.md**：保留文件，系统会再次执行改进循环
8. **每次覆盖写入**：每次执行都覆盖 `improveVerifyResult.md`（不是追加）
9. **代码质量标准**：参照 `code-evaluate-completion` 的检查规范，保持团队标准一致
