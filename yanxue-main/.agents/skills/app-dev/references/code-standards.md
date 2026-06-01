# 代码规范

ESLint + Prettier + Git 提交规范 + 环境配置。

## Prettier 配置

```js
{
  semi: false,              // 不使用分号
  singleQuote: false,       // 使用双引号
  tabWidth: 2,              // 2 空格缩进
  useTabs: false,
  trailingComma: "none",    // 对象末尾无逗号
  bracketSpacing: true,     // 对象大括号内有空格
  endOfLine: "lf",          // LF 换行
  arrowParens: "avoid",     // 单参箭头函数不加括号
  printWidth: 100            // 每行最多 100 字符
}
```

## ESLint 关键规则

```js
// 类型导入必须用 import type
"@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }]

// 未使用变量警告（非错误）
"@typescript-eslint/no-unused-vars": "warn"

// 生产环境 console/debugger 警告
"no-console": process.env.NODE_ENV === "production" ? "warn" : "off"

// 小程序场景关闭
"vue/attribute-hyphenation": "off"        // 允许驼峰属性（海报生成需要）
"vue/multi-word-component-names": 0       // 允许单词组件名
```

## lint-staged（提交前自动修复）

```json
"*.{js,ts,vue}": ["eslint --fix", "prettier --write"],
"*.{css,less,scss}": ["prettier --write"]
```

## Git 提交规范

### Commit 类型

| 类型       | 说明                         |
| ---------- | ---------------------------- |
| `feat`     | 新功能                       |
| `fix`      | 修复 Bug                     |
| `docs`     | 文档修改                     |
| `style`    | 代码格式（不影响逻辑）       |
| `refactor` | 重构（非 bug fix、非新功能） |
| `perf`     | 性能优化                     |
| `test`     | 测试相关                     |
| `chore`    | 构建/工具变动                |
| `revert`   | 版本回退                     |
| `ci`       | CI 配置                      |
| `build`    | 构建系统或外部依赖           |
| `wip`      | 进行中的工作                 |

### 规则

- type 必须小写
- subject 不能为空
- subject 末尾不加句号
- header 最长 200 字符

```bash
# 示例
feat: 新增订单支付储值功能
fix: 修复 Modal 在 iOS 16 下动画闪烁问题
refactor: 提取 useOrderPayment 组合式函数统一支付逻辑
```

## 环境配置

### 环境类型

| 环境          | 触发命令                    | API 地址                         |
| ------------- | --------------------------- | -------------------------------- |
| `local`       | `dev:h5:local`              | `/api`（本地代理）               |
| `development` | `dev:weapp` / `build:weapp` | `trip-api-test.yangcong345.com`  |
| `test`        | `build:weapp:test`          | `trip-api-test.yangcong345.com`  |
| `stage`       | `build:weapp:stage`         | `trip-api-stage.yangcong345.com` |
| `production`  | `build:weapp:production`    | `trip-api.yangcong345.com`       |

### 使用方式

```ts
import { BASE_API, IS_DEV, IS_PROD, CONFIG } from "@/config/env"

// 请求超时
CONFIG.REQUEST_TIMEOUT   // 10000ms

// 是否开启 debug
CONFIG.DEBUG             // IS_DEV || IS_TEST

// 环境判断
if (IS_PROD) { ... }
```

### 全局变量

通过 Taro 构建时注入 `__ENV_TYPE`（`global.d.ts` 中声明）：

```ts
// global.d.ts
declare const __ENV_TYPE: string;
```
