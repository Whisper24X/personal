# 在 playwright-skill 中使用 Cursor CLI

本目录下的 Cursor CLI 会**自动从项目根目录的 `.env` 读取配置**（ainative 根目录下的 `.env`），无需在本目录单独配置。

## 依赖的 .env 变量

在 **ainative 项目根目录** 的 `.env` 中配置：

| 变量                 | 说明                             | 示例           |
| -------------------- | -------------------------------- | -------------- |
| `CURSOR_API_KEY`     | Cursor API Key（必填）           | `key_xxx`      |
| `CURSOR_CLI_MODEL`   | 使用的模型                       | `composer-1`   |
| `CURSOR_MODEL`       | 未设置 CURSOR_CLI_MODEL 时的回退 | `auto`         |
| `CURSOR_CLI_COMMAND` | 可执行命令名（可选）             | `cursor-agent` |

## 用法

在 **ainative 项目根** 或 **本目录** 下执行：

```bash
# 进入 playwright-skill 目录
cd skills/playwright-skill

# 带 prompt 调用 Cursor CLI（配置从 ../../.env 加载）
npm run cursor -- "用 Playwright 打开 https://example.com 并截图"

# 或直接运行脚本
node run-cursor-cli.js "你的任务描述"
```

执行时工作目录为 `skills/playwright-skill/skills/playwright-skill`，便于 Cursor 发现本技能的 `SKILL.md` 与 `run.js`。
