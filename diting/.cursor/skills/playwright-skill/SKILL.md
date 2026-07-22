---
name: playwright-skill
description: Playwright-only browser automation. Use when the user, workflow, or ui-automation-run requires Playwright TEST.md execution, by-id scripts, browser evidence, or rerun automation.
---

# Playwright Browser Automation

仅当用户、workflow 或 `ui-automation-run` 明确指定 `Playwright` 时使用。Diting UI 自动化执行阶段由 `ui-automation-run` 调用本 skill。

## Path Resolution

Use `$SKILL_DIR` as this skill directory:

```text
skills/playwright-skill/
```

All commands, scripts, references, and helpers are resolved from this directory.

## Boundaries

- 本 skill 只负责 Playwright 脚本生成、覆盖校验与执行，不负责修改业务代码。
- 如果任务明确禁止 Playwright，停止并把阻断交回调用方。
- 生成脚本前仍需尊重 `覆盖范围`、`本轮是否执行`、`环境前提`、`不执行原因`。
- 原生小程序不作为本 skill 的直接执行目标；Taro 跨端项目必须使用目标仓启动后的 H5 URL/路由生成和执行脚本。
- 缺少 H5 入口或断言依赖原生小程序专属能力时，不生成脚本，交回 `ui-automation-run` 记录 `SKIPPED_NOT_EXECUTABLE`。
- `本轮是否执行=否` 的 case 不生成脚本。

## Required References

- [`references/BY_ID_LAYOUT.md`](references/BY_ID_LAYOUT.md)
- [`references/SUITE_TEMPLATE.md`](references/SUITE_TEMPLATE.md)
- [`references/COMMON_PATTERNS.md`](references/COMMON_PATTERNS.md)
- [`references/LOGIN_PATTERNS.md`](references/LOGIN_PATTERNS.md)
- [`references/HTTP_HEADERS.md`](references/HTTP_HEADERS.md)

## Fixed Order

基于 `TEST.md` 时必须先生成脚本，再执行：

1. 抽取并分类 case ID。
2. 默认为管理后台、Web端、H5端等浏览器可执行 case 生成 `docs/.../artifacts/playwright/by-id/playwright-test-<TC-ID>.js`；Taro 小程序按 H5端处理。
3. 使用 `scripts/validate-tc-by-id-dir.js` 或 `scripts/validate-tc-coverage.js` 对账。
4. 更新 `AUTOMATED_TEST.md` 总表。
5. 最后执行 `node run.js ...` 或 `scripts/run-by-id-sequential.js`。

`run.js` 只执行已有脚本，不会根据 `TEST.md` 生成代码。

## Commands

```bash
cd "$SKILL_DIR"
node scripts/extract-tc-ids.js /path/to/TEST.md --json --type 管理后台 --priority P0 --executable
node scripts/extract-tc-ids.js /path/to/TEST.md --json --type H5端 --priority P0 --executable
node scripts/validate-tc-by-id-dir.js /path/to/TEST.md /path/to/artifacts/playwright/by-id --type 管理后台 --priority P0 --executable
node scripts/validate-tc-by-id-dir.js /path/to/TEST.md /path/to/artifacts/playwright/by-id --type H5端 --priority P0 --executable
node scripts/run-by-id-sequential.js /path/to/TEST.md /path/to/artifacts/playwright/by-id --type 管理后台
node scripts/run-by-id-sequential.js /path/to/TEST.md /path/to/artifacts/playwright/by-id --type H5端
```

脚本必须先写入 `/tmp/playwright-test-*.js`，再同步到项目 artifacts；不得写入 skill 目录。
