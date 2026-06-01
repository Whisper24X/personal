# Page Agent UI 自动化 Demo

基于 [Alibaba Page Agent](https://github.com/alibaba/page-agent) 的 UI 自动化演示项目，支持用**自然语言**在网页内执行操作（点击、输入、选择等），无需浏览器扩展或 Python/Playwright 环境。

## 快速开始

### 1. 启动本地服务（必须）

Page Agent 需在**同源**环境下注入到 iframe，请勿直接双击打开 HTML，需通过本地 HTTP 服务访问：

```bash
npm run dev
```

或：

```bash
npx serve . -p 3000
```

浏览器访问：**http://localhost:3000**，打开的是 `index.html`。

### 2. 使用方式

- **单条指令**：在输入框中输入一句自然语言，如「在用户名输入框输入 admin」「点击登录按钮」「勾选记住我」，点击「执行」。
- **脚本模式**：切换到「脚本模式（多条）」标签，每行写一条指令，点击「顺序执行」会按行依次执行。

### 3. 示例指令（中文）

- 在用户名输入框输入 admin  
- 在密码输入框输入 123456  
- 勾选记住我  
- 点击登录按钮  
- 在角色下拉框选择管理员  
- 点击重置按钮  

## 项目结构

```
page-agent/
├── index.html       # Demo 入口：指令输入 + iframe 中的被测页
├── test-page.html   # 被测页面：登录表单、按钮、下拉框、复选框
├── package.json     # 仅含 dev 脚本，用于启动本地服务
└── README.md
```

## 方案二：使用自己的 API Key（NPM）

当前 Demo 使用官方 **免费 Demo LLM**（CDN 引入 `page-agent.demo.js`），仅适合技术评估。若需在生产或内网使用，可：

1. 安装依赖：`npm install page-agent`
2. 使用支持 OpenAI 兼容接口的模型，配置 `model`、`baseURL`、`apiKey`，例如：
   - **OpenAI**：`baseURL: 'https://api.openai.com/v1'`，`model: 'gpt-4o'` 等
   - **通义千问**：`baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'`，`model: 'qwen3.5-plus'`
   - **DeepSeek / 其他**：使用对应 API 的 baseURL 与 model
3. 在**目标页面**（或注入到目标页的脚本）中创建 Agent 并执行，例如：

```javascript
import { PageAgent } from 'page-agent'

const agent = new PageAgent({
  model: 'qwen3.5-plus',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.API_KEY || 'YOUR_API_KEY',
  language: 'zh-CN',
})

await agent.execute('点击登录按钮')
```

API Key 建议通过环境变量或构建时注入，不要提交到仓库。

## 注意事项

- **同源**：Agent 只能操作与脚本同源的页面，本 Demo 通过 iframe 加载同源 `test-page.html` 实现注入与执行。
- **Demo LLM**：CDN 的 demo 构建受 [官方条款](https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md) 约束，仅用于技术评估。
- **语言**：Demo 中已设置 `language: 'zh-CN'`，便于使用中文指令。

## 参考

- [Page Agent 官方文档](https://alibaba.github.io/page-agent/docs/introduction/quick-start)
- [GitHub 仓库](https://github.com/alibaba/page-agent)
