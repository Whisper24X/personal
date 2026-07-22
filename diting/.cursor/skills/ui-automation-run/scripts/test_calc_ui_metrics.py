#!/usr/bin/env python3
"""Smoke tests for calc_ui_metrics.py."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path


SCRIPT = Path(__file__).with_name("calc_ui_metrics.py")


def main() -> int:
    run_case("all_pass", [
        case("HOME-P0-01", "P0", "PASS", completionRate=1, ttiMs=1800),
        case("HOME-P0-02", "P0", "PASS", completionRate=1, ttiMs=2000),
        case("HOME-P1-01", "P1", "PASS"),
    ], expected_exit=0, expected_first_line="已完成", expected_gate="passed")
    run_case("experience_warning", [
        case("HOME-P0-01", "P0", "PASS", completionRate=0.6, ttiMs=6000, deadClickCount=1),
        case("HOME-P0-02", "P0", "PASS", completionRate=0.6, ttiMs=6500, invalidInputCount=1),
    ], expected_exit=0, expected_first_line="已完成", expected_gate="passed", expect_experience_warning=True)
    run_case("not_in_scope_skip", [
        case("HOME-P0-01", "P0", "PASS"),
        case("HOME-P1-01", "P1", "SKIPPED_NOT_IN_SCOPE", inScope=False, executable=False),
    ], expected_exit=0, expected_first_line="已完成", expected_gate="passed", expect_not_in_scope=True)
    run_case("not_executable_skip", [
        case("HOME-P0-01", "P0", "PASS"),
        case("HOME-P1-01", "P1", "SKIPPED_NOT_EXECUTABLE", executable=False, blockedReason="权限缺失"),
    ], expected_exit=0, expected_first_line="已完成", expected_gate="passed", expect_not_executable=True)
    run_missing_record_non_executable_case()
    run_case("p0_fail", [
        case("HOME-P0-01", "P0", "PASS"),
        case("HOME-P0-02", "P0", "FAIL"),
    ], expected_exit=1, expected_first_line="未完成", expected_gate="failed")
    run_case("p0_blocked", [
        case("HOME-P0-01", "P0", "PASS"),
        case("HOME-P0-02", "P0", "BLOCKED_PERMISSION", blockedReason="账号无权限"),
    ], expected_exit=1, expected_first_line="未完成", expected_gate="blocked")
    run_missing_inputs()
    print("calc_ui_metrics smoke tests passed")
    return 0


def run_case(
    name: str,
    facts: list[dict[str, object]],
    *,
    expected_exit: int,
    expected_first_line: str,
    expected_gate: str,
    expect_experience_warning: bool = False,
    expect_not_in_scope: bool = False,
    expect_not_executable: bool = False,
) -> None:
    with tempfile.TemporaryDirectory(prefix=f"ui-metrics-{name}-") as raw_dir:
        task_dir = Path(raw_dir)
        write_test_md(task_dir, facts)
        (task_dir / "TEST-EXECUTION-RECORD.md").write_text(
            "```json\n" + json.dumps({"cases": facts}, ensure_ascii=False, indent=2) + "\n```\n",
            encoding="utf-8",
        )
        (task_dir / "testExecutionReport.md").write_text("# report\n", encoding="utf-8")
        result = subprocess.run([sys.executable, str(SCRIPT), "--task-dir", str(task_dir)], text=True)
        assert result.returncode == expected_exit, (name, result.returncode)
        metrics = json.loads((task_dir / "uiAutomationMetrics.json").read_text(encoding="utf-8"))
        assert metrics["gate"]["status"] == expected_gate, metrics["gate"]
        assert "experience" in metrics, metrics.keys()
        if expect_experience_warning:
            assert metrics["experience"]["usabilityScore"] is not None, metrics["experience"]
            assert metrics["experience"]["operabilityScore"] is not None, metrics["experience"]
            assert any("usability score warning" in warning for warning in metrics["warnings"]), metrics["warnings"]
            assert any("operability score warning" in warning for warning in metrics["warnings"]), metrics["warnings"]
        if expect_not_in_scope:
            skipped_case = next(case for case in metrics["cases"] if case["caseId"] == "HOME-P1-01")
            assert skipped_case["result"] == "SKIPPED_NOT_IN_SCOPE", skipped_case
            assert skipped_case["inScope"] is False, skipped_case
        if expect_not_executable:
            skipped_case = next(case for case in metrics["cases"] if case["caseId"] == "HOME-P1-01")
            assert skipped_case["result"] == "SKIPPED_NOT_EXECUTABLE", skipped_case
            assert skipped_case["executable"] is False, skipped_case
        first_line = (task_dir / "testExecutionResult.md").read_text(encoding="utf-8").splitlines()[0]
        assert first_line == expected_first_line, first_line


def run_missing_inputs() -> None:
    with tempfile.TemporaryDirectory(prefix="ui-metrics-missing-") as raw_dir:
        task_dir = Path(raw_dir)
        result = subprocess.run([sys.executable, str(SCRIPT), "--task-dir", str(task_dir)], text=True)
        assert result.returncode == 1, result.returncode
        metrics = json.loads((task_dir / "uiAutomationMetrics.json").read_text(encoding="utf-8"))
        assert metrics["gate"]["status"] == "failed", metrics["gate"]
        assert (task_dir / "testExecutionResult.md").read_text(encoding="utf-8").splitlines()[0] == "未完成"


def run_missing_record_non_executable_case() -> None:
    with tempfile.TemporaryDirectory(prefix="ui-metrics-missing-record-") as raw_dir:
        task_dir = Path(raw_dir)
        write_test_md(task_dir, [
            case("HOME-P1-01", "P1", "SKIPPED_NOT_EXECUTABLE", executable=False, blockedReason="权限缺失"),
        ])
        result = subprocess.run([sys.executable, str(SCRIPT), "--task-dir", str(task_dir)], text=True)
        assert result.returncode == 1, result.returncode
        metrics = json.loads((task_dir / "uiAutomationMetrics.json").read_text(encoding="utf-8"))
        skipped_case = next(case for case in metrics["cases"] if case["caseId"] == "HOME-P1-01")
        assert skipped_case["result"] == "SKIPPED_NOT_EXECUTABLE", skipped_case
        assert metrics["summary"]["skippedCount"] == 1, metrics["summary"]
        assert "missing_case_facts" not in metrics["gate"]["hardFailures"], metrics["gate"]
        assert metrics["gate"]["status"] == "failed", metrics["gate"]
        assert (task_dir / "testExecutionResult.md").read_text(encoding="utf-8").splitlines()[0] == "未完成"


def write_test_md(task_dir: Path, facts: list[dict[str, object]]) -> None:
    sections = ["# 测试文档\n"]
    for item in facts:
        sections.append(f"#### {item['caseId']}：示例用例\n")
        sections.append("| 属性 | 值 |\n| --- | --- |\n")
        sections.append(f"| 用例ID | {item['caseId']} |\n")
        sections.append(f"| 优先级 | {item['priority']} |\n")
        sections.append(f"| 覆盖范围 | {'本次功能' if item.get('inScope', True) else '候选扩展'} |\n")
        sections.append(f"| 本轮是否执行 | {'是' if item.get('executable', True) else '否'} |\n")
        sections.append("| 环境前提 | 现有样本 |\n")
        sections.append(f"| 不执行原因 | {item.get('skippedReason', '-') if item.get('skippedReason') else '-'} |\n\n")
    (task_dir / "TEST.md").write_text("".join(sections), encoding="utf-8")


def case(case_id: str, priority: str, result: str, **extra: object) -> dict[str, object]:
    return {
        "caseId": case_id,
        "priority": priority,
        "inScope": True,
        "executable": True,
        "result": result,
        "durationMs": 1000,
        "ttiMs": 500,
        "retryCount": 0,
        "blockedReason": None,
        "skippedReason": None,
        "samplePath": "优先样本",
        **extra,
    }


if __name__ == "__main__":
    raise SystemExit(main())
