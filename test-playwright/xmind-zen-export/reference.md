# XMind Zen 导出 — 技术参考

## 包结构

```
something.xmind (ZIP)
├── content.json
├── manifest.json
└── metadata.json
```

`content.json` 通常为 **JSON 数组**，元素为 **sheet** 对象；每个 sheet 含 `rootTopic`（根主题）。

## Sheet 与根主题（示例形状）

与实现相关的字段（不必与官方全量 schema 逐字一致，但需能被客户端识别）：

- `sheet`：`id`、`class: "sheet"`、`title`、`topicPositioning`（如 `"fixed"`）、`relationships`（可为 `[]`）、`rootTopic`。
- `rootTopic`：即一个 `topic`，可挂多层 `children.attached`。

## Topic 对象（生成侧最小集）

| 字段 | 说明 |
|------|------|
| `id` | 唯一 ID，字符串 |
| `class` | `"topic"` |
| `title` | 显示文本；可用 `\n` 换行 |
| `titleUnedited` | 布尔 |
| `structureClass` | 根主题可选，如 `"org.xmind.ui.logic.right"` |
| `children.attached` | 子主题数组 |

## 链式用例（伪代码）

```python
def merged_numbered(lines: list[str]) -> str:
    return "\n".join(f"{i + 1}. {s}" for i, s in enumerate(lines))

def use_case(title: str, pre: list[str], steps: list[str], expect: list[str]) -> dict:
    expect_node = topic(f"预期结果\n\n{merged_numbered(expect)}")
    steps_node = topic(
        f"执行步骤\n\n{merged_numbered(steps)}",
        attached=[expect_node],
    )
    pre_node = topic(
        f"前置条件\n\n{merged_numbered(pre)}",
        attached=[steps_node],
    )
    return topic(title, attached=[pre_node])
```

## 参考实现与上游线索

- 本仓库脚本：`docs/testing/build-core-use-cases-xmind.py`
- 结构线索：[xmindmark `xmindmark-to-xmind.ts`](https://github.com/xmindltd/xmindmark/blob/main/src/lib/xmindmark-to-xmind.ts)（类型与打包思路）

## OPML 与 XMind 的分工

| 格式 | 用途 |
|------|------|
| `.xmind`（Zen JSON） | XMind 2020+ 主路径；完整主题树与样式能力 |
| `.opml` | 通用大纲、旧版导入、轻量 diff；不必与 `content.json` 逐节点等价 |

## 常见问题

**Q: 能否把「执行步骤」做成多个并列子主题（一步一支）？**  
A: 在 AINative 约定中**不推荐**：步骤与预期应合并为单节点内编号文本，以免与「链式四层级」混用导致版面臃肿。若业务强需求，需在文档中单独约定。

**Q: `manifest.json` 必须很复杂吗？**  
A: 许多场景下最小 `file-entries` 即可；以目标 XMind 版本能打开为准。
