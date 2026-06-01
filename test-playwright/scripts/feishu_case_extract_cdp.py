#!/usr/bin/env python3
"""CDP 连接本机 Chrome，提取飞书用例页并写入/注入 Markdown。详见 docs 内说明。"""
import argparse, re, sys, time
from datetime import datetime, timezone
from pathlib import Path

FEISHU_CASE_LINK = re.compile(
    r"^\s*-\s*\*\*测试用例链接\*\*[：:]\s*(https://project\.feishu\.cn/[^\s\)]+)"
)
DETAIL_SECTION_MARKER = "### 用例详情（步骤表）"

try:
    from playwright.sync_api import sync_playwright, Page
except ImportError:
    print("pip install playwright", file=sys.stderr)
    sys.exit(1)

DEFAULT_CDP = "http://127.0.0.1:9222"
# 飞书等 SPA 长期有 WebSocket/轮询，wait_until=networkidle 往往极慢或永远等不到，改用 domcontentloaded + 关键元素可见。
DEFAULT_WAIT_UNTIL = "domcontentloaded"

def _clean(s):
    return re.sub(r"\s+", " ", (s or "").strip())

def extract_title(page):
    for sel in ("h1", "[role=heading]"):
        loc = page.locator(sel).first
        if loc.count() and loc.is_visible():
            t = _clean(loc.inner_text())
            if t and len(t) < 200:
                return t
    return ""

def extract_precondition(page):
    body = page.inner_text("body")
    m = re.search(r"前置条件[：:\s]*([^\n]+)", body)
    return m.group(1).strip() if m else ""

def _grid_from_rows(rows_locator):
    """rows_locator: locator for tr or [role=row]"""
    grid = []
    rc = rows_locator.count()
    for ri in range(rc):
        row = rows_locator.nth(ri)
        cells = row.locator("th, td, [role=columnheader], [role=gridcell], [role=cell]")
        cc = cells.count()
        if cc == 0:
            continue
        grid.append([_clean(cells.nth(ci).inner_text()) for ci in range(cc)])
    return grid


def _grid_to_md(grid):
    if not grid or len(grid) < 2:
        return ""
    mc = max(len(r) for r in grid)
    for r in grid:
        while len(r) < mc:
            r.append("")
    h = grid[0]
    lines = ["| " + " | ".join(h) + " |", "| " + " | ".join(["---"] * len(h)) + " |"]
    for row in grid[1:]:
        lines.append("| " + " | ".join(row[: len(h)]) + " |")
    return "\n".join(lines)


def tables_to_markdown(frame):
    """从标准 <table> 提取。"""
    out = []
    for ti in range(frame.locator("table").count()):
        t = frame.locator("table").nth(ti)
        if not t.is_visible():
            continue
        grid = _grid_from_rows(t.locator("tr"))
        md = _grid_to_md(grid)
        if md:
            out.append(md)
    return out


def grids_role_to_markdown(frame):
    """飞书/Ant Design 常用：div + role=grid / row / gridcell。"""
    out = []
    for gi in range(frame.locator('[role="grid"], [role="treegrid"]').count()):
        g = frame.locator('[role="grid"], [role="treegrid"]').nth(gi)
        if not g.is_visible():
            continue
        rows = g.locator('[role="row"]')
        grid = _grid_from_rows(rows)
        md = _grid_to_md(grid)
        if md and len(grid) >= 2:
            out.append(md)
    return out


def extract_detail_block_via_js(frame):
    """在 DOM 中找同时含「序号」「步骤描述」「预期结果」的最小文本块（飞书用例详情常为 div 布局）。"""
    try:
        return frame.evaluate(
            """() => {
  const nodes = [];
  const hasCols = (t) =>
    /序号/.test(t) && /步骤描述/.test(t) && /预期结果/.test(t);
  const walk = (el) => {
    if (!el) return;
    const t = (el.innerText || '').trim();
    if (t.length >= 80 && t.length <= 40000 && hasCols(t)) {
      nodes.push({ t, len: t.length });
    }
    if (el.shadowRoot) walk(el.shadowRoot);
    for (const c of el.children) walk(c);
  };
  walk(document.body);
  if (!nodes.length) return '';
  nodes.sort((a, b) => a.len - b.len);
  return nodes[0].t;
}"""
        )
    except Exception:
        return ""


def collect_case_detail_markdown(page: Page):
    """合并主文档与所有 iframe 中的表格 / 用例详情块。"""
    seen = set()
    chunks = []

    def add_md(md: str):
        md = (md or "").strip()
        if len(md) < 20:
            return
        key = md[:200]
        if key in seen:
            return
        seen.add(key)
        chunks.append(md)

    for fr in page.frames:
        for md in tables_to_markdown(fr):
            add_md(md)
        for md in grids_role_to_markdown(fr):
            add_md(md)
    combined = "\n\n".join(chunks)
    need_js = (not chunks) or (len(combined) < 200) or ("序号" not in combined)
    if need_js:
        for fr in page.frames:
            block = extract_detail_block_via_js(fr)
            if block:
                lines = [ln.rstrip() for ln in block.splitlines() if ln.strip()]
                if len(lines) >= 4:
                    add_md("\n".join(lines))

    return "\n\n".join(chunks) if chunks else ""

