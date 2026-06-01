#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

MD_PATH = Path(__file__).resolve().parent / "SP96_自习室播放器_测试用例.md"
JSON_PATH = Path(__file__).resolve().parent / "SP96_自习室播放器_测试用例-xmind.json"
XMIND_PATH = Path(__file__).resolve().parent / "SP96_自习室播放器_测试用例.xmind"

CASE_TABLE_HEADERS = ["用例ID", "用例标题", "前置条件", "测试步骤", "预期结果", "优先级"]
OVERVIEW_TABLE_HEADERS = ["模块", "用例数", "优先级"]
PRIORITY_TABLE_HEADERS = ["优先级", "说明", "处理策略"]


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


def numbered(lines: list[str]) -> str:
    return "\n".join(f"{index + 1}. {line}" for index, line in enumerate(lines))


def clean_inline(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("&nbsp;", " ")).strip()


def split_table_row(line: str) -> list[str]:
    raw = line.strip()
    if not raw.startswith("|"):
        raise ValueError(f"非法表格行：{line}")
    cells = raw.strip("|").split("|")
    return [clean_inline(cell) for cell in cells]


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
            rows.append(split_table_row(line))
        index += 1
    return headers, rows, index


def split_multiline_cell(text: str) -> list[str]:
    normalized = text.replace("<br/>", "\n").replace("<br>", "\n")
    parts = [clean_inline(part) for part in normalized.split("\n")]
    return [part for part in parts if part]


def split_steps(text: str) -> list[str]:
    items = split_multiline_cell(text)
    cleaned = [re.sub(r"^\d+[.)、]\s*", "", item).strip() for item in items]
    return cleaned or ["无"]


def split_preconditions_or_expected(text: str) -> list[str]:
    items = split_multiline_cell(text)
    cleaned = [re.sub(r"^[-*]\s*", "", item).strip() for item in items]
    cleaned = [re.sub(r"^\d+[.)、]\s*", "", item).strip() for item in cleaned]
    cleaned = [item for item in cleaned if item and item != "-"]
    return cleaned or ["无"]


def find_heading(lines: list[str], heading: str) -> int:
    for index, line in enumerate(lines):
        if line.strip() == heading:
            return index
    return -1


def parse_overview(lines: list[str]) -> list[dict]:
    start = find_heading(lines, "## 测试用例总览")
    if start == -1:
        return []
    table_start = start + 1
    while table_start < len(lines) and not lines[table_start].strip().startswith("|"):
        table_start += 1
    headers, rows, _ = parse_table(lines, table_start)
    if headers != OVERVIEW_TABLE_HEADERS:
        raise ValueError(f"总览表头不符合预期：{headers}")
    overview = []
    for row in rows:
        overview.append(
            {
                "module": row[0].replace("**", ""),
                "useCaseCount": int(row[1].replace("**", "")),
                "priority": row[2].replace("**", ""),
            }
        )
    return overview


def parse_environment_appendix(lines: list[str]) -> dict[str, list[str]]:
    start = find_heading(lines, "## 附录：测试环境要求")
    if start == -1:
        return {}

    sections: dict[str, list[str]] = {}
    current_key: str | None = None
    index = start + 1
    while index < len(lines):
        line = lines[index].strip()
        if line.startswith("## ") and index > start:
            break
        if line.startswith("### "):
            current_key = line[4:].strip()
            sections[current_key] = []
        elif current_key and line.startswith("- "):
            sections[current_key].append(line[2:].strip())
        elif current_key:
            ordered = re.match(r"^\d+\.\s+(.+)$", line)
            if ordered:
                sections[current_key].append(ordered.group(1).strip())
        index += 1
    return sections


def parse_priority_appendix(lines: list[str]) -> list[dict]:
    start = find_heading(lines, "## 附录：优先级定义")
    if start == -1:
        return []
    table_start = start + 1
    while table_start < len(lines) and not lines[table_start].strip().startswith("|"):
        table_start += 1
    headers, rows, _ = parse_table(lines, table_start)
    if headers != PRIORITY_TABLE_HEADERS:
        raise ValueError(f"优先级表头不符合预期：{headers}")
    return [
        {"priority": row[0], "description": row[1], "strategy": row[2]}
        for row in rows
    ]


def parse_use_cases(lines: list[str]) -> list[dict]:
    modules: list[dict] = []
    current_module: dict | None = None
    current_group: dict | None = None
    index = 0

    while index < len(lines):
        line = lines[index].strip()

        if line.startswith("## 附录："):
            break

        if line.startswith("## ") and line != "## 测试用例总览":
            current_module = {"title": line[3:].strip(), "groups": []}
            modules.append(current_module)
            current_group = None
            index += 1
            continue

        if line.startswith("### "):
            if current_module is None:
                raise ValueError(f"在模块外发现小节：{line}")
            current_group = {"title": line[4:].strip(), "useCases": []}
            current_module["groups"].append(current_group)
            index += 1
            continue

        if line.startswith("|"):
            headers, rows, next_index = parse_table(lines, index)
            if headers == CASE_TABLE_HEADERS:
                if current_module is None:
                    raise ValueError("在模块外发现用例表")
                if current_group is None:
                    current_group = {"title": "未分组", "useCases": []}
                    current_module["groups"].append(current_group)
                for row in rows:
                    current_group["useCases"].append(
                        {
                            "id": row[0],
                            "title": row[1],
                            "preconditions": split_preconditions_or_expected(row[2]),
                            "steps": split_steps(row[3]),
                            "expectedResults": split_preconditions_or_expected(row[4]),
                            "priority": row[5],
                            "module": current_module["title"],
                            "group": current_group["title"],
                        }
                    )
            index = next_index
            continue

        index += 1

    return modules


