#!/usr/bin/env python3
from __future__ import annotations

import json
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

JSON_PATH = Path(__file__).resolve().parent / "无-PRD-核心用例与测试策略-xmind.json"
XMIND_PATH = Path(__file__).resolve().parent / "无 PRD 核心用例与测试策略.xmind"


def nid() -> str:
    return str(uuid.uuid4())


def numbered(lines: list[str]) -> str:
    return "\n".join(f"{index + 1}. {line}" for index, line in enumerate(lines))


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


def build_outline_item(use_case: dict) -> dict:
    return {
        "title": f"{use_case['code']} {use_case['title']}",
        "children": [
            {
                "title": f"前置条件\n\n{numbered(use_case['preconditions'])}",
                "children": [
                    {
                        "title": f"执行步骤\n\n{numbered(use_case['steps'])}",
                        "children": [
                            {
                                "title": f"执行结果\n\n{numbered(use_case['expectedResults'])}",
                            }
                        ],
                    }
                ],
            }
        ],
    }


def build_xmind_use_case(use_case: dict) -> dict:
    expected_node = topic(f"执行结果\n\n{numbered(use_case['expectedResults'])}")
    steps_node = topic(
        f"执行步骤\n\n{numbered(use_case['steps'])}",
        attached=[expected_node],
    )
    preconditions_node = topic(
        f"前置条件\n\n{numbered(use_case['preconditions'])}",
        attached=[steps_node],
    )
    return topic(f"{use_case['code']} {use_case['title']}", attached=[preconditions_node])


def build_sheet(document: dict, use_cases: list[dict]) -> dict:
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
                "attached": [build_xmind_use_case(use_case) for use_case in use_cases],
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


def write_xmind(document: dict, use_cases: list[dict]) -> None:
    content = [build_sheet(document, use_cases)]
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


def main() -> None:
    payload = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    payload["document"]["generatedAt"] = datetime.now(timezone.utc).isoformat()
    payload["outline"] = [build_outline_item(use_case) for use_case in payload["useCases"]]

    JSON_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_xmind(payload["document"], payload["useCases"])
    print(f"Synced {JSON_PATH.name} and {XMIND_PATH.name}")


if __name__ == "__main__":
    main()