def build_inner(page, url, fallback):
    try:
        page.locator("text=步骤描述").first.wait_for(state="visible", timeout=45000)
    except Exception:
        pass
    try:
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(600)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(200)
    except Exception:
        pass
    title = extract_title(page) or fallback
    pre = extract_precondition(page)
    parts = [
        f"- **测试用例链接**：{url}",
        f"- **CDP 抓取时间**：{datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%d %H:%M')}",
        "",
        "### 前置条件",
        "",
        pre or "—",
        "",
        "### 用例详情（步骤表）",
        "",
    ]
    detail = collect_case_detail_markdown(page)
    if detail:
        parts.append(detail)
    else:
        parts.extend(["—", "```", page.inner_text("body")[:3000], "```"])
    return title, "\n".join(parts).strip(), detail or ""

def parse_feishu_sections_from_markdown(path: Path):
    """从 Markdown 中解析「## 小节标题」与紧随其后的飞书「测试用例链接」行，返回 [(标题, URL), ...]。"""
    text = path.read_text(encoding="utf-8")
    current = None
    out = []
    for line in text.splitlines():
        if line.startswith("## ") and not line.startswith("###"):
            current = line[3:].strip()
            continue
        m = FEISHU_CASE_LINK.match(line)
        if m and current:
            url = m.group(1).split("?")[0]
            out.append((current, url))
    return out


def inject(path, section_title, body):
    """用抓取结果整段替换「## 标题」下直至下一「##」的全部内容（会去掉基本信息、说明等）。"""
    text = path.read_text(encoding="utf-8")
    h = f"## {section_title}"
    i = text.find(h)
    if i < 0:
        sys.exit(f"未找到: {h}")
    j = text.find("\n## ", i + 1)
    if j < 0:
        sys.exit("未找到下节")
    new = text[: i + len(h) + 1] + "\n" + body.rstrip() + "\n\n" + text[j:]
    path.write_text(new, encoding="utf-8")


def inject_detail_only(path: Path, section_title: str, detail_md: str) -> bool:
    """仅替换「## 小节」内「### 用例详情（步骤表）」与下一段引用/分隔线之间的内容，保留链接、说明、基本信息、前置条件。"""
    detail_md = (detail_md or "").strip()
    if not detail_md:
        return False
    text = path.read_text(encoding="utf-8")
    h = f"## {section_title}"
    i = text.find(h)
    if i < 0:
        return False
    j = text.find("\n## ", i + 1)
    if j < 0:
        j = len(text)
    sec = text[i:j]
    if DETAIL_SECTION_MARKER not in sec:
        return False
    pat = re.compile(
        r"(\n"
        + re.escape(DETAIL_SECTION_MARKER)
        + r"\n)(?:\s*)([\s\S]*?)(?=\n\n>|\n\n---|\Z)",
        re.MULTILINE,
    )
    new_sec, n = pat.subn(r"\1" + detail_md + "\n", sec, count=1)
    if n != 1:
        return False
    path.write_text(text[:i] + new_sec + text[j:], encoding="utf-8")
    return True

def _connect_browser(p, cdp_url):
    try:
        return p.chromium.connect_over_cdp(cdp_url)
    except Exception as e:
        print(
            "连接 CDP 失败（常见原因：9222 未监听）。\n"
            "1) 用 Cmd+Q 完全退出 Chrome，不要只关窗口。\n"
            "2) 再执行：/Applications/Google\\ Chrome.app/.../Google\\ Chrome --remote-debugging-port=9222\n"
            "   若出现「正在现有的浏览器会话中打开」，说明仍复用了旧进程，请先彻底退出。\n"
            "3) 验证：curl -s http://127.0.0.1:9222/json/version 应返回 JSON。\n",
            file=sys.stderr,
        )
        print(e, file=sys.stderr)
        sys.exit(2)