def build_outline_item(use_case: dict) -> dict:
    return {
        "title": f"[{use_case['priority']}] {use_case['id']} {use_case['title']}",
        "children": [
            {
                "title": f"前置条件\n\n{numbered(use_case['preconditions'])}",
                "children": [
                    {
                        "title": f"测试步骤\n\n{numbered(use_case['steps'])}",
                        "children": [
                            {
                                "title": f"预期结果\n\n{numbered(use_case['expectedResults'])}",
                            }
                        ],
                    }
                ],
            }
        ],
    }


def build_use_case_topic(use_case: dict) -> dict:
    expected_node = topic(f"预期结果\n\n{numbered(use_case['expectedResults'])}")
    steps_node = topic(
        f"测试步骤\n\n{numbered(use_case['steps'])}",
        attached=[expected_node],
    )
    preconditions_node = topic(
        f"前置条件\n\n{numbered(use_case['preconditions'])}",
        attached=[steps_node],
    )
    return topic(
        f"[{use_case['priority']}] {use_case['id']} {use_case['title']}",
        attached=[preconditions_node],
    )


def build_module_topic(module: dict) -> dict:
    return topic(
        module["title"],
        attached=[
            topic(
                group["title"],
                attached=[build_use_case_topic(use_case) for use_case in group["useCases"]],
            )
            for group in module["groups"]
        ],
    )


def build_overview_topic(overview: list[dict]) -> dict:
    nodes = [
        topic(
            f"{item['module']}：{item['useCaseCount']} 条（{item['priority']}）"
        )
        for item in overview
    ]
    return topic("测试用例总览", attached=nodes)


def build_environment_topic(environment: dict[str, list[str]]) -> dict:
    return topic(
        "附录：测试环境要求",
        attached=[
            topic(section, attached=[topic(item) for item in items])
            for section, items in environment.items()
        ],
    )


def build_priority_topic(priority_definitions: list[dict]) -> dict:
    return topic(
        "附录：优先级定义",
        attached=[
            topic(
                item["priority"],
                attached=[
                    topic(f"说明：{item['description']}"),
                    topic(f"处理策略：{item['strategy']}"),
                ],
            )
            for item in priority_definitions
        ],
    )


def build_sheet(document: dict, overview: list[dict], modules: list[dict], appendix: dict) -> dict:
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
            "children": {
                "attached": [
                    build_overview_topic(overview),
                    *[build_module_topic(module) for module in modules],
                    build_environment_topic(appendix["testEnvironment"]),
                    build_priority_topic(appendix["priorityDefinitions"]),
                ]
            },
        },
    }


def read_existing_thumbnail() -> bytes | None:
    if not XMIND_PATH.exists():
        return None
    try:
        with zipfile.ZipFile(XMIND_PATH) as archive:
            return archive.read("Thumbnails/thumbnail.png")
    except Exception:
        return None


def write_xmind(document: dict, overview: list[dict], modules: list[dict], appendix: dict) -> None:
    content = [build_sheet(document, overview, modules, appendix)]
    thumbnail = read_existing_thumbnail()
    manifest_entries: dict[str, dict] = {
        "content.json": {},
        "metadata.json": {},
    }
    if thumbnail is not None:
        manifest_entries["Thumbnails/thumbnail.png"] = {}

    with zipfile.ZipFile(XMIND_PATH, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "content.json",
            json.dumps(content, ensure_ascii=False, indent=2),
        )
        archive.writestr(
            "manifest.json",
            json.dumps({"file-entries": manifest_entries}, ensure_ascii=False),
        )
        archive.writestr("metadata.json", "{}")
        if thumbnail is not None:
            archive.writestr("Thumbnails/thumbnail.png", thumbnail)


def build_payload() -> dict:
    lines = MD_PATH.read_text(encoding="utf-8").splitlines()
    title = next((line[2:].strip() for line in lines if line.startswith("# ")), "测试用例")
    overview = parse_overview(lines)
    modules = parse_use_cases(lines)
    use_cases = [use_case for module in modules for group in module["groups"] for use_case in group["useCases"]]
    appendix = {
        "testEnvironment": parse_environment_appendix(lines),
        "priorityDefinitions": parse_priority_appendix(lines),
    }
    overview_total = next(
        (item["useCaseCount"] for item in overview if item["module"] == "合计"),
        None,
    )
    if overview_total is not None and overview_total != len(use_cases):
        raise ValueError(f"解析出的用例数为 {len(use_cases)}，与总览合计 {overview_total} 不一致")

    return {
        "schemaVersion": 1,
        "document": {
            "title": title.replace("【", "[").replace("】", "]"),
            "displayTitle": title,
            "sourceMarkdown": MD_PATH.name,
            "sourceXmind": XMIND_PATH.name,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "description": "由 Markdown 测试用例自动同步为结构化 JSON 与 XMind。",
        },
        "overview": overview,
        "modules": modules,
        "useCases": use_cases,
        "appendix": appendix,
        "outline": [
            {
                "title": module["title"],
                "children": [
                    {
                        "title": group["title"],
                        "children": [build_outline_item(use_case) for use_case in group["useCases"]],
                    }
                    for group in module["groups"]
                ],
            }
            for module in modules
        ],
        "stats": {
            "useCaseCount": len(use_cases),
            "moduleCount": len(modules),
            "groupCount": sum(len(module["groups"]) for module in modules),
            "overviewTotal": overview_total,
        },
    }


def main() -> None:
    payload = build_payload()
    JSON_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_xmind(payload["document"], payload["overview"], payload["modules"], payload["appendix"])
    print(f"Synced {JSON_PATH.name} and {XMIND_PATH.name}")


if __name__ == "__main__":
    main()
