#!/usr/bin/env python3
"""
Build docs/testing/core-use-cases.xmind (XMind Zen content.json bundle).

单一数据源：同目录下的 core-use-cases.md（解析 **前置条件 / 执行步骤 / 预期结果**）。
运行：
  python3 docs/testing/build-core-use-cases-xmind.py

Reference: https://github.com/xmindltd/xmindmark/blob/main/src/lib/xmindmark-to-xmind.ts
"""
from __future__ import annotations

import json
import re
import shutil
import uuid
import zipfile
from pathlib import Path

OUT = Path(__file__).resolve().parent / "core-use-cases.xmind"
MD = Path(__file__).resolve().parent / "core-use-cases.md"
BUILD = Path(__file__).resolve().parent / ".xmind-build"

UC_HEAD = re.compile(r"^###\s+(UC-\d+\s+.+)\s*$")
STEP_LINE = re.compile(r"^\s*(\d+)\.\s+(.+?)\s*$")

# 生成 XMind 时把路由写成白话（较长路径优先，避免截断）
ROUTE_TO_PLAIN: list[tuple[str, str]] = [
    ("/business-lines/invite", "业务线邀请页"),
    ("/projects/:projectId/goals", "某项目下的目标列表页"),
    ("/projects/workflows", "项目工作流页"),
    ("/task-detail/:id", "任务详情页"),
    ("/goals/:goalId", "目标详情页"),
    ("/knowledge-base", "知识库页"),
    ("/automations", "自动化页"),
    ("/business-lines", "业务线管理页"),
    ("/settings", "设置页"),
    ("/dashboard", "工作台"),
    ("/tasks", "任务页"),
    ("/goals", "目标页"),
    ("/login", "登录页"),
    ("/skills", "技能页"),
    ("/kanban", "看板页"),
    ("/mcp", "MCP 页"),
    ("/git", "Git 集成页"),
    ("/home", "首页"),
    ("/users", "用户页"),
    ("/projects", "项目入口页"),
]

LOCAL_BACKEND = re.compile(r"https?://127\.0\.0\.1:9000(?:/[^\s\)`。，]*)?")


def xmind_plain_text(text: str) -> str:
    """脑图节点用纯文字：去掉 Markdown、反引号、前端路由与接口路径写法，便于非技术阅读。"""
    s = text
    # Markdown 链接、加粗
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    # 已知前端路由 → 白话
    for path, label in ROUTE_TO_PLAIN:
        esc = re.escape(path)
        s = re.sub(rf"(?<![\w/]){esc}(?![\w/.:-])", label, s)
    s = LOCAL_BACKEND.sub("本地后端（默认 9000）", s)
    s = re.sub(r"(?<![\w/])/(?![\w/])", "站点根路径", s)
    # 行内代码反引号去掉，保留字面值
    s = re.sub(r"`([^`]+)`", r"\1", s)
    # 后端 REST 路径整段改为口语
    s = re.sub(
        r"\b(GET|POST|PATCH|PUT|DELETE)\s+/v1[\w/\-]*",
        "调用后端接口",
        s,
    )
    # 仍残留的 /xxx 形式（非单词内），视为页面路径
    s = re.sub(
        r"(?<![\w.])(/(?!v1\b)[a-z][a-z0-9/-]*)",
        "相应页面",
        s,
    )
    # 常见英文参数名（勿全局替换 token，避免误伤 access token）
    s = re.sub(r"\bprojectId\b", "项目 ID", s)
    s = re.sub(r"\bquery\b", "查询参数", s)
    # 原文重复写同一页面路径时的口语化
    s = s.replace(
        "项目工作流页（必要时为 项目工作流页 带上",
        "项目工作流页（必要时带上",
    )
    return s


def nid() -> str:
    return str(uuid.uuid4())


def topic(title: str, attached: list | None = None) -> dict:
    node: dict = {
        "id": nid(),
        "class": "topic",
        "title": title,
        "titleUnedited": True,
    }
    if attached:
        node["children"] = {"attached": attached}
    return node


def merged_numbered(lines: list[str]) -> str:
    return "\n".join(f"{i + 1}. {s}" for i, s in enumerate(lines))


def use_case(
    title: str,
    pre: list[str],
    steps: list[str],
    expect: list[str],
    *,
    priority: str,
) -> dict:
    """层级为链式嵌套：用例标题 → 前置条件 → 执行步骤 → 预期结果（非同级）。"""
    pre_p = [xmind_plain_text(x) for x in pre]
    steps_p = [xmind_plain_text(x) for x in steps]
    expect_p = [xmind_plain_text(x) for x in expect]
    display_title = f"[{priority}] {title}"
    expect_node = topic(f"预期结果\n\n{merged_numbered(expect_p)}")
    steps_node = topic(
        f"执行步骤\n\n{merged_numbered(steps_p)}",
        attached=[expect_node],
    )
    pre_node = topic(
        f"前置条件\n\n{merged_numbered(pre_p)}",
        attached=[steps_node],
    )
    return topic(display_title, attached=[pre_node])


def parse_uc_block(lines: list[str]) -> tuple[list[str], list[str], list[str]]:
    pre: list[str] = []
    steps: list[str] = []
    expect: list[str] = []
    mode: str | None = None

    for raw in lines:
        s = raw.strip()
        if s == "**前置条件**":
            mode = "pre"
            continue
        if s == "**执行步骤**":
            mode = "steps"
            continue
        if s == "**预期结果**":
            mode = "expect"
            continue
        if s.startswith("---"):
            continue
        if mode == "expect" and s.startswith("**"):
            mode = None
            continue
        if mode == "pre" and s.startswith("**") and "前置条件" not in s:
            mode = None
            continue

        if mode == "pre" and s.startswith("- "):
            pre.append(s[2:].strip())
        elif mode == "steps":
            m = STEP_LINE.match(raw)
            if m:
                steps.append(m.group(2).strip())
        elif mode == "expect" and s.startswith("- "):
            expect.append(s[2:].strip())

    return pre, steps, expect


