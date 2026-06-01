---
name: feishu-card-report
description: 将分析结果、测试报告、工单汇总、数据洞察等内容格式化为飞书消息卡片（卡片搭建器 JSON）。当用户要求"输出飞书卡片"、"发飞书"、"生成飞书报告"、"卡片格式"、"推送到飞书"时使用。支持标准报告、测试结果、告警通知、数据汇总四种场景模板。
---

# 飞书消息卡片报告 Skill

将任意报告内容输出为飞书卡片搭建器兼容的 JSON，可直接粘贴到飞书机器人 Webhook 或卡片搭建器预览。

## 卡片 JSON 骨架

```json
{
  "config": { "wide_screen_mode": true },
  "header": {
    "title": { "tag": "plain_text", "content": "{{标题}}" },
    "template": "{{主题色}}"
  },
  "elements": []
}
```

`template` 颜色对照：

| 语义 | 值 |
|------|-----|
| 普通信息 | `"blue"` |
| 成功/通过 | `"green"` |
| 警告 | `"yellow"` |
| 错误/失败 | `"red"` |
| 中性 | `"grey"` |
| 紫色（测试/分析） | `"purple"` |

---

## 常用 elements 组件速查

### 富文本段落
```json
{
  "tag": "div",
  "text": { "tag": "lark_md", "content": "**加粗** 普通 `code`\n- 列表项" }
}
```

### 水平分割线
```json
{ "tag": "hr" }
```

### 键值字段组（fields 两列布局）
```json
{
  "tag": "div",
  "fields": [
    { "is_short": true, "text": { "tag": "lark_md", "content": "**环境**\n生产" } },
    { "is_short": true, "text": { "tag": "lark_md", "content": "**耗时**\n3m 22s" } }
  ]
}
```

### 底部备注（note）
```json
{
  "tag": "note",
  "elements": [
    { "tag": "plain_text", "content": "生成时间：2026-05-29 12:00 · 数据来源：CI/CD" }
  ]
}
```

### 操作按钮（action）
```json
{
  "tag": "action",
  "actions": [
    {
      "tag": "button",
      "text": { "tag": "plain_text", "content": "查看详情" },
      "type": "primary",
      "url": "https://example.com/report"
    }
  ]
}
```

### 图片
```json
{
  "tag": "img",
  "img_key": "{{飞书图片key}}",
  "alt": { "tag": "plain_text", "content": "图表描述" }
}
```

---

## 四种场景模板

### 模板 A — 测试执行报告

```json
{
  "config": { "wide_screen_mode": true },
  "header": {
    "title": { "tag": "plain_text", "content": "✅ 测试执行报告" },
    "template": "green"
  },
  "elements": [
    {
      "tag": "div",
      "fields": [
        { "is_short": true, "text": { "tag": "lark_md", "content": "**执行环境**\n{{env}}" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**执行时间**\n{{duration}}" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**通过 / 失败 / 跳过**\n🟢 {{passed}} / 🔴 {{failed}} / ⚪ {{skipped}}" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**通过率**\n{{pass_rate}}%" } }
      ]
    },
    { "tag": "hr" },
    {
      "tag": "div",
      "text": { "tag": "lark_md", "content": "**失败用例**\n{{#each failed_cases}}\n- ❌ {{name}}：{{reason}}\n{{/each}}" }
    },
    {
      "tag": "action",
      "actions": [
        { "tag": "button", "text": { "tag": "plain_text", "content": "查看完整报告" }, "type": "primary", "url": "{{report_url}}" }
      ]
    },
    {
      "tag": "note",
      "elements": [{ "tag": "plain_text", "content": "触发方式：{{trigger}} · {{timestamp}}" }]
    }
  ]
}
```

> 失败时将 `header.template` 改为 `"red"`，标题改为 `"❌ 测试执行报告"`。

---

### 模板 B — 数据汇总 / 周报

```json
{
  "config": { "wide_screen_mode": true },
  "header": {
    "title": { "tag": "plain_text", "content": "📊 {{报告标题}}" },
    "template": "blue"
  },
  "elements": [
    {
      "tag": "div",
      "text": { "tag": "lark_md", "content": "**摘要**\n{{summary}}" }
    },
    { "tag": "hr" },
    {
      "tag": "div",
      "text": { "tag": "lark_md", "content": "**关键指标**\n| 指标 | 本期 | 上期 | 变化 |\n|------|------|------|------|\n{{#each metrics}}\n| {{name}} | {{current}} | {{previous}} | {{delta}} |\n{{/each}}" }
    },
    { "tag": "hr" },
    {
      "tag": "div",
      "text": { "tag": "lark_md", "content": "**待关注事项**\n{{#each todos}}\n- {{icon}} {{content}}\n{{/each}}" }
    },
    {
      "tag": "note",
      "elements": [{ "tag": "plain_text", "content": "统计周期：{{period}} · 生成人：{{author}}" }]
    }
  ]
}
```

