#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

USE_CASE_TABLE_HEADERS = {
    "用例编号",
    "测试项",
    "测试标题",
    "前置条件",
    "测试步骤",
    "预期结果",
    "优先级",
    "测试类型",
}


@dataclass
class UseCase:
    case_id: str
    test_item: str
    title: str
    preconditions: list[str]
    steps: list[str]
    expected_results: list[str]
    priority: str
    test_type: str


@dataclass
class RenderOptions:
    included_priorities: set[str] | None
    condensed: bool


def nid() -> str:
    return str(uuid.uuid4())


def topic(title: str, attached: list[dict] | None = None) -> dict:
    node: dict = {
        "id": nid(),
        "class": "topic",
        "title": title,
        "titleUnedited": True,
    }
    if attached:
        node["children"] = {"attached": attached}
    return node


def normalize_inline(text: str) -> str:
    cleaned = text.replace("&nbsp;", " ").replace("\\|", "|")
    cleaned = cleaned.replace("**", "").replace("__", "")
    cleaned = cleaned.replace("`", "")
    return re.sub(r"\s+", " ", cleaned).strip()


def normalize_title(text: str) -> str:
    text = normalize_inline(text)
    text = re.sub(r"^\d+(?:\.\d+)*(?:\.)?\s*", "", text)
    return text.strip()


def split_table_row(line: str) -> list[str]:
    raw = line.strip()
    if not raw.startswith("|"):
        raise ValueError(f"非法表格行：{line}")
    cells = raw.strip("|").split("|")
    return [normalize_inline(cell) for cell in cells]


def is_separator_row(line: str) -> bool:
    stripped = line.strip().replace("|", "").replace("-", "").replace(":", "").replace(" ", "")
    return stripped == ""


def parse_table(lines: list[str], start: int) -> tuple[list[str], list[list[str]], int]:
    headers = split_table_row(lines[start])
    rows: list[list[str]] = []
    index = start + 1
    if index >= len(lines) or not is_separator_row(lines[index]):
        raise ValueError(f"表格缺少分隔行：{lines[start]}")
    index += 1
    while index < len(lines):
        line = lines[index]
        if not line.strip().startswith("|"):
            break
        if not is_separator_row(line):
            row = split_table_row(line)
            if len(row) < len(headers):
                row.extend([""] * (len(headers) - len(row)))
            rows.append(row[: len(headers)])
        index += 1
    return headers, rows, index


def split_multiline_cell(text: str) -> list[str]:
    normalized = text.replace("<br/>", "\n").replace("<br>", "\n")
    parts = [normalize_inline(part) for part in normalized.split("\n")]
    return [part for part in parts if part]


def split_numbered_lines(text: str) -> list[str]:
    items = split_multiline_cell(text)
    cleaned = [re.sub(r"^\d+[.)、]\s*", "", item).strip() for item in items]
    return [item for item in cleaned if item] or ["无"]


def split_listish_lines(text: str) -> list[str]:
    items = split_multiline_cell(text)
    cleaned = [re.sub(r"^[-*]\s*", "", item).strip() for item in items]
    cleaned = [re.sub(r"^\d+[.)、]\s*", "", item).strip() for item in cleaned]
    return [item for item in cleaned if item] or ["无"]


def format_numbered(items: list[str]) -> str:
    return "\n".join(f"{index + 1}. {item}" for index, item in enumerate(items))


def collect_subsection_lines(lines: list[str], heading: str) -> list[str]:
    start = -1
    for index, line in enumerate(lines):
        if line.strip() == heading:
            start = index + 1
            break
    if start == -1:
        return []

    collected: list[str] = []
    index = start
    while index < len(lines):
        stripped = lines[index].strip()
        if stripped.startswith("### ") or stripped.startswith("## "):
            break
        collected.append(lines[index])
        index += 1
    return collected


def parse_bullet_block(block_lines: list[str]) -> list[str]:
    items: list[str] = []
    for raw_line in block_lines:
        line = raw_line.strip()
        if not line or line.startswith(">"):
            continue
        if line.startswith("- "):
            items.append(normalize_inline(line[2:]))
            continue
        ordered_match = re.match(r"^\d+\.\s+(.+)$", line)
        if ordered_match:
            items.append(normalize_inline(ordered_match.group(1)))
    return items


