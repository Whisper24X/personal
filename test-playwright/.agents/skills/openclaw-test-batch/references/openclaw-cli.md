# OpenClaw CLI：批量逐条执行

## 核心命令

```text
openclaw agent [options]
```

对**单条用例**构造一条消息，通过 `-m` / `--message` 发送给 Gateway 上的 Agent。

常用参数：

| 参数 | 说明 |
|------|------|
| `--agent <id>` | 指定 Agent，如 `main`、`test` |
| `-m`, `--message <text>` | 本条要执行的内容（建议**只含当前用例**） |
| `--session-id <id>` | 固定会话；省略则通常开启新会话 |
| `--json` | 结构化输出，便于脚本解析 |
| `--timeout <seconds>` | 单轮超时（默认常较大，可按用例调） |
| `--thinking <level>` | `off` \| `minimal` \| `low` \| `medium` \| `high` \| `xhigh` |

使用 `openclaw agent --help` 查看本机最新选项。

## 会话策略

- **独立上下文（推荐用于互不干扰的用例）**：每条不传 `--session-id`，减少前序失败污染。
- **共享登录态或连续状态**：多条共用同一 `--session-id`；一条失败可能影响后续，需在汇总中标注。

## Shell：按 manifest 逐条调用（示例）

假设已生成 `manifest.json`，且用 `jq` 取出每条（需本机有 `jq`）：

```bash
AGENT_ID="test"
RUN_DIR="/path/to/openclaw-batch/20260407-143022"
MANIFEST="${RUN_DIR}/manifest.json"

count=$(jq '.cases | length' "$MANIFEST")
for i in $(seq 0 $((count - 1))); do
  CASE_JSON=$(jq -c ".cases[$i]" "$MANIFEST")
  MSG="请作为测试执行助手，仅执行以下一条用例，并按约定输出结果 JSON：${CASE_JSON}"
  openclaw agent --agent "$AGENT_ID" -m "$MSG" --json | tee "${RUN_DIR}/results/raw-$(jq -r ".cases[$i].id" "$MANIFEST").json"
done
```

## Shell：按 cases 目录下 md 文件逐条调用（示例）

```bash
AGENT_ID="test"
RUN_DIR="/path/to/openclaw-batch/20260407-143022/cases"
for f in "$RUN_DIR"/*.md; do
  [ -f "$f" ] || continue
  MSG="请执行附件中的单条测试用例，并输出结构化结果：$(cat "$f")"
  openclaw agent --agent "$AGENT_ID" -m "$MSG" --json
done
```

注意：长消息注意 shell 引号转义；复杂内容可改为 `MSG=$(cat file.txt)` 或 `read` heredoc。

## 与人工在渠道中投喂

若不用 CLI，可在已绑定的聊天渠道中**逐条发送**与同构的「单条用例」消息；本 skill 的拆解与落盘约定仍然适用，便于留档与汇总。
