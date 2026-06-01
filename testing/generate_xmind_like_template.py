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

CANONICAL_FIELDS = ["case_id", "title", "preconditions", "steps", "expected_results"]
HEADER_ALIASES = {
    "用例编号": "case_id",
    "用例ID": "case_id",
    "用例名称": "title",
    "用例标题": "title",
    "前置条件": "preconditions",
    "操作步骤": "steps",
    "测试步骤": "steps",
    "预期结果": "expected_results",
}


@dataclass
class UseCase:
    case_id: str
    title: str
    preconditions: list[str]
    steps: list[str]
    expected_results: list[str]


def nid() -> str:
    return str(uuid.uuid4())


def normalize_inline(text: str) -> str:
    cleaned = text.replace("&nbsp;", " ").replace("\\|", "|")
    cleaned = cleaned.replace("**", "").replace("__", "").replace("`", "")
    return re.sub(r"\s+", " ", cleaned).strip()


def normalize_section_title(text: str) -> str:
    text = normalize_inline(text)
    text = re.sub(r"^[一二三四五六七八九十百零]+[、.．]\s*", "", text)
    text = re.sub(r"^\d+(?:\.\d+)*(?:[、.．])?\s*", "", text)
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


def split_ordered_lines(text: str) -> list[str]:
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


def topic(title: str, attached: list[dict] | None = None) -> dict:
    node: dict = {
        "id": nid(),
        "class": "topic",
        "title": title,
        "attributedTitle": [{"text": title}],
    }
    if attached:
        node["children"] = {"attached": attached}
    return node


def build_preconditions_text(use_case: UseCase) -> str:
    effective_preconditions = [item for item in use_case.preconditions if item and item != "无"]
    if not effective_preconditions:
        return "无"
    if len(effective_preconditions) == 1:
        return effective_preconditions[0]
    return "\n".join(effective_preconditions)


def build_expected_results_text(use_case: UseCase) -> str:
    effective_results = [item for item in use_case.expected_results if item and item != "无"]
    if not effective_results:
        return "无"
    return "\n".join(effective_results)


def build_case_title(use_case: UseCase) -> str:
    preconditions_text = build_preconditions_text(use_case)
    if preconditions_text == "无":
        return use_case.title
    return f"{use_case.title}\n前置条件：{preconditions_text}"


def normalize_headers(headers: list[str]) -> list[str] | None:
    normalized = [HEADER_ALIASES.get(header, f"extra_{index}") for index, header in enumerate(headers)]
    if normalized[:5] != CANONICAL_FIELDS:
        return None
    required_fields = set(CANONICAL_FIELDS)
    if not required_fields.issubset(set(normalized)):
        return None
    return normalized


def parse_markdown(markdown_path: Path) -> tuple[str, list[dict]]:
    lines = markdown_path.read_text(encoding="utf-8").splitlines()
    document_title = next((line[2:].strip() for line in lines if line.startswith("# ")), markdown_path.stem)

    modules: list[dict] = []
    current_module: dict | None = None
    current_group: dict | None = None
    index = 0

    while index < len(lines):
        stripped = lines[index].strip()

        if stripped.startswith("## "):
            title = normalize_section_title(stripped[3:])
            if title == "测试用例总览":
                current_module = None
                current_group = None
                index += 1
                continue
            current_module = {
                "title": title,
                "groups": [],
            }
            modules.append(current_module)
            current_group = None
            index += 1
            continue

        if stripped.startswith("### "):
            if current_module is None:
                index += 1
                continue
            current_group = {
                "title": normalize_section_title(stripped[4:]),
                "useCases": [],
            }
            current_module["groups"].append(current_group)
            index += 1
            continue

        if stripped.startswith("|"):
            headers, rows, next_index = parse_table(lines, index)
            normalized_headers = normalize_headers(headers)
            if normalized_headers is not None:
                if current_module is None:
                    raise ValueError("在模块外发现用例表")
                if current_group is None:
                    current_group = {
                        "title": "未分组",
                        "useCases": [],
                    }
                    current_module["groups"].append(current_group)
                header_index = {field: idx for idx, field in enumerate(normalized_headers)}
                for row in rows:
                    current_group["useCases"].append(
                        UseCase(
                            case_id=row[header_index["case_id"]],
                            title=row[header_index["title"]],
                            preconditions=split_listish_lines(row[header_index["preconditions"]]),
                            steps=split_ordered_lines(row[header_index["steps"]]),
                            expected_results=split_listish_lines(row[header_index["expected_results"]]),
                        )
                    )
            index = next_index
            continue

        index += 1

    return document_title, modules