def parse_overview(lines: list[str]) -> dict:
    scope_lines = collect_subsection_lines(lines, "### 1.1 测试范围")
    rule_lines = collect_subsection_lines(lines, "### 1.2 测试用例编号规则")
    priority_heading = "### 1.3 优先级定义"
    priority_table: list[dict] = []

    for index, line in enumerate(lines):
        if line.strip() != priority_heading:
            continue
        table_index = index + 1
        while table_index < len(lines) and not lines[table_index].strip().startswith("|"):
            table_index += 1
        if table_index < len(lines):
            headers, rows, _ = parse_table(lines, table_index)
            if headers[:3] == ["优先级", "定义", "影响范围"]:
                priority_table = [
                    {
                        "priority": row[0],
                        "definition": row[1],
                        "impact": row[2],
                    }
                    for row in rows
                ]
        break

    return {
        "scope": parse_bullet_block(scope_lines),
        "caseNumberRules": parse_bullet_block(rule_lines),
        "priorityDefinitions": priority_table,
    }


def parse_checklist(lines: list[str]) -> dict[str, list[str]]:
    start = -1
    for index, line in enumerate(lines):
        if line.strip() == "## 附录：测试执行检查清单":
            start = index + 1
            break
    if start == -1:
        return {}

    sections: dict[str, list[str]] = {}
    current_key: str | None = None
    index = start
    while index < len(lines):
        stripped = lines[index].strip()
        if stripped.startswith("## "):
            break
        if stripped.startswith("### "):
            current_key = normalize_title(stripped[4:])
            sections[current_key] = []
        elif current_key:
            checkbox_match = re.match(r"^- \[[ xX]\]\s+(.+)$", stripped)
            if checkbox_match:
                sections[current_key].append(normalize_inline(checkbox_match.group(1)))
        index += 1
    return sections


def parse_use_case_modules(lines: list[str]) -> list[dict]:
    modules: list[dict] = []
    current_module: dict | None = None
    current_group: dict | None = None
    inside_overview = False
    index = 0

    while index < len(lines):
        stripped = lines[index].strip()

        if stripped == "## 1. 文档概述":
            inside_overview = True
            index += 1
            continue
        if stripped == "## 附录：测试执行检查清单":
            break

        if stripped.startswith("## "):
            inside_overview = False
            current_module = {"title": normalize_title(stripped[3:]), "groups": []}
            modules.append(current_module)
            current_group = None
            index += 1
            continue

        if stripped.startswith("### "):
            if inside_overview:
                index += 1
                continue
            if current_module is None:
                raise ValueError(f"在模块外发现小节：{stripped}")
            current_group = {"title": normalize_title(stripped[4:]), "useCases": []}
            current_module["groups"].append(current_group)
            index += 1
            continue

        if stripped.startswith("|"):
            headers, rows, next_index = parse_table(lines, index)
            if set(headers) == USE_CASE_TABLE_HEADERS:
                if current_module is None:
                    raise ValueError("在模块外发现用例表")
                if current_group is None:
                    current_group = {"title": "未分组", "useCases": []}
                    current_module["groups"].append(current_group)

                header_index = {header: idx for idx, header in enumerate(headers)}
                for row in rows:
                    current_group["useCases"].append(
                        UseCase(
                            case_id=row[header_index["用例编号"]],
                            test_item=row[header_index["测试项"]],
                            title=row[header_index["测试标题"]],
                            preconditions=split_listish_lines(row[header_index["前置条件"]]),
                            steps=split_numbered_lines(row[header_index["测试步骤"]]),
                            expected_results=split_listish_lines(row[header_index["预期结果"]]),
                            priority=row[header_index["优先级"]],
                            test_type=row[header_index["测试类型"]],
                        )
                    )
            index = next_index
            continue

        index += 1

    return modules


