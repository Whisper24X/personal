# UI 自动化测试（TEST.md）

基于 [TEST.md](../TEST.md) 用例与 [webapp-testing](../.claude/skills/webapp-testing/SKILL.md) 技能，使用 Python + Playwright 实现管理后台渠道订单相关 UI 自动化。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `E2E_BASE_URL` | 被测地址 | `https://trip-shadow-test.yangcong345.com/trip/login` |
| `E2E_USER` | 登录账号 | `19371968034` |
| `E2E_PASSWORD` | 登录密码 | `12345678Dyw` |
| `E2E_VIEWPORT_WIDTH` | 浏览器视口宽度（像素） | `1920` |
| `E2E_VIEWPORT_HEIGHT` | 浏览器视口高度（像素） | `1080` |

建议将敏感信息放在 `.env` 中，并确保 `.env` 已加入 `.gitignore`。

## 安装与运行

1. 安装依赖与 Chromium（请用你打算跑测的 Python 版本，如 `python3.10 -m pip`）：

   ```bash
   pip install -r requirements.txt
   playwright install chromium
   ```

   若本机有多个 Python，请用已安装依赖的解释器跑测，例如：`python3.10 -m pytest tests/ -v`。

2. （可选）设置环境变量后执行用例（若未将 `pytest` 装到 PATH，请用 `python -m pytest`）：

   ```bash
   export E2E_BASE_URL=https://trip-shadow-test.yangcong345.com/trip/login
   export E2E_USER=19371968034
   export E2E_PASSWORD=12345678Dyw
   python -m pytest tests/ -v
   ```

3. 应用未启动时，可使用 webapp-testing 的 `with_server.py` 先启服再跑测：

   ```bash
   python .claude/skills/webapp-testing/scripts/with_server.py \
     --server "你的启动命令" --port 8080 \
     -- python -m pytest tests/ -v
   ```

## 用例过滤

- 按用例 ID 运行单条：`python -m pytest tests/ -k "tc_csv_001" -v`
- 按模块：`python -m pytest tests/test_csv_mapping.py -v`

## 测试数据

- `tests/fixtures/valid_orders.csv`：符合映射格式的有效订单 CSV
- `tests/fixtures/invalid_orders.csv`：格式错误/列名不匹配，用于 TC-CHANNEL-005

若实际「其他」Tab 映射字段与 CSV 表头不一致，请修改 `valid_orders.csv` 表头或用例中的定位。

## 10 条痛点演示脚本

`tests/demo/test_demo_10_scenarios.py` 包含 10 个演示场景，每个对应一条自动化痛点：

| # | 痛点 | 演示场景 |
|---|------|----------|
| 1 | 无执行能力，AI 只能写脚本无法验证 | 脚本可被 `pytest --collect-only` 验证 |
| 2 | Hover/隐藏元素需先触发再点击 | 侧栏菜单 hover 后点击 |
| 3 | 用例未结构化 + 缺治理层导致不稳定 | 结构化用例 + execution_control |
| 4 | 多用例共号 session/token 冲突 | 账号隔离 vs 复用策略 |
| 5 | 预期结果幻觉，断言需基于真实数据 | 从 DOM 读取真实文案再断言 |
| 6 | 必须走用户真实路径，不能直连路由 | 登录 → 菜单 → 页面 → 操作 |
| 7 | PRD 未给页面路径则脚本无法执行 | 路径来自配置，缺失时快速失败 |
| 8 | 预期结果必须可断言（元素/文本/状态） | 结构化 Then：selector + type + value |
| 9 | 不稳定根因是缺执行控制 | 统一等待/重试/状态判断 |
| 10 | 复杂表单需精准定位与加载控制 | CSV 映射：区块→行→控件 + 加载完成再填 |

### 运行 10 条 Demo

```bash
# 仅收集（验证脚本可加载，对应痛点 1）
pytest tests/demo/ --collect-only

# 运行 10 条 demo
pytest tests/demo/test_demo_10_scenarios.py -v

# 运行单条
pytest tests/demo/test_demo_10_scenarios.py::test_demo_01_script_verifiable -v
```

### Session 策略说明

- **默认策略（复用）**：`channel_orders_page` fixture 复用同一登录 session，适合顺序执行或同账号多用例。
- **隔离策略**：`channel_orders_page_fresh` fixture 每个 test 独立 session，避免 token 冲突，用于需要账号隔离的场景（如 demo_04）。

### 路径配置说明

若 PRD 未提供页面路径，可通过环境变量配置：

```bash
export CHANNEL_ORDERS_PATH=/channel/orders  # 可选，用于 demo_07
export BUTTON_TEXT_ADD=新增                  # 可选，按钮文案配置
```

未配置时，demo_07 会 skip（而非静默失败）。详见 `tests/demo/config.py`。

### 脚本治理层

`tests/execution_control.py` 提供统一等待、重试、状态判断：

- `wait_for_ready(locator, timeout, stable)`: 等待元素可见且可交互
- `retry_click(locator, success_check, max_attempts)`: 带重试的点击
- `hover_then_click(page, parent_selector, child_selector)`: hover 后点击
- `state_before_after(page, before_selector, after_selector, action)`: 操作前后状态对比

所有 demo 和业务用例均可复用这些函数，避免 flaky。
