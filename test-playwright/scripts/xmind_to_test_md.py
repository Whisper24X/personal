#!/usr/bin/env python3
"""从 XMind (.xmind ZIP) 的 content.json 生成与 TEST.md 一致的 BDD 用例 Markdown。"""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path


def get_title(topic: dict) -> str:
    return (topic.get("title") or "").strip()


def paths_to_leaves(topic: dict) -> list[list[dict]]:
    children = (topic.get("children") or {}).get("attached") or []
    if not children:
        return [[topic]]
    out: list[list[dict]] = []
    for c in children:
        for p in paths_to_leaves(c):
            out.append([topic] + p)
    return out


def split_lines(text: str) -> list[str]:
    if not text:
        return []
    return [ln.strip() for ln in re.split(r"\r?\n", text) if ln.strip()]


def split_path(path: list[dict]) -> tuple[list[str], list[str], list[str]]:
    """path[0] 为功能根节点，其后为到叶子的链。"""
    tail = path[1:]
    if not tail:
        return [], [], []
    if len(tail) == 1:
        fg = get_title(path[0])
        return (
            [],
            [f"按测试场景「{fg}」执行相关操作（步骤见脑图）"],
            split_lines(get_title(tail[0])),
        )
    if len(tail) == 2:
        return (
            [],
            split_lines(get_title(tail[0])),
            split_lines(get_title(tail[1])),
        )
    given = split_lines(get_title(tail[0]))
    middle = tail[1:-1]
    when: list[str] = []
    for m in middle:
        when.extend(split_lines(get_title(m)))
    then = split_lines(get_title(tail[-1]))
    return given, when, then


def shorten(s: str, n: int = 90) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) <= n:
        return s
    return s[: n - 1] + "…"


def escape_md_table_cell(s: str) -> str:
    return s.replace("|", "\\|")



# 路径上任一节点含以下子串时，浏览器/MCP 无法独立完成，跳过生成用例
MCP_SKIP_SUBSTRINGS = ("修改数据库", "找开发")


def path_mcp_automatable(path: list[dict]) -> bool:
    for t in path:
        title = get_title(t)
        if any(s in title for s in MCP_SKIP_SUBSTRINGS):
            return False
    return True


def load_content_json(xmind_path: Path) -> list:
    with zipfile.ZipFile(xmind_path, "r") as z:
        raw = z.read("content.json").decode("utf-8")
    return json.loads(raw)


def case_title_for_path(fg: dict, path: list[dict], multi: bool) -> str:
    """多分支时用「功能名 - 场景链」区分；避免仅截断首节点导致标题重复。"""
    tail = path[1:]
    if not multi or not tail:
        return get_title(fg)
    parts = [get_title(t) for t in tail[:-1]]
    chain = " › ".join(p for p in parts if p)
    return f"{get_title(fg)} - {shorten(chain, 120)}"


def build_cases(sheets: list) -> list[dict]:
    root = sheets[0]["rootTopic"]
    features = (root.get("children") or {}).get("attached") or []
    cases: list[dict] = []
    for fg in features:
        paths = paths_to_leaves(fg)
        multi = len(paths) > 1
        for path in paths:
            if not path_mcp_automatable(path):
                continue
            given, when, then = split_path(path)
            title = case_title_for_path(fg, path, multi)
            cases.append(
                {
                    "title": title,
                    "given": given,
                    "when": when,
                    "then": then,
                    "feature": get_title(fg),
                }
            )
    # 标题去重（仍冲突时加序号）
    seen: dict[str, int] = {}
    for c in cases:
        t = c["title"]
        if t in seen:
            seen[t] += 1
            c["title"] = f"{t}（{seen[t]}）"
        else:
            seen[t] = 1
    return cases


PREAMBLE = """# 测试文档

---

## 第二部分：测试用例

### 用例编写规范

#### 优先级定义

| 优先级 | 定义     | 说明                       |
| ------ | -------- | -------------------------- |
| P0     | 核心功能 | 主流程、核心业务，必须通过 |
| P1     | 重要功能 | 重要分支、常用功能         |
| P2     | 一般功能 | 边界条件、异常处理         |
| P3     | 低优先级 | 极端场景、优化建议         |

#### 用例格式说明

- 采用 **Given-When-Then** 格式（BDD风格）
- **Given**：前置条件和测试数据准备
- **When**：执行的操作步骤（含具体导航路径，可直接映射为 Playwright action）
- **Then**：预期结果验证（仅页面可观测结果，可直接映射为 Playwright assertion）

---

"""


def default_precondition(given: list[str]) -> str:
    if given:
        return "；".join(given[:2])
    return "用户已登录研学后台测试环境，具备相应功能权限"


def render_case(idx: int, c: dict) -> str:
    tc_id = f"TC-yanxue-{idx:03d}"
    title = c["title"]
    pre = escape_md_table_cell(default_precondition(c["given"]))
    lines = [
        f"#### {tc_id}：{title}",
        "",
        "| 属性     | 值                                    |",
        "| -------- | ------------------------------------- |",
        f"| 用例ID   | {tc_id}                        |",
        "| 类型     | 研学后台                              |",
        "| 优先级   | P0                                    |",
        f"| 前置条件 | {pre} |",
        "| 关联需求 | PRD-研学后台-P0                       |",
        "",
        "**Given**：",
        "",
    ]
    if c["given"]:
        for g in c["given"]:
            lines.append(f"- {g}")
    else:
        lines.append("- 用户已登录研学后台测试环境（或已进入脑图所述入口页面）")
    lines.extend(["", "**When**：", ""])
    for w in c["when"]:
        lines.append(f"- {w}")
    lines.extend(["", "**Then**：", ""])
    for t in c["then"]:
        lines.append(f"- {t}")
    lines.extend(["", "---", ""])
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description="XMind → TEST.md 风格 Markdown")
    ap.add_argument(
        "xmind",
        nargs="?",
        default="/Users/yangcong/研学后台P0 case.xmind",
        type=Path,
        help="输入 .xmind 文件路径",
    )
    ap.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "TEST-研学后台-P0.md",
        help="输出 Markdown 路径",
    )
    args = ap.parse_args()

    sheets = load_content_json(args.xmind)
    cases = build_cases(sheets)
    parts = [PREAMBLE]
    for i, c in enumerate(cases, start=1):
        parts.append(render_case(i, c))
    args.output.write_text("\n".join(parts).rstrip() + "\n", encoding="utf-8")
    print(f"Wrote {len(cases)} cases to {args.output}")


if __name__ == "__main__":
    main()
