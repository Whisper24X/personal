---
name: xmind-zen-export
description: >-
  Defines how to produce XMind Zen–compatible mind maps (ZIP bundles with
  content.json) from structured text such as test use cases: file layout, topic
  JSON shape, and chain hierarchy (用例标题→前置条件→执行步骤→预期结果). Use when
  the user asks to export to XMind, generate .xmind, 脑图, mind map from use cases,
  or align Markdown with XMind Zen format.
---

# XMind Zen 导出（content.json 打包）

## When to Apply

在以下情况启用本技能：

- 需要**新建或修改**可被 **XMind 2020+ / XMind Zen** 直接打开的 **`.xmind`** 文件；
- 从 **Markdown 用例**（前置条件、执行步骤、预期结果）或类似结构生成脑图；
- 需要说明「为什么不能只用旧版 `content.xml`」或如何与 **OPML** 区分。

## Hard Rules

### 1. 文件格式（必须）

- **`.xmind` = ZIP 压缩包**，根目录至少包含：
  - `content.json` — 工作簿与主题树（主数据）；
  - `manifest.json` — 条目清单（可为 `{"file-entries": {"content.json": {}, "metadata.json": {}}}` 一类最小结构）；
  - `metadata.json` — 可为空对象 `{}`。
- **不要**仅生成旧版 XMind 8 的 **`content.xml`** 作为唯一载体 — 新版客户端常无法可靠打开；若需兼容极旧客户端，另提供 **OPML** 或官方导出，而非替代上述三文件方案。

### 2. 主题节点 JSON（最小约定）

每个主题是一个对象，至少包含：

- `"id"`：唯一字符串（常用 UUID）；
- `"class"`：`"topic"`；
- `"title"`：显示文本（允许 `\n` 多行）；
- `"titleUnedited"`：布尔，生成脚本常设为 `true`；
- 若有子主题：`"children": { "attached": [ ...topic... ] }`。

子主题列表键名使用 **`attached`**（与 XMind Zen / xmindmark 导出一致）。

### 3. 用例类脑图的语义层级（与 AINative 约定一致）

对「测试用例 / 验收用例」类内容，**前置条件、执行步骤、预期结果不得作为同一父节点下的三个并列分支**。应采用**链式嵌套**（每一级只有一个子节点延续下一节）：

1. **用例标题**（根下的一条用例）
2. → **前置条件**（唯一子主题）
3. → **执行步骤**（唯一子主题）
4. → **预期结果**（唯一子主题；其下通常不再挂子主题）

各节若有多条 bullet，**合并为同一节点标题内的多行文本**：在节标题后换行，再使用 **`1. …` `2. …`** 编号列表（与 Markdown 有序列表可读性一致），避免「一步一个分支」或「一条预期一个分支」造成层级过宽。

### 4. 与源文档同步

- 若仓库中存在 **Markdown 源**（如 `docs/testing/core-use-cases.md`），脑图内容应与之一致；修改用例后应**重新运行生成脚本**（若项目提供），避免手改 `.xmind` 与文档漂移。

### 5. 可读性与范围

- 脑图内**不**强行放入「接口或说明」「当前验收说明」等长文附录，除非用户明确要求；优先保证主路径：**条件 → 步骤 → 结果**。
- **OPML** 可作为通用大纲备用格式；其树形可与 `.xmind` 摘要一致，但 **XMind Zen 的权威结构以 `content.json` 为准**。

## Workflow

### 生成或修改 `.xmind`

1. 确认目标客户端为 **XMind Zen / 2020+**（或用户指定）。
2. 构建 **ZIP**：写入 `content.json`、`manifest.json`、`metadata.json`。
3. 在 `content.json` 中组装 `sheet` → `rootTopic` → 各 `topic`；用例节点按 **§3 链式嵌套** 生成。
4. 多行条目使用 **`merged_numbered(lines)`** 一类函数：`"\n".join(f"{i+1}. {s}" for i, s in enumerate(lines))`，写入对应节**标题**（`title`）中，节名与正文之间用 **`\n\n`** 分隔。
5. 保存为 `.xmind`，在 XMind 中打开自检层级与换行显示。

### 与现有脚本对齐（本仓库）

- 参考实现：`docs/testing/build-core-use-cases-xmind.py`（相对仓库根目录）。
- 重新生成命令：`python3 docs/testing/build-core-use-cases-xmind.py`（在仓库根目录执行）。

## Out of Scope

- 不规定 XMind 云同步、分享链接或协作流程；
- 不替代专业测试管理工具的用例 ID 与追溯矩阵；
- 若用户需要 **Freemind / MindManager** 等其它格式，需另述导出规则，本技能不覆盖。

## Example Trigger Phrases

- 「按我们之前说的规则生成 xmind」
- 「用例导出成 XMind Zen」
- 「content.json 打包的脑图怎么建」
- 「前置条件执行步骤预期结果不要同级」

## See Also

- 技术细节与字段说明：同目录 [`reference.md`](reference.md)。
