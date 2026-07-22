# skill-eval

评测 Cursor **skills** 和 **subagent/agent** 的可复用 harness。零三方依赖，纯 Node + `cursor-agent` CLI。

## 它解决什么

把「这个 skill / agent 到底好不好用」变成**可重复执行、可量化、可回归**的测试：

- **skill 评测**：该不该触发、触发后是否遵守输出规范、内容质量。
- **agent 评测**：任务是否完成、过程是否合规（不越界改文件）、耗时。
- 断言分三层：确定性（`contains`/`regex`/`file_exists`/`max_latency_ms`）+ LLM-as-judge（按 rubric 打分）+ 人工抽检。

## 目录

```
skill-eval/
  runner.mjs          # 主程序
  cases/*.case.json   # 测试用例（持续往这里加）
  fixtures/           # 用例依赖的输入文件
  reports/            # 每次运行的 JSON 报告
```

## 快速开始

```bash
# 1) 配置鉴权（二选一）
export CURSOR_API_KEY=key_xxx        # 或在 skill-eval/.env 写 CURSOR_API_KEY=...

# 2) 先 dry-run，确认 case 格式与 prompt 组装无误（不花钱）
node runner.mjs --dry-run

# 3) 真跑
node runner.mjs                      # 跑全部
node runner.mjs cases/evals-prd.case.json   # 跑单个
node runner.mjs --filter prd         # 只跑文件名含 prd 的
```

退出码：全过=0，有失败=1，运行错误=2 —— 可直接接 CI。

## 离线验证（不连 API）

没有有效 key 时，可用 mock 验证 harness 自身逻辑：

```bash
mkdir -p /tmp/mock
echo '## Summary
...
## Issues
- [P0] 缺少非功能需求章节
## Recommendations
- 补充...
## 需求难度评级：L2' > /tmp/mock/evals-prd.txt

SKILL_EVAL_MOCK_DIR=/tmp/mock node runner.mjs --filter evals
```

mock 模式下：agent 输出取自 `<MOCK_DIR>/<caseId>.txt`，judge 恒为满分（只验证确定性断言与流程）。

## case 格式（`cases/*.case.json`）

| 字段 | 说明 |
|------|------|
| `id` | 唯一标识，报告与 mock 文件名用它 |
| `title` | 可读标题 |
| `skill` | 被测对象备注（仅展示） |
| `prompt` / `promptFile` | 任务输入 |
| `injectSkill` | **注入模式**：把这个 `SKILL.md` 拼进 prompt，测指令本身 |
| `pluginDir` | **真实模式**：`--plugin-dir` 加载本地插件/skill 目录，用自然 prompt 测触发+端到端 |
| `fixtures` | `[{from,to}]`，把输入文件拷进每个 case 的独立临时工作区 |
| `model` | 覆盖默认模型 |
| `timeoutMs` | 单 case 超时 |
| `assertions` | 断言数组，见下 |

### 断言类型

| type | 含义 |
|------|------|
| `contains` / `icontains` / `not_contains` | 子串包含/不含（icontains 忽略大小写） |
| `regex` | 正则匹配（可带 `flags`） |
| `file_exists` | agent 是否在工作区生成了指定文件 |
| `max_latency_ms` | 耗时上限 |
| `judge` | LLM 按 `rubric` 打分，`passScore`（默认 0.8）以上算过 |

## 两种评测模式

- **注入模式**（`injectSkill`）：复现稳、便宜，适合回归 skill 的「输出规范遵守度」。
- **真实模式**（`pluginDir` + 自然 prompt）：贴近线上，能测「skill 路由/触发准确率」与端到端 agent 行为。

## 扩展建议

1. 每发现一个线上 bad case，就固化成一个 `*.case.json`，形成回归集。
2. 同一 case 跑 N 次统计通过率/方差，衡量**稳定性**（agent 非确定性）。
3. judge 分数落在阈值 ±0.1 的样本进人工抽检队列，复核后回灌 rubric。
