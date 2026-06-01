#!/usr/bin/env python3
"""从 TEST-智能硬件-飞书批量.md 抽取订单/课程/商品核心用例（每小节场景1）→ TEST-智能硬件-核心-订单课程商品.md"""
import re
import sys
from pathlib import Path

# 主标题子串（与飞书小节一致）；仅匹配「 - 场景1」
KEEP = [
    # 订单
    "[研学后台]旧订单后台操作退款逻辑回归验证验证",
    "[研学后台]导入订单，子订单拆分逻辑验证",
    "[研学后台]抖音、微店的CSV映射配置新增字段功能验证",
    "[研学后台]渠道订单管理新增筛选字段验证",
    "研学后台-订单操作日志详情功能验证",
    "渠道订单管理-退款功能测试",
    "渠道订单管理-操作按钮权限和显示测试",
    "订单管理-订单状态验证",
    "订单管理-导入、导出功能验证",
    # 课程
    "课程预约管理-预约合同推送入口操作",
    "课程信息管理-新增功能操作-选择推送合同",
    "研学后台-课程管理-课程库存管理新建库存功能验证",
    "研学后台-课程管理-修改课程功能验证",
    "研学后台-课程管理-课程信息管理新增功能验证",
    "课程预约管理-推送合同功能验证",
    "课程预约管理-修改验证",
    "课程库存管理-新增、上架、下架验证",
    "课程信息管理-修改、上架、下架状态功能验证",
    "课程信息管理-新增验证",
    # 商品
    "研学后台-同一类别中商品多次选择验证",
    "研学后台-商品管理-平台商品管理-编辑商品功能验证",
    "研学后台-商品管理-平台商品管理新增商品功能验证",
    "商品管理-修改、上架、下架、复制验证",
    "商品管理-新增验证",
]

HEADER = """# 测试文档（核心：订单 / 课程 / 商品）

> **测试环境（MCP / 浏览器自动化）**：默认使用研学管理后台测试网（如 `https://trip-shadow-test.yangcong345.com`）及前置条件中的入口 URL；执行前需已登录管理后台账号。When 步骤在对应页面内依次操作。

---

## 第二部分：测试用例（核心：订单 / 课程 / 商品）

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


def split_tc_blocks(text: str) -> list[str]:
    parts = re.split(r"(?=^#### TC-HW-\d{4}：)", text, flags=re.MULTILINE)
    return parts[1:]


def parse_heading(line: str) -> tuple[str | None, str | None]:
    m = re.match(r"^#### (TC-HW-\d{4})：(.+?)\s+-\s+场景\d+\s*$", line.strip())
    if not m:
        return None, None
    return m.group(1), m.group(2)


def find_block(blocks: list[str], key: str) -> str | None:
    for b in blocks:
        first = b.split("\n", 1)[0]
        _, main = parse_heading(first)
        if not main:
            continue
        if key in main and first.rstrip().endswith("场景1"):
            return b
    return None


def transform_block(block: str, core_idx: int) -> str:
    lines = block.splitlines()
    _, main = parse_heading(lines[0])
    if not main:
        return block
    new_id = f"TC-CORE-{core_idx:04d}"
    lines[0] = f"#### {new_id}：{main}"
    text = "\n".join(lines)
    text = re.sub(
        r"\| 用例ID\s+\|\s*TC-HW-\d+\s*\|",
        f"| 用例ID   | {new_id} |",
        text,
        count=1,
    )
    # MCP：When 首条若缺少导航类动词，补一条（Given 含 URL 时）
    if "**When**：" in text and "https://" in text:
        a, _, rest = text.partition("**When**：")
        # rest 以 \n\n 开头接 bullet
        if rest and not re.search(
            r"(打开|进入|导航|点击侧栏|访问|侧栏)", rest[:200]
        ):
            rest = "\n\n- （导航）若当前不在业务页，先访问 Given 中的后台入口 URL，再进入与步骤相关的菜单/订单/课程/商品页面。" + rest
        text = a + "**When**：" + rest
    if not text.endswith("---"):
        text = text.rstrip() + "\n"
    return text


def main():
    root = Path(__file__).resolve().parents[1]
    src = root / "TEST-智能硬件-飞书批量.md"
    dst = root / "TEST-智能硬件-核心-订单课程商品.md"
    if not src.is_file():
        print(f"缺少源文件: {src}", file=sys.stderr)
        sys.exit(1)
    blocks = split_tc_blocks(src.read_text(encoding="utf-8"))
    picked: list[str] = []
    for key in KEEP:
        b = find_block(blocks, key)
        if b:
            picked.append(b)
        else:
            print(f"[warn] 未找到场景1: {key}", file=sys.stderr)
    out_parts = [HEADER]
    for i, blk in enumerate(picked, start=1):
        out_parts.append(transform_block(blk, i))
        out_parts.append("")
    dst.write_text("\n".join(out_parts).rstrip() + "\n", encoding="utf-8")
    print(f"写入 {dst}，共 {len(picked)} 条（计划 {len(KEEP)} 条）", file=sys.stderr)


if __name__ == "__main__":
    main()
