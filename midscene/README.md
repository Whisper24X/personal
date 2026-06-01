# 自动化 Demo

支持两种自动化模式：**Midscene 视觉 UI 自动化** 与 **Cursor CLI 模式**。

## 两种模式对比

| 模式 | 适用场景 | 所需配置 |
|------|----------|----------|
| **Midscene** | 浏览器 UI 自动化（点击、输入、截图理解） | 视觉模型 API（Qwen/Doubao/Gemini 等） |
| **Cursor CLI** | 代码/文件/终端自动化（Engineer 角色） | CURSOR_API_KEY |

> ⚠️ **重要**：Cursor API 不提供 OpenAI 兼容的视觉模型接口，**无法替代** Midscene 的视觉模型。浏览器 UI 自动化必须配置视觉模型；Cursor CLI 适用于非浏览器类任务。

## 快速开始

### 1. 安装依赖

```bash
npm install
npx playwright install chromium  # 仅 Midscene 模式需要
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

**Cursor CLI 模式**（Engineer 角色、cli 执行器）：
```
CURSOR_API_KEY=key_xxxxxxxx
DEFAULT_EXECUTOR_MODE=cli
DEFAULT_CLI_PROVIDER=cursor
CURSOR_CLI_MODEL=composer-1.5
CURSOR_CLI_TIMEOUT=3600000
ROLE_ENGINEER_CLI_MODEL=composer-1.5
```

**Midscene 模式**（浏览器 UI 自动化）需额外配置视觉模型，例如阿里云 Qwen3-VL：
```
MIDSCENE_MODEL_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
MIDSCENE_MODEL_API_KEY="sk-xxxxx"
MIDSCENE_MODEL_NAME="qwen3-vl-plus"
MIDSCENE_MODEL_FAMILY="qwen3-vl"
```

### 3. 运行 Demo

```bash
# Midscene：浏览器 UI 自动化（需视觉模型）
npm run demo
npm run demo:baidu

# Cursor CLI：代码/文件自动化（需 Cursor CLI + CURSOR_API_KEY）
npm run demo:cursor
npm run demo:cursor -- "你的任务描述"
```

## 项目结构

```
midscene/
├── demo.ts            # Midscene 完整 Demo
├── demo-baidu.ts      # Midscene 简化版
├── demo-cursor-cli.ts # Cursor CLI 模式 Demo
├── .env.example       # 环境变量模板（含 Cursor + Midscene 配置）
├── .env               # 你的配置（需自行创建）
├── package.json
└── README.md
```

## Demo 说明

### demo.ts / demo-baidu.ts（Midscene）

演示 Midscene 核心能力：

1. **aiAct**：自然语言执行操作（输入、点击）
2. **aiWaitFor**：等待页面出现指定内容
3. **aiQuery**：提取结构化数据
4. **aiAssert**：AI 断言验证
5. **aiString**：获取文本信息

### demo-cursor-cli.ts（Cursor CLI）

使用 Cursor Agent 执行代码/文件类任务，需安装 [Cursor](https://cursor.com/) 或 Cursor CLI。配置 `CURSOR_API_KEY` 后运行：

```bash
npm run demo:cursor
# 或自定义任务
npm run demo:cursor -- "在项目中创建 README 并写入项目简介"
```

### 运行报告

执行成功后，终端会输出报告路径，例如：

```
Midscene - report file updated: /path/to/report/xxx.html
```

在浏览器中打开该 HTML 文件可查看可视化执行报告。

## 常见问题

### 1. "MIDSCENE_MODEL_FAMILY is required"

确保 `.env` 中设置了 `MIDSCENE_MODEL_FAMILY`，且与所选模型匹配。

### 2. 连接测试

可使用 [官方 connectivity-test](https://github.com/web-infra-dev/midscene-example/tree/main/connectivity-test) 验证模型服务连通性。

### 3. 无头模式

将 `demo.ts` 中 `headless: false` 改为 `headless: true` 可后台运行。

## 参考链接

- [Midscene 官网](https://midscenejs.com/)
- [Playwright 集成文档](https://midscenejs.com/integrate-with-playwright.html)
- [模型配置](https://midscenejs.com/model-common-config.html)
- [示例项目](https://github.com/web-infra-dev/midscene-example)
