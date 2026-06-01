# 渠道订单管理 Playwright 自动化 Demo（标准 Demo）

基于 Python + Playwright + pytest 的渠道订单管理 UI 自动化 Demo，覆盖 **10 个核心场景**（渠道配置、CSV 导入、CSV 映射配置、端到端、搜索/筛选）。

## 前置要求

- Python 3.10+
- 被测环境可访问（默认：`https://trip-shadow-test.yangcong345.com/trip/login`）

## 快速开始

```bash
pip install -r requirements.txt
playwright install chromium
python -m pytest tests/ -v
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `E2E_BASE_URL` | 被测地址 | `https://trip-shadow-test.yangcong345.com/trip/login` |
| `E2E_USER` | 登录账号 | `19371968034` |
| `E2E_PASSWORD` | 登录密码 | `12345678Dyw` |
| `E2E_VIEWPORT_WIDTH` | 视口宽度（像素） | `1920` |
| `E2E_VIEWPORT_HEIGHT` | 视口高度（像素） | `1080` |

详见 [tests/README.md](tests/README.md)。

## 10 场景索引

| # | 场景 | 用例 ID | 测试文件 |
|---|------|---------|----------|
| 1 | 渠道配置入口打开弹窗 | TC-channel-001 | test_channel_config.py |
| 2 | 渠道配置新增成功 | TC-channel-004 | test_channel_config.py |
| 3 | 渠道配置编码重复提示 | TC-channel-005 | test_channel_config.py |
| 4 | 导入弹窗购买渠道下拉展示 | TC-channel-007 | test_channel_import.py |
| 5 | 选择渠道上传 CSV 成功导入 | TC-channel-009 | test_channel_import.py |
| 6 | 映射配置 Tab 按渠道展示 | TC-channel-011 | test_csv_mapping.py |
| 7 | 映射配置字段映射并保存 | TC-channel-013 | test_csv_mapping.py |
| 8 | 端到端新增渠道并首次导入 | TC-channel-015 | test_e2e.py |
| 9 | 按手机号搜索 | TC-search-001 | test_search.py |
| 10 | 重置清空筛选 | TC-search-006 | test_search.py |

完整说明见 [docs/10场景说明.md](docs/10场景说明.md)。用例详情见 [TEST-初版.md](TEST-初版.md)。

## 项目结构

```
test-playwright/
├── README.md           # 本文件
├── requirements.txt
├── TEST-初版.md        # 测试用例文档
├── docs/
│   └── 10场景说明.md   # 10 场景与用例映射
└── tests/
    ├── conftest.py     # 公共 fixture（浏览器、登录、渠道订单页）
    ├── page/           # 页面/步骤封装
    ├── fixtures/       # 测试数据（如 CSV）
    ├── test_channel_config.py
    ├── test_channel_import.py
    ├── test_csv_mapping.py
    ├── test_e2e.py
    └── test_search.py
```

## 运行方式

```bash
# 全量
python -m pytest tests/ -v

# 单模块
python -m pytest tests/test_channel_config.py -v
python -m pytest tests/test_csv_mapping.py -v

# 单用例（示例）
python -m pytest tests/test_channel_config.py -k "tc_channel_001" -v
```