---

### 模板 C — 告警通知

```json
{
  "config": { "wide_screen_mode": true },
  "header": {
    "title": { "tag": "plain_text", "content": "🚨 {{告警标题}}" },
    "template": "red"
  },
  "elements": [
    {
      "tag": "div",
      "fields": [
        { "is_short": true, "text": { "tag": "lark_md", "content": "**级别**\n{{level}}" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**触发时间**\n{{time}}" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**影响范围**\n{{scope}}" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**负责人**\n{{owner}}" } }
      ]
    },
    { "tag": "hr" },
    { "tag": "div", "text": { "tag": "lark_md", "content": "**告警详情**\n{{detail}}" } },
    { "tag": "div", "text": { "tag": "lark_md", "content": "**建议处理步骤**\n{{steps}}" } },
    {
      "tag": "action",
      "actions": [
        { "tag": "button", "text": { "tag": "plain_text", "content": "立即处理" }, "type": "danger", "url": "{{action_url}}" },
        { "tag": "button", "text": { "tag": "plain_text", "content": "查看监控" }, "type": "default", "url": "{{monitor_url}}" }
      ]
    }
  ]
}
```

---

### 模板 D — 工单 / 任务汇总

```json
{
  "config": { "wide_screen_mode": true },
  "header": {
    "title": { "tag": "plain_text", "content": "🎫 {{工单汇总标题}}" },
    "template": "purple"
  },
  "elements": [
    {
      "tag": "div",
      "fields": [
        { "is_short": true, "text": { "tag": "lark_md", "content": "**总计**\n{{total}}" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**待处理**\n{{pending}}" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**处理中**\n{{in_progress}}" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**已完成**\n{{closed}}" } }
      ]
    },
    { "tag": "hr" },
    {
      "tag": "div",
      "text": { "tag": "lark_md", "content": "**工单列表**\n{{#each tickets}}\n**[{{id}}] {{title}}** — {{status}} · {{assignee}}\n{{/each}}" }
    },
    {
      "tag": "note",
      "elements": [{ "tag": "plain_text", "content": "统计时间：{{timestamp}} · 数据来源：知识库" }]
    }
  ]
}
```

---

## 输出格式规范（重要）

**禁止把 JSON 当正文直接倒入飞书消息**。JSON 本身不会在飞书中自动渲染为卡片，直接发送会显示成一坨代码。

### 正确的输出结构

每次使用本 skill 输出报告时，必须按以下顺序组织回复：

**第一部分：摘要说明（自然语言）**

用 2-4 句话概括报告核心结论，让用户在看卡片前就知道重点。

**第二部分：卡片 JSON（代码块）**

````
```json
{ ...完整卡片 JSON... }
```
````

**第三部分：发送指引（固定格式）**

```
📬 如何让卡片在飞书正确显示：

方式一（推荐）— 卡片搭建器预览：
  粘贴上方 JSON → https://open.feishu.cn/tool/cardbuilder

方式二 — Webhook 机器人发送：
  将上方 JSON 作为 card 字段，POST 以下 payload 到机器人 Webhook URL：
  {
    "msg_type": "interactive",
    "card": { ...上方JSON... }
  }

⚠️ 直接把 JSON 复制粘贴到飞书对话框发送不会渲染为卡片。
```

---

## 生成步骤

1. 根据报告类型选择模板（A/B/C/D）
2. 用实际数据填充所有 `{{占位符}}`
3. 根据整体结论调整 `header.template` 颜色
4. 按上方"正确的输出结构"三段式输出，**不要跳过摘要和发送指引**

## JSON 内容规范

- 输出完整可用的 JSON，不得含注释（`// ...`）
- `lark_md` 支持：`**加粗**`、`_斜体_`、`` `行内代码` ``、`[链接文字](url)`、`-` 列表、Markdown 表格
- 长报告优先用 `fields` 两列布局提升信息密度
- 末尾必须有 `note` 组件注明数据来源与生成时间