def parse_use_cases(md: str) -> tuple[list[dict], list[dict]]:
    lines = md.splitlines()
    tier: str | None = None
    p0: list[dict] = []
    p1: list[dict] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        if line.startswith("## P0"):
            tier = "P0"
            i += 1
            continue
        if line.startswith("## P1"):
            tier = "P1"
            i += 1
            continue
        if line.startswith("## ") and not line.startswith("## P0") and not line.startswith("## P1"):
            tier = None

        m = UC_HEAD.match(line)
        if m and tier in ("P0", "P1"):
            title = m.group(1).strip()
            block: list[str] = []
            i += 1
            while i < len(lines):
                nxt = lines[i]
                if nxt.startswith("### ") or (
                    nxt.startswith("## ") and not nxt.startswith("###")
                ):
                    break
                block.append(lines[i])
                i += 1
            pre, steps, expect = parse_uc_block(block)
            if not pre or not steps or not expect:
                raise ValueError(
                    f"用例「{title}」解析失败：前置/步骤/预期需均为非空（得到 pre={len(pre)} steps={len(steps)} expect={len(expect)}）"
                )
            node = use_case(title, pre, steps, expect, priority=tier)
            if tier == "P0":
                p0.append(node)
            else:
                p1.append(node)
            continue

        i += 1

    return p0, p1


def bullets_under_heading(md: str, heading: str) -> list[str]:
    lines = md.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        if lines[i].strip() == heading:
            i += 1
            while i < len(lines) and not lines[i].startswith("##"):
                s = lines[i].strip()
                if s.startswith("- "):
                    out.append(s[2:].strip())
                i += 1
            break
        i += 1
    return out


def first_paragraph_under_heading(md: str, heading: str) -> str:
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        if lines[i].strip() == heading:
            i += 1
            while i < len(lines) and not lines[i].startswith("##"):
                s = lines[i].strip()
                if s:
                    return s
                i += 1
            break
        i += 1
    return ""


def build_sheet() -> dict:
    md = MD.read_text(encoding="utf-8")
    p0, p1 = parse_use_cases(md)

    p2_bullets = bullets_under_heading(md, "## P2：扩展与质量")
    auto_bullets = bullets_under_heading(md, "## 与现有自动化衔接")
    risk_text = first_paragraph_under_heading(md, "## 风险说明")

    if not p2_bullets:
        p2_bullets = [
            "通知：列表与推送深度场景按需补充",
            "队列与任务执行：Worker/Queue 按需补充",
            "自动化：复杂创建—查询—状态变更扩展",
            "Git：远端凭证与合并推送需独立环境",
            "可观测性：ObservabilityModule 按需",
        ]
    if not auto_bullets:
        auto_bullets = [
            "单元测试：*.spec.ts",
            "E2E：frontend/e2e/smoke.spec.ts",
            "后端 e2e：需独立环境",
        ]
    if not risk_text:
        risk_text = "无 PRD 不保证业务规则正确性，仅链路可用；PRD 后升级预期与验收说明"

    return {
        "id": nid(),
        "class": "sheet",
        "title": "核心用例与测试策略",
        "topicPositioning": "fixed",
        "relationships": [],
        "rootTopic": {
            "id": nid(),
            "class": "topic",
            "title": "无 PRD 核心用例与测试策略",
            "structureClass": "org.xmind.ui.logic.right",
            "titleUnedited": True,
            "children": {
                "attached": [
                    topic(
                        "原则",
                        attached=[
                            topic("分层：P0 发布阻塞，P1 回归主路径，P2 扩展与质量"),
                            topic("依据：前端功能、认证、AppModule、功能模块图"),
                        ],
                    ),
                    topic(
                        "环境与前置",
                        attached=[
                            topic("本地：pnpm dev；backend :9000；docker-compose DB/Redis"),
                            topic("数据：测试账号；注册用唯一用户名"),
                            topic("手工：浏览器；curl/Bruno"),
                            topic("E2E：Playwright；本地前端 8000 端口；测试用环境变量"),
                        ],
                    ),
                    topic("P0：核心用例（必须通过）", attached=p0),
                    topic("P1：主业务路径（建议每版本回归）", attached=p1),
                    topic(
                        "P2：扩展与质量",
                        attached=[
                            topic(xmind_plain_text(b)) for b in p2_bullets
                        ],
                    ),
                    topic(
                        "与现有自动化衔接",
                        attached=[
                            topic(xmind_plain_text(b)) for b in auto_bullets
                        ],
                    ),
                    topic(
                        "风险说明",
                        attached=[topic(xmind_plain_text(risk_text))],
                    ),
                ]
            },
        },
    }


def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)

    content = [build_sheet()]
    manifest = {"file-entries": {"content.json": {}, "metadata.json": {}}}
    metadata: dict = {}

    (BUILD / "content.json").write_text(
        json.dumps(content, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (BUILD / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (BUILD / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False),
        encoding="utf-8",
    )

    if OUT.exists():
        OUT.unlink()

    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(BUILD / "content.json", "content.json")
        zf.write(BUILD / "manifest.json", "manifest.json")
        zf.write(BUILD / "metadata.json", "metadata.json")

    shutil.rmtree(BUILD, ignore_errors=True)
    print(f"Wrote {OUT} from {MD} (XMind Zen content.json bundle)")


if __name__ == "__main__":
    main()
