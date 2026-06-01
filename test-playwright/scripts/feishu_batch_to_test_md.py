#!/usr/bin/env python3
"""将 feishu_cdp_batch_extract.md 转为 TEST.md 风格的 Given-When-Then 用例。"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

URL_RE = re.compile(r"\*\*测试用例链接\*\*[：:]\s*(https://[^\s\)]+)")
PRE_RE = re.compile(r"### 前置条件\s*\n+([\s\S]*?)(?=\n### |\Z)")
DETAIL_RE = re.compile(r"### 用例详情（步骤表）\s*\n+([\s\S]*)", re.MULTILINE)


def strip_batch_preamble(text: str) -> str:
    """去掉 `# CDP 批量抓取` / `> 生成时间` 等文首元数据，从第一个 `## ` 小节开始。"""
    m = re.search(r"^## .+$", text, re.MULTILINE)
    if m:
        return text[m.start() :]
    return text


def split_h2_sections(text: str) -> list[str]:
    """按二级标题 `## ` 切分（排除 `###`），忽略文首仅空行。"""
    lines = text.splitlines()
    sections: list[str] = []
    buf: list[str] = []
    for line in lines:
        if line.startswith("## ") and not line.startswith("###"):
            if buf and any(b.strip() for b in buf):
                sections.append("\n".join(buf))
            buf = [line]
        else:
            buf.append(line)
    if buf and any(b.strip() for b in buf):
        sections.append("\n".join(buf))
    return [s for s in sections if s.strip()]


def extract_pipe_rows(detail_block: str) -> list[tuple[int, str, str]]:
    rows: list[tuple[int, str, str]] = []
    for line in detail_block.splitlines():
        line = line.strip()
        if not line.startswith("|") or "---" in line:
            continue
        parts = [p.strip() for p in line.split("|")]
        if parts and parts[0] == "":
            parts = parts[1:]
        if parts and parts[-1] == "":
            parts = parts[:-1]
        if len(parts) >= 3 and parts[0].isdigit():
            num = int(parts[0])
            step = parts[1] if len(parts) > 1 else ""
            exp = parts[2] if len(parts) > 2 else ""
            rows.append((num, step, exp))
    return rows


def parse_plain_fallback(detail_block: str) -> list[tuple[int, str, str]]:
    """无有效管道表时：按「单独一行的序号」分段。"""
    lines = detail_block.splitlines()
    i = 0
    while i < len(lines):
        ln = lines[i].strip()
        if ln in ("序号\t步骤描述\t预期结果\t操作",) or (
            ln.startswith("序号") and "步骤描述" in ln
        ):
            i += 1
            break
        if re.match(r"^\d+$", ln) and i > 0:
            break
        i += 1
    rows: list[tuple[int, str, str]] = []
    while i < len(lines):
        ln = lines[i].strip()
        if ln == "添加一组用例详情":
            break
        if re.match(r"^\d+$", ln):
            num = int(ln)
            i += 1
            chunk: list[str] = []
            while i < len(lines):
                nxt = lines[i].strip()
                if nxt == "添加一组用例详情":
                    break
                if re.match(r"^\d+$", nxt):
                    try:
                        if int(nxt) != num and int(nxt) == num + 1:
                            break
                    except ValueError:
                        pass
                    if int(nxt) > num and len(chunk) > 0:
                        break
                chunk.append(lines[i])
                i += 1
            step_text, exp_text = _split_step_expect("\n".join(chunk))
            rows.append((num, step_text, exp_text))
        else:
            i += 1
    return rows


def _split_step_expect(block: str) -> tuple[str, str]:
    """将一段文本拆成步骤（以 1、2、或 1. 2. 开头）与剩余预期。"""
    lines = block.splitlines()
    step_lines: list[str] = []
    j = 0
    pat = re.compile(r"^(\d+[、．.]|\d+\.\s)")
    while j < len(lines):
        s = lines[j].strip()
        if pat.match(s) or (s and s[0].isdigit() and "、" in s[:5]):
            step_lines.append(lines[j].strip())
            j += 1
        elif s == "" and step_lines:
            j += 1
            break
        elif not step_lines and s:
            step_lines.append(lines[j].strip())
            j += 1
        else:
            break
    expect = "\n".join(lines[j:]).strip()
    step = "\n".join(step_lines).strip()
    if not expect and step_lines:
        expect = "—"
    return step, expect or "—"


def extract_rows(detail_block: str) -> list[tuple[int, str, str]]:
    pipe = extract_pipe_rows(detail_block)
    if pipe:
        return pipe
    return parse_plain_fallback(detail_block)


def infer_type(title: str) -> str:
    if "小程序" in title:
        return "研学小程序"
    if "后台" in title or "渠道订单" in title or "管理后台" in title or "研学管理" in title:
        return "管理后台"
    if "公众号" in title or "订单管理" in title or "课程" in title:
        return "管理后台"
    return "研学"


def fmt_given(precondition: str) -> str:
    """Given：按行保留前置条件，不拆 URL。"""
    pre = (precondition or "—").strip() or "—"
    parts = [p.strip() for p in pre.splitlines() if p.strip()]
    if not parts:
        parts = [pre]
    lines = "**Given**：\n\n"
    for p in parts:
        lines += f"- {p}\n"
    return lines.rstrip() + "\n"


def build_when(step: str) -> str:
    step = (step or "").strip() or "—"
    parts = re.split(r"(?m)(?=(?:^|\s)\d+[、．.])|(?=\d+\.\s)", step)
    bullets = []
    for p in parts:
        p = p.strip()
        if p:
            p = re.sub(r"^[\s、，]+", "", p)
            bullets.append(p)
    if not bullets:
        bullets = [step]
    lines = "**When**：\n\n"
    for b in bullets:
        b = b.replace("\n", " → ")
        lines += f"- {b}\n"
    return lines.rstrip() + "\n"


def build_then(expect: str) -> str:
    expect = (expect or "").strip() or "—"
    chunks = [c.strip() for c in re.split(r"[。\n]", expect) if c.strip()]
    if not chunks:
        chunks = [expect]
    lines = "**Then**：\n\n"
    for c in chunks:
        lines += f"- {c}\n"
    return lines.rstrip() + "\n"


def section_to_cases(
    block: str, start_id: int
) -> tuple[list[str], int]:
    lines = block.splitlines()
    title = lines[0][3:].strip() if lines else "未命名"
    body = "\n".join(lines[1:])
    url_m = URL_RE.search(body)
    feishu_url = url_m.group(1).rstrip("?") if url_m else ""
    pre_m = PRE_RE.search(body)
    precondition = (pre_m.group(1).strip() if pre_m else "") or "—"
    dm = DETAIL_RE.search(body)
    detail_block = (dm.group(1).strip() if dm else "") if dm else ""
    if "### 用例详情（步骤表）" not in body:
        return [], start_id
    rows = extract_rows(detail_block)
    if not rows:
        print(f"[warn] 无步骤行: {title}", file=sys.stderr)
        return [], start_id
    type_str = infer_type(title)
    out: list[str] = []
    nid = start_id
    for num, step, exp in rows:
        tc_id = f"TC-HW-{nid:04d}"
        short_title = title if len(title) <= 60 else title[:57] + "..."
        heading = f"#### {tc_id}：{short_title} - 场景{num}"
        attr = f"""| 属性     | 值 |