def filter_modules(modules: list[dict], included_priorities: set[str] | None) -> list[dict]:
    if not included_priorities:
        return modules

    filtered_modules: list[dict] = []
    for module in modules:
        filtered_groups = []
        for group in module["groups"]:
            filtered_use_cases = [
                use_case for use_case in group["useCases"] if use_case.priority in included_priorities
            ]
            if filtered_use_cases:
                filtered_groups.append(
                    {
                        "title": group["title"],
                        "useCases": filtered_use_cases,
                    }
                )
        if filtered_groups:
            filtered_modules.append({"title": module["title"], "groups": filtered_groups})
    return filtered_modules


def build_overview_topic(overview: dict, options: RenderOptions) -> dict:
    children: list[dict] = []

    if overview["scope"]:
        children.append(
            topic(
                "测试范围",
                attached=[topic(item) for item in overview["scope"]],
            )
        )

    if overview["caseNumberRules"] and not options.condensed:
        children.append(
            topic(
                "测试用例编号规则",
                attached=[topic(item) for item in overview["caseNumberRules"]],
            )
        )

    if overview["priorityDefinitions"] and not options.condensed:
        children.append(
            topic(
                "优先级定义",
                attached=[
                    topic(
                        item["priority"],
                        attached=[
                            topic(f"定义：{item['definition']}"),
                            topic(f"影响范围：{item['impact']}"),
                        ],
                    )
                    for item in overview["priorityDefinitions"]
                ],
            )
        )

    return topic("文档概述", attached=children)


def build_use_case_title(use_case: UseCase, options: RenderOptions) -> str:
    if options.condensed:
        return use_case.title
    return f"[{use_case.priority}][{use_case.test_type}] {use_case.case_id} {use_case.title}"


def build_use_case_topic(use_case: UseCase, options: RenderOptions) -> dict:
    meta_node = topic(
        f"测试信息\n\n测试项：{use_case.test_item}\n测试类型：{use_case.test_type}"
    )
    expected_node = topic(f"预期结果\n\n{format_numbered(use_case.expected_results)}")
    steps_node = topic(
        f"测试步骤\n\n{format_numbered(use_case.steps)}",
        attached=[expected_node],
    )
    preconditions_node = topic(
        f"前置条件\n\n{format_numbered(use_case.preconditions)}",
        attached=[steps_node],
    )
    return topic(build_use_case_title(use_case, options), attached=[meta_node, preconditions_node])


def build_module_topic(module: dict, options: RenderOptions) -> dict:
    return topic(
        module["title"],
        attached=[
            topic(
                group["title"],
                attached=[build_use_case_topic(use_case, options) for use_case in group["useCases"]],
            )
            for group in module["groups"]
        ],
    )


def build_checklist_topic(checklist: dict[str, list[str]]) -> dict | None:
    if not checklist:
        return None
    return topic(
        "测试执行检查清单",
        attached=[
            topic(section, attached=[topic(item) for item in items])
            for section, items in checklist.items()
        ],
    )


def build_sheet(
    document: dict,
    overview: dict,
    modules: list[dict],
    checklist: dict[str, list[str]],
    options: RenderOptions,
) -> dict:
    attached = [build_overview_topic(overview, options), *[build_module_topic(module, options) for module in modules]]
    checklist_topic = build_checklist_topic(checklist)
    if checklist_topic is not None:
        attached.append(checklist_topic)

    return {
        "id": nid(),
        "class": "sheet",
        "title": document["title"],
        "topicPositioning": "fixed",
        "relationships": [],
        "rootTopic": {
            "id": nid(),
            "class": "topic",
            "title": document["title"],
            "structureClass": "org.xmind.ui.logic.right",
            "titleUnedited": True,
            "children": {"attached": attached},
        },
    }


def read_existing_thumbnail(xmind_path: Path) -> bytes | None:
    if not xmind_path.exists():
        return None
    try:
        with zipfile.ZipFile(xmind_path) as archive:
            return archive.read("Thumbnails/thumbnail.png")
    except Exception:
        return None


