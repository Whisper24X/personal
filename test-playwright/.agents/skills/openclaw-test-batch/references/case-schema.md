# 单条用例与 manifest 约定

## 单条用例最小字段

每条原子用例应可独立执行，建议包含：

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 稳定标识，如 `TC-001`、`batch-20260407-001` |
| `title` | 是 | 一句话说明测什么 |
| `preconditions` | 否 | 环境、账号、数据、服务状态 |
| `steps` | 是 | 有序步骤，可编号列表 |
| `expected` | 是 | 可验证的期望结果 |
| `data` | 否 | 测试数据、账号占位符、API 参数等 |

## manifest.json 示例

```json
{
  "version": 1,
  "runId": "20260407-143022",
  "agentId": "test",
  "source": "manual paste / path/to/cases.md",
  "cases": [
    {
      "id": "TC-001",
      "title": "登录成功",
      "preconditions": "测试账号可用",
      "steps": ["打开登录页", "输入合法凭证", "点击登录"],
      "expected": "进入首页，会话有效",
      "data": {}
    }
  ]
}
```

## 纯 Markdown 拆分（cases/*.md）

若不用 JSON，可在 `cases/` 下每条一个文件，文件名即 `id`：

- `cases/TC-001.md`：frontmatter 可选，正文含 title / preconditions / steps / expected。

## 与「恰好 N 条」

- 若用户指定 **N**：拆成 N 条，每条粒度一致；无法均分时在 `README.md` 说明合并/拆分理由。
- 若按清单自然条数：N = `cases.length`，在 manifest 中写明。