| -------- | ------------------------------------- |
| 用例ID   | {tc_id} |
| 类型     | {type_str} |
| 优先级   | P1（飞书未标优先级，默认） |
| 前置条件 | {precondition.replace("|", "\\|").replace(chr(10), " ").replace(chr(13), "")} |
| 关联需求 | {feishu_url or "—"} |"""
        given = fmt_given(precondition)
        when = build_when(step)
        then = build_then(exp)
        out.append(
            f"{heading}\n\n{attr}\n\n{given}\n{when}\n{then}\n---\n"
        )
        nid += 1
    return out, nid


HEADER = """# 测试文档（飞书智能硬件批量）

---

## 第二部分：测试用例（飞书智能硬件批量）

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


def main():
    ap = argparse.ArgumentParser(description="飞书批量抓取 Markdown → TEST 格式")
    ap.add_argument(
        "--input",
        type=Path,
        default=Path("docs/feishu_cdp_batch_extract.md"),
        help="输入的 feishu_cdp_batch_extract.md",
    )
    ap.add_argument(
        "--output",
        type=Path,
        default=Path("TEST-智能硬件-飞书批量.md"),
        help="输出的 TEST 风格 Markdown",
    )
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[1]
    inp = args.input if args.input.is_absolute() else root / args.input
    out = args.output if args.output.is_absolute() else root / args.output
    if not inp.is_file():
        sys.exit(f"找不到输入文件: {inp}")
    text = strip_batch_preamble(inp.read_text(encoding="utf-8"))
    sections = split_h2_sections(text)
    pieces: list[str] = [HEADER]
    nid = 1
    for sec in sections:
        cases, nid = section_to_cases(sec, nid)
        pieces.extend(cases)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(pieces), encoding="utf-8")
    print(f"已写入 {out}，共 {nid - 1} 条用例", file=sys.stderr)


if __name__ == "__main__":
    main()