def write_xmind(
    document: dict,
    overview: dict,
    modules: list[dict],
    checklist: dict[str, list[str]],
    xmind_path: Path,
    options: RenderOptions,
) -> None:
    content = [build_sheet(document, overview, modules, checklist, options)]
    thumbnail = read_existing_thumbnail(xmind_path)
    manifest_entries: dict[str, dict] = {
        "content.json": {},
        "metadata.json": {},
    }
    if thumbnail is not None:
        manifest_entries["Thumbnails/thumbnail.png"] = {}

    with zipfile.ZipFile(xmind_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("content.json", json.dumps(content, ensure_ascii=False, indent=2))
        archive.writestr("manifest.json", json.dumps({"file-entries": manifest_entries}, ensure_ascii=False))
        archive.writestr("metadata.json", "{}")
        if thumbnail is not None:
            archive.writestr("Thumbnails/thumbnail.png", thumbnail)


def build_payload(markdown_path: Path, options: RenderOptions) -> dict:
    lines = markdown_path.read_text(encoding="utf-8").splitlines()
    display_title = next((line[2:].strip() for line in lines if line.startswith("# ")), markdown_path.stem)
    document_title = display_title.replace("【", "[").replace("】", "]")

    overview = parse_overview(lines)
    modules = filter_modules(parse_use_case_modules(lines), options.included_priorities)
    checklist = parse_checklist(lines)
    use_cases = [use_case for module in modules for group in module["groups"] for use_case in group["useCases"]]

    return {
        "schemaVersion": 1,
        "document": {
            "title": document_title,
            "displayTitle": display_title,
            "sourceMarkdown": markdown_path.name,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "description": "由 Markdown 测试用例自动生成结构化 JSON 与 XMind。",
            "condensed": options.condensed,
            "includedPriorities": sorted(options.included_priorities) if options.included_priorities else [],
        },
        "overview": {
            **overview,
            "scopeCount": len(overview["scope"]),
            "ruleCount": len(overview["caseNumberRules"]),
            "priorityCount": len(overview["priorityDefinitions"]),
        },
        "modules": [
            {
                "title": module["title"],
                "groups": [
                    {
                        "title": group["title"],
                        "useCases": [
                            {
                                "id": use_case.case_id,
                                "testItem": use_case.test_item,
                                "title": use_case.title,
                                "preconditions": use_case.preconditions,
                                "steps": use_case.steps,
                                "expectedResults": use_case.expected_results,
                                "priority": use_case.priority,
                                "testType": use_case.test_type,
                            }
                            for use_case in group["useCases"]
                        ],
                    }
                    for group in module["groups"]
                ],
            }
            for module in modules
        ],
        "checklist": checklist,
        "stats": {
            "moduleCount": len(modules),
            "groupCount": sum(len(module["groups"]) for module in modules),
            "useCaseCount": len(use_cases),
            "checklistSectionCount": len(checklist),
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="根据 Markdown 测试用例生成 XMind 文件")
    parser.add_argument("markdown_path", help="Markdown 文件路径")
    parser.add_argument("--xmind-path", help="输出 XMind 文件路径")
    parser.add_argument("--json-path", help="输出结构化 JSON 文件路径")
    parser.add_argument("--priorities", nargs="+", help="仅保留指定优先级，例如：--priorities P0 P1")
    parser.add_argument(
        "--condensed",
        action="store_true",
        help="生成精简版：隐藏优先级定义、编号规则，并移除用例标题中的编号和优先级",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    markdown_path = Path(args.markdown_path).expanduser().resolve()
    if not markdown_path.exists():
        raise FileNotFoundError(f"未找到 Markdown 文件：{markdown_path}")

    options = RenderOptions(
        included_priorities=set(args.priorities) if args.priorities else None,
        condensed=args.condensed,
    )

    xmind_path = (
        Path(args.xmind_path).expanduser().resolve()
        if args.xmind_path
        else markdown_path.with_suffix(".xmind")
    )
    json_path = (
        Path(args.json_path).expanduser().resolve()
        if args.json_path
        else markdown_path.with_name(f"{markdown_path.stem}-xmind.json")
    )

    payload = build_payload(markdown_path, options)
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    modules = filter_modules(
        parse_use_case_modules(markdown_path.read_text(encoding="utf-8").splitlines()),
        options.included_priorities,
    )
    write_xmind(payload["document"], payload["overview"], modules, payload["checklist"], xmind_path, options)

    print(f"Generated {json_path} and {xmind_path}")


if __name__ == "__main__":
    main()