def load_template_sheet(template_xmind: Path) -> dict:
    with zipfile.ZipFile(template_xmind) as archive:
        return json.loads(archive.read("content.json"))[0]


def build_sheet(document_title: str, modules: list[dict], template_sheet: dict) -> dict:
    module_topics: list[dict] = []
    for module in modules:
        use_case_topics: list[dict] = []
        for group in module["groups"]:
            for use_case in group["useCases"]:
                use_case_topics.append(
                    topic(
                        build_case_title(use_case),
                        attached=[
                            topic(
                                format_numbered(use_case.steps),
                                attached=[topic(build_expected_results_text(use_case))],
                            )
                        ],
                    )
                )
        if use_case_topics:
            module_topics.append(topic(module["title"], attached=use_case_topics))

    sheet = {
        "id": nid(),
        "class": "sheet",
        "title": template_sheet.get("title", "画布 1"),
        "rootTopic": {
            "id": nid(),
            "class": "topic",
            "title": document_title,
            "attributedTitle": [{"text": document_title}],
            "structureClass": template_sheet["rootTopic"].get("structureClass", "org.xmind.ui.logic.right"),
            "children": {"attached": module_topics},
        },
    }

    if "extensions" in template_sheet:
        sheet["extensions"] = template_sheet["extensions"]
    if "theme" in template_sheet:
        sheet["theme"] = template_sheet["theme"]

    return sheet


def write_xmind(sheet: dict, output_path: Path) -> None:
    manifest_entries = {
        "content.json": {},
        "metadata.json": {},
    }

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("content.json", json.dumps([sheet], ensure_ascii=False, separators=(",", ":")))
        archive.writestr("manifest.json", json.dumps({"file-entries": manifest_entries}, ensure_ascii=False))
        archive.writestr("metadata.json", "{}")


def build_payload(document_title: str, markdown_path: Path, modules: list[dict], template_xmind: Path) -> dict:
    use_cases = [
        use_case
        for module in modules
        for group in module["groups"]
        for use_case in group["useCases"]
    ]
    return {
        "schemaVersion": 1,
        "document": {
            "title": document_title,
            "sourceMarkdown": markdown_path.name,
            "templateXmind": template_xmind.name,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "description": "按模板 XMind 样式从 Markdown 测试用例生成。",
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
                                "title": use_case.title,
                                "preconditions": use_case.preconditions,
                                "steps": use_case.steps,
                                "expectedResults": use_case.expected_results,
                            }
                            for use_case in group["useCases"]
                        ],
                    }
                    for group in module["groups"]
                ],
            }
            for module in modules
        ],
        "stats": {
            "moduleCount": len(modules),
            "groupCount": sum(len(module["groups"]) for module in modules),
            "useCaseCount": len(use_cases),
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="按模板 XMind 样式生成测试脑图")
    parser.add_argument("markdown_path", help="Markdown 文件路径")
    parser.add_argument("--template-xmind", required=True, help="参考 XMind 模板路径")
    parser.add_argument("--xmind-path", help="输出 XMind 文件路径")
    parser.add_argument("--json-path", help="输出结构化 JSON 文件路径")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    markdown_path = Path(args.markdown_path).expanduser().resolve()
    template_xmind = Path(args.template_xmind).expanduser().resolve()

    if not markdown_path.exists():
        raise FileNotFoundError(f"未找到 Markdown 文件：{markdown_path}")
    if not template_xmind.exists():
        raise FileNotFoundError(f"未找到模板 XMind：{template_xmind}")

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

    document_title, modules = parse_markdown(markdown_path)
    template_sheet = load_template_sheet(template_xmind)
    sheet = build_sheet(document_title, modules, template_sheet)
    payload = build_payload(document_title, markdown_path, modules, template_xmind)

    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_xmind(sheet, xmind_path)
    print(f"Generated {json_path} and {xmind_path}")


if __name__ == "__main__":
    main()
