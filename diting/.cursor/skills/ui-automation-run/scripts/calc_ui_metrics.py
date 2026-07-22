#!/usr/bin/env python3
"""Calculate UI automation release-gate metrics from task artifacts.

The script is intentionally dependency-free so it can run inside prepared
workspaces without installing project packages.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


PASS_RESULTS = {"PASS", "PASS（样本偏离）", "PASS(样本偏离)"}
FAIL_RESULTS = {"FAIL", "MISSING_RESULT"}
BLOCKED_PREFIX = "BLOCKED_"
SKIPPED_PREFIX = "SKIPPED_"


@dataclass
class CaseFact:
    case_id: str
    priority: str = ""
    in_scope: bool = True
    executable: bool = True
    result: str = "MISSING_RESULT"
    duration_ms: int | None = None
    tti_ms: int | None = None
    retry_count: int = 0
    blocked_reason: str | None = None
    skipped_reason: str | None = None
    sample_path: str | None = None
    completion_rate: float | None = None
    usability_score: float | None = None
    operability_score: float | None = None
    dead_click_count: int = 0
    invalid_input_count: int = 0
    source: str = "unknown"
    raw: dict[str, Any] = field(default_factory=dict)


def main() -> int:
    parser = argparse.ArgumentParser(description="Calculate UI automation metrics.")
    parser.add_argument("--task-dir", required=True, help="Task artifact directory.")
    parser.add_argument("--tti-limit-ms", type=int, default=5000, help="TTI limit used for usability scoring.")
    parser.add_argument("--usability-alpha", type=float, default=0.7, help="Completion-rate weight for usability score.")
    args = parser.parse_args()

    task_dir = Path(args.task_dir).resolve()
    metrics_path = task_dir / "uiAutomationMetrics.json"
    result_path = task_dir / "testExecutionResult.md"

    metrics = calculate_metrics(task_dir, tti_limit_ms=args.tti_limit_ms, usability_alpha=args.usability_alpha)
    write_json(metrics_path, metrics)
    result_path.write_text(render_result(metrics), encoding="utf-8")

    return 0 if metrics["gate"]["status"] == "passed" else 1


def calculate_metrics(task_dir: Path, *, tti_limit_ms: int = 5000, usability_alpha: float = 0.7) -> dict[str, Any]:
    test_path = task_dir / "TEST.md"
    report_path = task_dir / "testExecutionReport.md"
    record_path = task_dir / "TEST-EXECUTION-RECORD.md"

    warnings: list[str] = []
    input_files = {
        "TEST.md": test_path.exists(),
        "testExecutionReport.md": report_path.exists(),
        "TEST-EXECUTION-RECORD.md": record_path.exists(),
    }

    test_cases = parse_test_md(test_path) if test_path.exists() else {}
    facts = collect_case_facts(record_path, report_path, test_cases)

    if not test_path.exists():
        warnings.append("missing TEST.md")
    if not record_path.exists() and not report_path.exists():
        warnings.append("missing execution record/report")
    if not facts:
        if test_cases:
            facts = merge_missing_test_cases([], test_cases)
        else:
            return build_missing_metrics(input_files, warnings)

    facts = merge_missing_test_cases(facts, test_cases)
    normalized = [fact_to_json(fact) for fact in facts]

    in_scope = [fact for fact in facts if fact.in_scope]
    executable = [fact for fact in in_scope if fact.executable]
    executed = [fact for fact in executable if not is_skipped(fact.result)]
    p0 = [fact for fact in executed if normalize_priority(fact.priority) == "P0"]

    p0_pass = [fact for fact in p0 if is_pass(fact.result)]
    p0_fail = [fact for fact in p0 if is_fail(fact.result)]
    p0_blocked = [fact for fact in p0 if is_blocked(fact.result)]
    p0_executed = len(p0)
    p0_pass_rate = safe_ratio(len(p0_pass), p0_executed)

    if p0_executed == 0:
        warnings.append("no executable P0 case results")

    retried = [fact for fact in executed if fact.retry_count > 0]
    durations = [fact.duration_ms for fact in executed if fact.duration_ms is not None]
    tti_values = [fact.tti_ms for fact in executed if fact.tti_ms is not None]

    executable_rate = safe_ratio(len(executable), len(in_scope))
    flaky_rate = safe_ratio(len(retried), len(executed))
    case_duration_p95 = percentile(durations, 95)
    tti_p95 = percentile(tti_values, 95)
    experience = calculate_experience(
        executed,
        tti_p95=tti_p95,
        tti_limit_ms=tti_limit_ms,
        usability_alpha=usability_alpha,
    )

    if executable_rate < 0.8:
        warnings.append(f"low executable rate: {executable_rate:.2f}")
    if flaky_rate > 0.03:
        warnings.append(f"flaky rate warning: {flaky_rate:.2f}")
    if experience["usabilityScore"] is not None and experience["usabilityScore"] < 0.9:
        warnings.append(f"usability score warning: {experience['usabilityScore']:.2f}")
    if experience["operabilityScore"] is not None and experience["operabilityScore"] < 0.9:
        warnings.append(f"operability score warning: {experience['operabilityScore']:.2f}")

    gate = build_gate(
        p0_executed=p0_executed,
        p0_pass=len(p0_pass),
        p0_fail=len(p0_fail),
        p0_blocked=len(p0_blocked),
        p0_pass_rate=p0_pass_rate,
    )

    return {
        "schemaVersion": 1,
        "inputFiles": input_files,
        "summary": {
            "totalCases": len(facts),
            "inScopeCases": len(in_scope),
            "executableCases": len(executable),
            "executedCases": len(executed),
            "passCount": sum(1 for fact in executed if is_pass(fact.result)),
            "failCount": sum(1 for fact in executed if is_fail(fact.result)),
            "blockedCount": sum(1 for fact in executed if is_blocked(fact.result)),
            "skippedCount": sum(1 for fact in facts if is_skipped(fact.result)),
        },
        "p0": {
            "executed": p0_executed,
            "passed": len(p0_pass),
            "failed": len(p0_fail),
            "blocked": len(p0_blocked),
            "passRate": p0_pass_rate,
            "failedCaseIds": [fact.case_id for fact in p0_fail],
            "blockedCaseIds": [fact.case_id for fact in p0_blocked],
        },
        "executable": {
            "inScopeCases": len(in_scope),
            "executableCases": len(executable),
            "rate": executable_rate,
        },
        "stability": {
            "retriedCases": len(retried),
            "flakyRate": flaky_rate,
            "retriedCaseIds": [fact.case_id for fact in retried],
        },
        "timing": {
            "suiteDurationMs": sum(durations),
            "caseDurationP95Ms": case_duration_p95,
            "ttiP95Ms": tti_p95,
        },
        "experience": experience,
        "warnings": warnings,
        "gate": gate,
        "cases": normalized,
    }


def build_missing_metrics(input_files: dict[str, bool], warnings: list[str]) -> dict[str, Any]:
    gate = {
        "status": "failed",
        "completed": False,
        "reason": "指标输入缺失，无法计算 UI 自动化门禁。",
        "hardFailures": ["missing_case_facts"],
    }
    return {
        "schemaVersion": 1,
        "inputFiles": input_files,
        "summary": {
            "totalCases": 0,
            "inScopeCases": 0,
            "executableCases": 0,
            "executedCases": 0,
            "passCount": 0,
            "failCount": 0,
            "blockedCount": 0,
            "skippedCount": 0,
        },
        "p0": {
            "executed": 0,
            "passed": 0,
            "failed": 0,
            "blocked": 0,
            "passRate": 0,
            "failedCaseIds": [],
            "blockedCaseIds": [],
        },
        "executable": {"inScopeCases": 0, "executableCases": 0, "rate": 0},
        "stability": {"retriedCases": 0, "flakyRate": 0, "retriedCaseIds": []},
        "timing": {"suiteDurationMs": 0, "caseDurationP95Ms": None, "ttiP95Ms": None},
        "experience": {
            "usabilityScore": None,
            "operabilityScore": None,
            "completionRate": None,
            "deadClickCount": 0,
            "invalidInputCount": 0,
            "parameters": {"usabilityAlpha": 0.7, "ttiLimitMs": 5000},
        },
        "warnings": warnings,
        "gate": gate,
        "cases": [],
    }


def build_gate(
    *,
    p0_executed: int,
    p0_pass: int,
    p0_fail: int,
    p0_blocked: int,
    p0_pass_rate: float,
) -> dict[str, Any]:
    hard_failures: list[str] = []
    if p0_executed == 0:
        hard_failures.append("no_executable_p0")
    if p0_blocked > 0:
        hard_failures.append("p0_blocked")
    if p0_pass_rate < 1.0:
        hard_failures.append("p0_not_all_passed")

    if p0_blocked > 0:
        status = "blocked"
        reason = f"{p0_pass}/{p0_executed} P0 UI 自动化用例通过，{p0_fail} FAIL，{p0_blocked} BLOCKED。"
    elif hard_failures:
        status = "failed"
        reason = f"{p0_pass}/{p0_executed} P0 UI 自动化用例通过，{p0_fail} FAIL，{p0_blocked} BLOCKED。"
    else:
        status = "passed"
        reason = f"{p0_pass}/{p0_executed} P0 UI 自动化用例通过，0 FAIL，0 BLOCKED。"

    return {
        "status": status,
        "completed": status == "passed",
        "reason": reason,
        "hardFailures": hard_failures,
    }


def render_result(metrics: dict[str, Any]) -> str:
    first_line = "已完成" if metrics["gate"]["status"] == "passed" else "未完成"
    return f"{first_line}\n{metrics['gate']['reason']}\n"


def calculate_experience(
    executed: list[CaseFact],
    *,
    tti_p95: int | None,
    tti_limit_ms: int,
    usability_alpha: float,
) -> dict[str, Any]:
    if not executed:
        return {
            "usabilityScore": None,
            "operabilityScore": None,
            "completionRate": None,
            "deadClickCount": 0,
            "invalidInputCount": 0,
            "parameters": {"usabilityAlpha": usability_alpha, "ttiLimitMs": tti_limit_ms},
        }

    completion_rate_values = [
        fact.completion_rate for fact in executed if fact.completion_rate is not None
    ]
    completion_rate = (
        round(sum(completion_rate_values) / len(completion_rate_values), 6)
        if completion_rate_values
        else safe_ratio(sum(1 for fact in executed if is_pass(fact.result)), len(executed))
    )
    timing_score = None
    if tti_p95 is not None and tti_limit_ms > 0:
        timing_score = max(0.0, 1 - min(tti_p95 / tti_limit_ms, 1))
    usability_score_values = [
        fact.usability_score for fact in executed if fact.usability_score is not None
    ]
    if usability_score_values:
        usability_score = round(sum(usability_score_values) / len(usability_score_values), 6)
    elif timing_score is not None:
        alpha = min(max(usability_alpha, 0), 1)
        usability_score = round(alpha * completion_rate + (1 - alpha) * timing_score, 6)
    else:
        usability_score = None

    dead_click_count = sum(fact.dead_click_count for fact in executed)
    invalid_input_count = sum(fact.invalid_input_count for fact in executed)
    operability_score_values = [
        fact.operability_score for fact in executed if fact.operability_score is not None
    ]
    if operability_score_values:
        operability_score = round(sum(operability_score_values) / len(operability_score_values), 6)
    elif dead_click_count or invalid_input_count:
        penalty = (dead_click_count + invalid_input_count) / max(len(executed), 1)
        operability_score = round(max(0.0, 1 - min(penalty, 1)), 6)
    else:
        operability_score = None

    return {
        "usabilityScore": usability_score,
        "operabilityScore": operability_score,
        "completionRate": completion_rate,
        "deadClickCount": dead_click_count,
        "invalidInputCount": invalid_input_count,
        "parameters": {"usabilityAlpha": usability_alpha, "ttiLimitMs": tti_limit_ms},
    }


def parse_test_md(path: Path) -> dict[str, dict[str, Any]]:
    text = read_text(path)
    rows = parse_markdown_rows(text)
    cases: dict[str, dict[str, Any]] = {}
    current: dict[str, Any] = {}

    for key, value in rows:
        normalized_key = normalize_label(key)
        if normalized_key == "caseid":
            if current.get("caseId"):
                cases[current["caseId"]] = current
            current = {"caseId": value.strip()}
            continue
        if not current:
            continue
        if normalized_key == "priority":
            current["priority"] = normalize_priority(value)
        elif normalized_key == "scope":
            current["scope"] = value.strip()
            current["inScope"] = value.strip() not in {"候选扩展", "不纳入本轮"}
        elif normalized_key == "execute":
            current["execute"] = value.strip()
            current["executable"] = value.strip() == "是"
        elif normalized_key == "env":
            current["environment"] = value.strip()
        elif normalized_key == "skipreason":
            current["skippedReason"] = None if value.strip() in {"", "-"} else value.strip()

    if current.get("caseId"):
        cases[current["caseId"]] = current
    return cases


def collect_case_facts(
    record_path: Path,
    report_path: Path,
    test_cases: dict[str, dict[str, Any]],
) -> list[CaseFact]:
    facts: dict[str, CaseFact] = {}
    for path in [record_path, report_path]:
        if not path.exists():
            continue
        text = read_text(path)
        for raw in extract_case_json_objects(text):
            fact = raw_to_fact(raw, path.name, test_cases)
            if fact:
                facts[fact.case_id] = merge_fact(facts.get(fact.case_id), fact)
        for fact in parse_markdown_execution_sections(text, path.name, test_cases):
            facts[fact.case_id] = merge_fact(facts.get(fact.case_id), fact)
    return list(facts.values())


def extract_case_json_objects(text: str) -> list[dict[str, Any]]:
    objects: list[dict[str, Any]] = []
    for block in re.findall(r"```(?:json)?\s*([\s\S]*?)```", text, flags=re.IGNORECASE):
        parsed = parse_json_maybe(block)
        objects.extend(find_case_objects(parsed))

    parsed_full = parse_json_maybe(text)
    objects.extend(find_case_objects(parsed_full))
    return dedupe_case_objects(objects)


def parse_json_maybe(raw: str) -> Any:
    try:
        return json.loads(raw.strip())
    except Exception:
        return None


def find_case_objects(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        found: list[dict[str, Any]] = []
        for item in value:
            found.extend(find_case_objects(item))
        return found
    if isinstance(value, dict):
        if read_first(value, ["caseId", "case_id", "用例ID", "id"]):
            return [value]
        found = []
        for item in value.values():
            found.extend(find_case_objects(item))
        return found
    return []


def dedupe_case_objects(objects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for obj in objects:
        case_id = str(read_first(obj, ["caseId", "case_id", "用例ID", "id"]) or "").strip()
        if not case_id:
            continue
        result[case_id] = {**result.get(case_id, {}), **obj}
    return list(result.values())


def parse_markdown_execution_sections(
    text: str,
    source: str,
    test_cases: dict[str, dict[str, Any]],
) -> list[CaseFact]:
    pattern = re.compile(
        r"^##\s+(?P<case>[^\n#]+?)\s*(?:执行结果|Result|$)(?P<body>.*?)(?=^##\s+|\Z)",
        flags=re.MULTILINE | re.DOTALL,
    )
    facts = []
    for match in pattern.finditer(text):
        case_id = clean_case_id(match.group("case"))
        if not case_id:
            continue
        body = match.group("body")
        result_match = re.search(r"[-*]\s*Result\s*[:：]\s*([^\n]+)", body, flags=re.IGNORECASE)
        sample_match = re.search(r"[-*]\s*SamplePath\s*[:：]\s*([^\n]+)", body, flags=re.IGNORECASE)
        retry_match = re.search(r"retryCount\s*[:：]\s*(\d+)", body, flags=re.IGNORECASE)
        duration_match = re.search(r"durationMs\s*[:：]\s*(\d+)", body, flags=re.IGNORECASE)
        meta = test_cases.get(case_id, {})
        facts.append(CaseFact(
            case_id=case_id,
            priority=normalize_priority(meta.get("priority", "")),
            in_scope=bool(meta.get("inScope", True)),
            executable=bool(meta.get("executable", True)),
            result=normalize_result(result_match.group(1).strip() if result_match else "MISSING_RESULT"),
            duration_ms=to_int(duration_match.group(1)) if duration_match else None,
            retry_count=to_int(retry_match.group(1)) or 0 if retry_match else 0,
            sample_path=sample_match.group(1).strip() if sample_match else None,
            source=source,
        ))
    return facts


def merge_missing_test_cases(facts: list[CaseFact], test_cases: dict[str, dict[str, Any]]) -> list[CaseFact]:
    by_id = {fact.case_id: fact for fact in facts}
    for case_id, meta in test_cases.items():
        if case_id in by_id:
            fact = by_id[case_id]
            if not fact.priority:
                fact.priority = normalize_priority(meta.get("priority", ""))
            fact.in_scope = fact.in_scope and bool(meta.get("inScope", True))
            fact.executable = fact.executable and bool(meta.get("executable", True))
            if fact.skipped_reason is None:
                fact.skipped_reason = meta.get("skippedReason")
            continue
        if not meta.get("inScope", True):
            result = "SKIPPED_NOT_IN_SCOPE"
        elif not meta.get("executable", True):
            result = "SKIPPED_NOT_EXECUTABLE"
        else:
            result = "MISSING_RESULT"
        by_id[case_id] = CaseFact(
            case_id=case_id,
            priority=normalize_priority(meta.get("priority", "")),
            in_scope=bool(meta.get("inScope", True)),
            executable=bool(meta.get("executable", True)),
            result=result,
            skipped_reason=meta.get("skippedReason"),
            source="TEST.md",
        )
    return list(by_id.values())


def raw_to_fact(raw: dict[str, Any], source: str, test_cases: dict[str, dict[str, Any]]) -> CaseFact | None:
    case_id = str(read_first(raw, ["caseId", "case_id", "用例ID", "id"]) or "").strip()
    if not case_id:
        return None
    meta = test_cases.get(case_id, {})
    return CaseFact(
        case_id=case_id,
        priority=normalize_priority(read_first(raw, ["priority", "优先级"]) or meta.get("priority", "")),
        in_scope=to_bool(read_first(raw, ["inScope", "in_scope"]), meta.get("inScope", True)),
        executable=to_bool(read_first(raw, ["executable", "本轮是否执行"]), meta.get("executable", True)),
        result=normalize_result(read_first(raw, ["result", "Result", "结论"]) or "MISSING_RESULT"),
        duration_ms=to_int(read_first(raw, ["durationMs", "duration_ms"])),
        tti_ms=to_int(read_first(raw, ["ttiMs", "tti_ms"])),
        retry_count=to_int(read_first(raw, ["retryCount", "retry_count"])) or 0,
        blocked_reason=nullable_str(read_first(raw, ["blockedReason", "blocked_reason"])),
        skipped_reason=nullable_str(read_first(raw, ["skippedReason", "skipped_reason"]) or meta.get("skippedReason")),
        sample_path=nullable_str(read_first(raw, ["samplePath", "sample_path", "SamplePath"])),
        completion_rate=to_float(read_first(raw, ["completionRate", "completion_rate"])),
        usability_score=to_float(read_first(raw, ["usabilityScore", "usability_score"])),
        operability_score=to_float(read_first(raw, ["operabilityScore", "operability_score"])),
        dead_click_count=to_int(read_first(raw, ["deadClickCount", "dead_click_count"])) or 0,
        invalid_input_count=to_int(read_first(raw, ["invalidInputCount", "invalid_input_count"])) or 0,
        source=source,
        raw=raw,
    )


def merge_fact(old: CaseFact | None, new: CaseFact) -> CaseFact:
    if old is None:
        return new
    return CaseFact(
        case_id=new.case_id,
        priority=new.priority or old.priority,
        in_scope=new.in_scope,
        executable=new.executable,
        result=new.result if new.result != "MISSING_RESULT" else old.result,
        duration_ms=new.duration_ms if new.duration_ms is not None else old.duration_ms,
        tti_ms=new.tti_ms if new.tti_ms is not None else old.tti_ms,
        retry_count=max(old.retry_count, new.retry_count),
        blocked_reason=new.blocked_reason or old.blocked_reason,
        skipped_reason=new.skipped_reason or old.skipped_reason,
        sample_path=new.sample_path or old.sample_path,
        completion_rate=new.completion_rate if new.completion_rate is not None else old.completion_rate,
        usability_score=new.usability_score if new.usability_score is not None else old.usability_score,
        operability_score=new.operability_score if new.operability_score is not None else old.operability_score,
        dead_click_count=max(old.dead_click_count, new.dead_click_count),
        invalid_input_count=max(old.invalid_input_count, new.invalid_input_count),
        source=f"{old.source},{new.source}",
        raw={**old.raw, **new.raw},
    )


def fact_to_json(fact: CaseFact) -> dict[str, Any]:
    return {
        "caseId": fact.case_id,
        "priority": fact.priority,
        "inScope": fact.in_scope,
        "executable": fact.executable,
        "result": fact.result,
        "durationMs": fact.duration_ms,
        "ttiMs": fact.tti_ms,
        "retryCount": fact.retry_count,
        "blockedReason": fact.blocked_reason,
        "skippedReason": fact.skipped_reason,
        "samplePath": fact.sample_path,
        "completionRate": fact.completion_rate,
        "usabilityScore": fact.usability_score,
        "operabilityScore": fact.operability_score,
        "deadClickCount": fact.dead_click_count,
        "invalidInputCount": fact.invalid_input_count,
        "source": fact.source,
    }


def parse_markdown_rows(text: str) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|") or not stripped.endswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if len(cells) < 2:
            continue
        if all(re.fullmatch(r":?-{2,}:?", cell) for cell in cells):
            continue
        rows.append((cells[0], cells[1]))
    return rows


def normalize_label(value: str) -> str:
    mapping = {
        "用例id": "caseid",
        "用例ID": "caseid",
        "caseid": "caseid",
        "case id": "caseid",
        "优先级": "priority",
        "priority": "priority",
        "覆盖范围": "scope",
        "本轮是否执行": "execute",
        "环境前提": "env",
        "不执行原因": "skipreason",
    }
    compact = value.strip().replace(" ", "")
    return mapping.get(value.strip(), mapping.get(compact, compact.lower()))


def normalize_priority(value: Any) -> str:
    text = str(value or "").upper().strip()
    match = re.search(r"P[0-2]", text)
    return match.group(0) if match else text


def normalize_result(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return "MISSING_RESULT"
    upper = text.upper()
    if upper.startswith("PASS"):
        return "PASS（样本偏离）" if "样本偏离" in text else "PASS"
    if upper.startswith("FAIL"):
        return "FAIL"
    if upper.startswith(BLOCKED_PREFIX):
        return upper.split()[0].strip("，,;；")
    if upper.startswith(SKIPPED_PREFIX):
        return upper.split()[0].strip("，,;；")
    return upper.split()[0].strip("，,;；")


def clean_case_id(value: str) -> str:
    text = value.strip().strip("`").strip()
    text = re.sub(r"\s+执行结果$", "", text)
    return text.split()[0].strip("：:")


def is_pass(result: str) -> bool:
    return result in PASS_RESULTS


def is_fail(result: str) -> bool:
    return result in FAIL_RESULTS or result == "FAIL"


def is_blocked(result: str) -> bool:
    return result.startswith(BLOCKED_PREFIX)


def is_skipped(result: str) -> bool:
    return result.startswith(SKIPPED_PREFIX)


def safe_ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0
    return round(numerator / denominator, 6)


def percentile(values: list[int], pct: int) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, math.ceil((pct / 100) * len(ordered)) - 1)
    return ordered[index]


def to_bool(value: Any, default: Any = False) -> bool:
    if value is None:
        return bool(default)
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"true", "1", "yes", "y", "是"}:
        return True
    if text in {"false", "0", "no", "n", "否"}:
        return False
    return bool(default)


def to_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(float(str(value)))
    except Exception:
        return None


def to_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        parsed = float(str(value))
        if parsed > 1 and parsed <= 100:
            return round(parsed / 100, 6)
        return round(parsed, 6)
    except Exception:
        return None


def nullable_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return None if text in {"", "-", "null", "None"} else text


def read_first(raw: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        if key in raw:
            return raw[key]
    return None


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
