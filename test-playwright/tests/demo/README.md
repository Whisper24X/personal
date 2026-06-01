# 10 条痛点演示脚本

本目录包含 10 个演示场景，每个场景对应一条 UI 自动化痛点，展示「正确做法」。

## 快速开始

```bash
# 验证脚本可加载（痛点 1）
pytest tests/demo/ --collect-only

# 运行所有 10 条 demo
pytest tests/demo/test_demo_10_scenarios.py -v

# 运行单条
pytest tests/demo/test_demo_10_scenarios.py::test_demo_01_script_verifiable -v
```

## 痛点与场景映射

| # | 痛点 | 演示场景 | 文件位置 |
|---|------|----------|----------|
| 1 | 无执行能力，AI 只能写脚本无法验证 | 脚本可被 `pytest --collect-only` 验证 | test_demo_01_script_verifiable |
| 2 | Hover/隐藏元素需先触发再点击 | 侧栏菜单 hover 后点击 | test_demo_02_hover_then_click |
| 3 | 用例未结构化 + 缺治理层导致不稳定 | 结构化用例 + execution_control | test_demo_03_structured_case_and_governance |
| 4 | 多用例共号 session/token 冲突 | 账号隔离 vs 复用策略 | test_demo_04_session_isolation_or_reuse |
| 5 | 预期结果幻觉，断言需基于真实数据 | 从 DOM 读取真实文案再断言 | test_demo_05_assert_from_real_page |
| 6 | 必须走用户真实路径，不能直连路由 | 登录 → 菜单 → 页面 → 操作 | test_demo_06_real_user_path_only |
| 7 | PRD 未给页面路径则脚本无法执行 | 路径来自配置，缺失时快速失败 | test_demo_07_path_from_config |
| 8 | 预期结果必须可断言（元素/文本/状态） | 结构化 Then：selector + type + value | test_demo_08_assertable_expected_result |
| 9 | 不稳定根因是缺执行控制 | 统一等待/重试/状态判断 | test_demo_09_execution_control |
| 10 | 复杂表单需精准定位与加载控制 | CSV 映射：区块→行→控件 + 加载完成再填 | test_demo_10_complex_form_precise_locator |

## 文件说明

- `test_demo_10_scenarios.py`: 10 个测试函数，每个对应一条痛点
- `cases.yaml`: 结构化用例数据（id、steps、then），用于 demo_03 和 demo_08
- `config.py`: 路径和文案配置管理，缺失时快速失败（用于 demo_05、demo_07）

## 依赖

- `tests/execution_control.py`: 脚本治理层（wait_for_ready、retry_click、hover_then_click）
- `tests/conftest.py`: 提供 `channel_orders_page`（复用）和 `channel_orders_page_fresh`（隔离）fixture

## 详细说明

详见 [tests/README.md](../README.md) 的「10 条痛点演示脚本」章节。
