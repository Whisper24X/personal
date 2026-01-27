# 研学预约小程序

## 代码规范

本项目使用 ESLint 和 Prettier 进行代码格式化和检查，使用 Husky 和 lint-staged 在提交前自动执行代码格式化，使用 commitlint 检查提交信息格式。

### 代码格式化

提交前，代码会自动通过 lint-staged 运行以下检查：

- JavaScript/TypeScript/Vue 文件: ESLint + Prettier
- CSS/Less/SCSS 文件: Prettier

你也可以手动运行以下命令：

```bash
# 检查代码风格
pnpm lint

# 自动修复代码风格问题
pnpm lint:fix

# 格式化代码
pnpm format
```

### 提交规范

提交信息必须符合 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 规范，格式如下：

```
<类型>[可选的作用域]: <描述>

[可选的正文]

[可选的脚注]
```

类型必须是以下之一：

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档修改
- `style`: 代码格式修改，不影响代码逻辑
- `refactor`: 重构代码，不包括 bug 修复、功能新增
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动
- `revert`: 回滚到上一个版本
- `ci`: CI 配置相关
- `build`: 构建系统或外部依赖项更改
- `wip`: 进行中的工作

提交信息示例：

```
feat(user): 添加用户登录功能

- 实现了微信登录
- 添加了用户信息页面
```

你可以手动运行以下命令检查提交信息：

```bash
pnpm commitlint --edit
```

## 数据采集分析

本项目封装了微信小程序 `wx.reportEvent` API，实现用户行为的无痕数据采集分析。支持自动埋点和手动调用两种方式。从基础库 2.31.1 开始，wx.reportAnalytics 停止维护，已升级为使用 wx.reportEvent。

### 功能特性

- ✅ **自动埋点**: 通过 Vue 指令实现声明式埋点，无需编写额外代码
- ✅ **手动调用**: 提供灵活的 API 用于复杂场景的数据采集
- ✅ **自动收集**: 自动采集页面路径、用户信息、时间戳等基础数据
- ✅ **类型安全**: 完整的 TypeScript 类型定义
- ✅ **错误处理**: 埋点失败不影响业务逻辑
- ✅ **开发友好**: 开发环境输出详细日志，方便调试

### 使用方式

#### 1. 自动埋点（推荐）

使用 `v-track` 指令追踪点击事件：

```vue
<template>
  <!-- 基础用法：追踪按钮点击 -->
  <button v-track="'btn_submit_order'">提交订单</button>

  <!-- 带自定义数据 -->
  <button
    v-track="{
      event: 'btn_buy_product',
      data: { productId: 123, price: 99 }
    }"
  >
    立即购买
  </button>

  <!-- 追踪元素曝光 -->
  <view
    v-track-view="{
      event: 'banner_view',
      data: { bannerId: 456 }
    }"
  >
    广告横幅
  </view>
</template>
```

#### 2. 手动调用

在需要的地方导入并调用相关方法：

```typescript
import { track, trackPageView, trackClick, trackShare } from "@/utils/analytics"

// 基础用法：追踪自定义事件
track("custom_event", {
  action: "submit",
  formId: 123
})

// 追踪页面浏览
trackPageView()

// 追踪点击事件
trackClick("submit_button", {
  orderId: 456
})

// 追踪分享事件
trackShare("wechat", {
  contentId: "789",
  contentType: "product"
})
```

### 配置说明

全局配置在 `src/app.ts` 中完成：

```typescript
import { initAnalytics } from "./utils/analytics"

initAnalytics({
  enabled: true, // 是否启用数据采集
  enableInDev: true, // 开发环境是否启用
  debug: true, // 是否输出调试日志
  getUserInfo: () => {
    // 获取用户信息
    // 返回用户信息对象
  },
  beforeTrack: data => {
    // 数据预处理
    // 返回处理后的数据或 null 以取消上报
    return data
  }
})
```

### 数据格式

所有事件数据会自动包含以下基础信息：

- `eventId`: 事件ID（必填，需在小程序后台配置）
- `eventType`: 事件类型（click、page_view、share 等）
- `pagePath`: 当前页面路径
- `pageQuery`: 页面查询参数
- `timestamp`: 时间戳
- `userId`: 用户ID（如果已登录）
- 其他自定义字段

### 注意事项

1. **事件 ID 配置**: 使用前需要在微信小程序后台「数据分析 -> 事件分析」中配置相应的事件 ID
2. **数据类型限制**: `wx.reportEvent` 支持可被 JSON.stringify 的对象，为了保持向下兼容，仍然转换为 string 和 number 类型
3. **API 兼容性**: 从基础库 2.31.1 开始，wx.reportAnalytics 停止维护，自动使用 wx.reportEvent 代替（基础库 >= 2.14.4）
4. **环境兼容**: 只在微信小程序环境中生效，其他环境会自动跳过上报
5. **性能影响**: 数据采集是异步执行的，不会阻塞主线程

### 文件说明

- `src/types/analytics.ts`: 类型定义文件
- `src/utils/analytics.ts`: 核心工具和指令实现
- `src/app.ts`: 全局注册和初始化配置

### 常用事件示例

```typescript
// 商品详情页浏览
track("product_view", { productId: 123 })

// 加入购物车
track("add_to_cart", { productId: 123, quantity: 1 })

// 下单
track("create_order", { orderId: 456, amount: 199 })

// 支付成功
track("payment_success", { orderId: 456, amount: 199 })

// 分享商品
track("share_product", { productId: 123, shareChannel: "wechat" })
```

## 小程序CI使用指南

本项目集成了Taro小程序CI功能，可以通过命令行实现自动打开开发者工具、上传代码和生成预览二维码等功能。

### 配置

1. 在微信小程序后台获取AppID和上传密钥（private.key）
2. 将密钥文件放在项目根目录的`key`文件夹中，命名为`private.key`
3. 复制`ci.config.example.js`为`ci.config.js`，并填入你的实际配置:
   ```js
   module.exports = {
     WEAPP_APPID: "你的微信小程序AppID",
     WEAPP_PRIVATE_KEY_PATH: "key/private.key",
     WEAPP_VERSION: "1.0.0",
     WEAPP_DESC: "提交描述"
   }
   ```

### 使用

项目提供了以下CI相关命令：

```bash
# 自动打开微信开发者工具
pnpm ci:weapp:open

# 上传代码并生成预览二维码
pnpm ci:weapp:preview

# 上传代码作为体验版
pnpm ci:weapp:upload

# 上传不同环境的代码作为体验版
pnpm ci:weapp:upload:test     # 测试环境
pnpm ci:weapp:upload:stage    # 预发布环境
pnpm ci:weapp:upload:production  # 生产环境
```

### 注意事项

- 请确保已安装微信开发者工具
- 首次使用时，需要在微信开发者工具中启用"设置 -> 安全 -> 服务端口"
- 上传代码前，请确保你有该小程序的上传权限
- 如需修改版本号和描述，可以直接修改`ci.config.js`文件
