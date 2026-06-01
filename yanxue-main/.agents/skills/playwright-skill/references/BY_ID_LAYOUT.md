# 备选 B：每用例一文件（`by-id`）

与 `SKILL.md` 中「脚本组织 · 备选 B」一致。留档目录：

```text
docs/<gitBranch>/artifacts/playwright/by-id/
  playwright-test-TC-F-001.js
  playwright-test-TC-F-002.js
  …
```

## 命名规则

- 固定前缀 + **完整用例 ID** + `.js`：`playwright-test-<TC-F-001>.js`（含 `TC-` 与连字符）。
- 与 `extract-tc-ids.js` 输出顺序无关；**文件个数**须等于用例个数。

## 单文件最小骨架

每个文件为**可独立**由 `run.js` 执行的脚本（与 suite 相同：顶部 `applyLoginEnvIfUnset`、`TARGET_URL`、`chromium.launch`、`page.goto`、按需登录）。未实现：

```javascript
/**
 * TEST.md — TC-F-002
 * 状态: skipped — 待实现
 */
(async () => {
  console.log('[SKIP] TC-F-002: 待实现');
})();
```

已实现则写完整 Given/When/Then 步骤。

## 批量占位（可选）

快速生成与 TEST.md 等量的占位文件（不替代业务实现）：

```bash
node "$SKILL_DIR/scripts/generate-tc-stubs.js" /path/to/TEST.md /path/to/artifacts/playwright/by-id
# 覆盖已有：加 --force
```

## 校验

```bash
node "$SKILL_DIR/scripts/validate-tc-by-id-dir.js" /path/to/TEST.md /path/to/artifacts/playwright/by-id
```

## 与 `run.js` 执行

一次只跑一个用例时：

```bash
cd $SKILL_DIR && node run.js /tmp/playwright-test-TC-F-001.js
```

生成时先把文件写到 `/tmp` 再复制到 `by-id/` 留档（与技能「脚本写入 `/tmp`」一致）。