def main():
    import os
    ap = argparse.ArgumentParser(
        description="通过 CDP 连接已开启远程调试的本机 Chrome，抓取飞书用例页。"
    )
    ap.add_argument("--cdp", default=os.environ.get("FEISHU_CDP_URL", DEFAULT_CDP))
    ap.add_argument("--url", default="", help="单个用例页 URL（与 --batch-from-markdown 二选一）")
    ap.add_argument("--section-title", default="")
    ap.add_argument("--inject", type=Path, default=None)
    ap.add_argument(
        "--inject-mode",
        choices=("detail", "full"),
        default="detail",
        help="注入主文档方式：detail=只更新「### 用例详情（步骤表）」下内容（保留说明/基本信息）；full=整节替换为抓取全文",
    )
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--reuse-tab", action="store_true")
    ap.add_argument(
        "--batch-from-markdown",
        type=Path,
        metavar="MD",
        help="从 Markdown 解析所有「##」+ 飞书测试用例链接，顺序抓取并写入 --out",
    )
    ap.add_argument(
        "--list-sections-only",
        action="store_true",
        help="与 --batch-from-markdown 联用：只打印解析到的 (标题, URL)，不连浏览器",
    )
    ap.add_argument("--delay", type=float, default=1.5, help="批量模式下每页间隔秒数（默认 1.5）")
    ap.add_argument("--max", type=int, default=0, metavar="N", help="批量模式只处理前 N 条（0=全部）")
    ap.add_argument(
        "--wait-until",
        default=DEFAULT_WAIT_UNTIL,
        choices=("domcontentloaded", "load", "networkidle"),
        help="导航完成条件：默认 domcontentloaded（快；飞书勿用 networkidle，易卡死）",
    )
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[1]
    out = args.out or root / "docs" / "feishu_cdp_last_extract.md"

    if args.batch_from_markdown:
        pairs = parse_feishu_sections_from_markdown(args.batch_from_markdown)
        if args.max and args.max > 0:
            pairs = pairs[: args.max]
        if args.list_sections_only:
            for t, u in pairs:
                print(f"{t}\t{u}")
            print(f"共 {len(pairs)} 条", file=sys.stderr)
            return
        if not pairs:
            sys.exit("未从 Markdown 解析到任何飞书测试用例链接（需存在「## 标题」与「- **测试用例链接**：https://project.feishu.cn/...」）")
        out = args.out or root / "docs" / "feishu_cdp_batch_extract.md"
        chunks = [
            f"# CDP 批量抓取（{args.batch_from_markdown.name}）\n",
            f"> 生成时间：{datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%d %H:%M:%S')}\n",
        ]
        with sync_playwright() as p:
            browser = _connect_browser(p, args.cdp)
            ctx = browser.contexts[0] if browser.contexts else browser.new_context()
            page = ctx.pages[0] if args.reuse_tab and ctx.pages else ctx.new_page()
            for idx, (section_title, url) in enumerate(pairs):
                print(f"[{idx + 1}/{len(pairs)}] {section_title[:40]}...", flush=True)
                try:
                    page.goto(url, wait_until=args.wait_until, timeout=120000)
                    title, inner, detail = build_inner(page, url, section_title)
                    chunks.append(f"## {title}\n\n{inner}\n\n---\n\n")
                    if args.inject:
                        if args.inject_mode == "detail":
                            if inject_detail_only(args.inject, section_title, detail):
                                pass
                            else:
                                print(
                                    f"  未写入主文档（无「{DETAIL_SECTION_MARKER}」或抓取为空）: {section_title}",
                                    file=sys.stderr,
                                )
                        else:
                            inject(args.inject, section_title, inner)
                except Exception as e:
                    err = f"## {section_title}\n\n**抓取失败**：`{e}`\n\n---\n\n"
                    chunks.append(err)
                    print(f"  失败: {e}", file=sys.stderr)
                if idx < len(pairs) - 1 and args.delay > 0:
                    time.sleep(args.delay)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text("".join(chunks), encoding="utf-8")
        print("已写入", out)
        if args.inject:
            print("已按小节注入", args.inject)
        return

    if not args.url:
        ap.error("请提供 --url，或使用 --batch-from-markdown")

    with sync_playwright() as p:
        browser = _connect_browser(p, args.cdp)
        ctx = browser.contexts[0] if browser.contexts else browser.new_context()
        if args.reuse_tab and ctx.pages:
            page = ctx.pages[0]
            if args.url not in page.url:
                page.goto(args.url, wait_until=args.wait_until, timeout=120000)
        else:
            page = ctx.new_page()
            page.goto(args.url, wait_until=args.wait_until, timeout=120000)
        title, inner, detail = build_inner(page, args.url, args.section_title or "用例")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(f"## {title}\n\n{inner}\n\n---\n", encoding="utf-8")
        print("已写入", out)
        if args.inject:
            if not args.section_title:
                sys.exit("需要 --section-title")
            if args.inject_mode == "detail":
                if not inject_detail_only(args.inject, args.section_title, detail):
                    sys.exit(
                        f"按 detail 模式注入失败：请确认文档中存在「## {args.section_title}」与「{DETAIL_SECTION_MARKER}」，且本次已抓到用例详情表格"
                    )
            else:
                inject(args.inject, args.section_title, inner)
            print("已注入", args.inject, f"（{args.inject_mode}）")

if __name__ == "__main__":
    main()
