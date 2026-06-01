#!/usr/bin/env python3
"""为 docs/智能硬件测试用例-步骤提炼.md 各节插入 ### 用例详情（步骤表）占位，供 feishu_case_extract_cdp.py --inject 使用。"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

MARKER = "### 用例详情（步骤表）"
# 「—」后须有空行再接 ---，否则 inject_detail_only 的 (?=\n\n---) 无法匹配
DETAIL_BLOCK = "\n\n### 用例详情（步骤表）\n\n—\n"


def process(text: str) -> tuple[str, int]:
    """按 ## 二级标题切分；返回新文本与修改节数。"""
    m = re.search(r"^## .+$", text, re.MULTILINE)
    if not m:
        return text, 0
    head = text[: m.start()]
    rest = text[m.start() :]
    parts = re.split(r"(?=\n## [^#])", rest)
    changed = 0
    out: list[str] = []
    for sec in parts:
        if MARKER in sec:
            out.append(sec)
            continue
        sec2 = sec.replace("**步骤**", "### 导出步骤（Excel 前置条件）", 1)
        idx = sec2.rfind("\n---")
        if idx == -1:
            out.append(sec2)
            continue
        sec2 = sec2[:idx] + DETAIL_BLOCK + sec2[idx:]
        out.append(sec2)
        changed += 1
    return head + "".join(out), changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "path",
        type=Path,
        nargs="?",
        default=Path("docs/智能硬件测试用例-步骤提炼.md"),
        help="目标 Markdown 路径",
    )
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[1]
    path = args.path if args.path.is_absolute() else root / args.path
    text = path.read_text(encoding="utf-8")
    new_text, n = process(text)
    if n == 0:
        print("未修改（可能已含用例详情标记）", file=sys.stderr)
    path.write_text(new_text, encoding="utf-8")
    print(f"已写入 {path}，插入用例详情占位：{n} 节")


if __name__ == "__main__":
    main()
