# ainative-app 更新日志

本文档记录 `ainative-app` 项目的重要更新和变更。

---

## [1.0.0] - 2026-01-28

### 🔄 核心依赖调整

#### Taro 框架降级
- **变更**：从 4.0.9 降级至 3.6.23
- **原因**：
  - 3.6.23 版本经过长期验证，稳定性更好
  - 生态兼容性更完善
  - 避免新版本可能存在的未知问题
- **影响**：无破坏性变更，保持 API 兼容

#### 构建工具切换
- **变更**：从 Vite 4.5.10 切换至 Webpack 5.78.0
- **原因**：
  - Webpack 5 对多端构建支持更成熟
  - 小程序平台兼容性更好
  - 插件生态更丰富
- **影响**：
  - 构建配置文件调整（`config/index.ts`）
  - 开发服务器配置优化

#### 其他依赖更新
- Pinia: 3.0.1 → 2.1.7
- Vue: 3.0.0 → 3.3.4
- pinia-plugin-persistedstate: 适配 Taro 存储

### ⚙️ 配置优化

#### H5 配置增强
```typescript
// config/index.ts
h5: {
  devServer: {
    port: 8200,
    host: 'localhost'
  },
  postcss: {
    pxtransform: {
      enable: true,
      config: {
        platform: 'h5'  // 明确指定 H5 平台
      }
    }
  }
}
```

**改进点**：
- 添加 legacy 浏览器支持
- 优化 px 转 rem 规则，适配 Taro 3 转换机制
- 明确开发服务器端口（8200）

#### 小程序配置优化
```typescript
mini: {
  postcss: {
    pxtransform: {
      enable: true,
      config: {
        unitPrecision: 5,
        selectorBlackList: [".ignore", ".hairlines", /^\.weui-/],
        minPixelValue: 1,
        mediaQuery: false
      }
    }
  }
}
```

### 🚀 应用初始化重构

#### 简化初始化流程
**之前**：
```typescript
// app.ts
onLaunch() {
  // 延迟导入路由守卫
  setTimeout(() => {
    import('@/utils/routerGuard').then(({ routerGuard }) => {
      routerGuard()
    })
  }, 0)
  
  // 延迟导入数据采集
  setTimeout(() => {
    import('@/utils/analytics').then(({ initAnalytics }) => {
      initAnalytics({ ... })
    })
  }, 0)
}
```

**现在**：
```typescript
// app.ts
import { routerGuard } from "./utils/routerGuard"
import { initAnalytics, vTrack, vTrackView } from "./utils/analytics"

// 初始化路由守卫
routerGuard()

// 注册全局埋点指令
App.directive("track", vTrack)
App.directive("trackView", vTrackView)

// 初始化数据采集分析
initAnalytics({
  enabled: true,
  enableInDev: true,
  debug: IS_DEV,
  getUserInfo: () => {
    try {
      const userStore = useUserStore()
      if (userStore.isLoggedIn && userStore.userInfo) {
        return {
          userId: userStore.userInfo.openid,
          nickname: userStore.userInfo.nickname
        }
      }
    } catch (error) {
      console.warn("获取用户信息失败:", error)
    }
    return null
  }
})
```

**改进点**：
- 移除延迟加载，直接同步初始化
- 自动从 userStore 获取用户信息
- 全局注册埋点指令，无需在组件中导入
- 代码结构更清晰，易于维护

#### Pinia 存储适配
```typescript
// app.ts
const pinia = createPinia()
pinia.use(
  createPersistedState({
    storage: {
      getItem: (key: string) => {
        try {
          return Taro.getStorageSync(key)
        } catch {
          return null
        }
      },
      setItem: (key: string, value: string) => {
        try {
          Taro.setStorageSync(key, value)
        } catch (e) {
          console.error("存储失败", e)
        }
      }
    }
  })
)
```

**改进点**：
- 使用 Taro 的 `getStorageSync` 和 `setStorageSync`
- 确保跨端兼容（小程序、H5 等）
- 添加错误处理，提高健壮性

### 🎨 组件样式调整

#### 移除 scoped 样式
- **变更**：所有组件移除 `<style scoped>` 属性
- **影响的组件**：
  - `EmptyState/index.vue`
  - `Loading/index.vue`
  - `Modal/index.vue`
  - `NavBar/index.vue`
  - `StatusBar.vue`
  - `TabBar/index.vue`
  - `TabBarLayout/index.vue`
  - `Toast/index.vue`
  - `Ui/button/index.vue`

**原因**：
- 小程序环境下 scoped 样式可能导致样式隔离问题
- 统一使用 Less 变量和命名规范管理样式
- 提高样式复用性

**建议**：
- 使用 BEM 命名规范避免样式冲突
- 通过 `@/styles/variables.less` 统一管理主题
- 组件内使用有意义的 class 前缀

#### 响应式设计优化
```html
<!-- index.html -->
<!-- 之前 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- 现在 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, 
      maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

**改进点**：
- 禁止用户缩放（`user-scalable=no`）
- 适配异形屏（`viewport-fit=cover`）
- 固定最大缩放比例

### 📦 构建配置更新

#### CI 配置增强
```javascript
// ci.config.js
module.exports = {
  WEAPP_APPID: "your-weapp-appid",
  WEAPP_PRIVATE_KEY_PATH: "key/private.key",
  WEAPP_VERSION: "1.0.0",
  WEAPP_DESC: "生产环境版本"
}
```

**新增脚本**：
```json
{
  "scripts": {
    "build:weapp": "taro build --type weapp --mode development",
    "build:weapp:test": "taro build --type weapp --mode test",
    "build:weapp:stage": "taro build --type weapp --mode stage",
    "build:weapp:production": "taro build --type weapp --mode production",
    "ci:weapp:upload:test": "taro build --type weapp --mode test --upload",
    "ci:weapp:upload:stage": "taro build --type weapp --mode stage --upload",
    "ci:weapp:upload:production": "taro build --type weapp --mode production --upload"
  }
}
```

### 📝 文档更新

#### 新增/更新文档
- ✅ 更新主文档（`README.md`）
  - 更新技术栈版本信息
  - 添加「最近更新」章节
  - 优化快速开始指南
  - 完善常见问题
- ✅ 更新数据采集文档（`references/analytics.md`）
  - 说明全局指令注册
  - 更新初始化示例
- ✅ 更新组件文档（`references/components.md`）
  - 添加样式隔离说明
  - 更新使用建议
- ✅ 新增更新日志（`CHANGELOG.md`）

### 🔧 迁移指南

如果你从旧版本迁移，请注意以下事项：

#### 1. 更新依赖
```bash
cd ainative-app
pnpm install
```

#### 2. 检查自定义配置
- 确认 `config/index.ts` 中的自定义配置是否兼容
- 检查 `config/dev.ts` 和 `config/prod.ts`

#### 3. 样式调整
- 检查组件样式是否有冲突
- 确保使用统一的命名规范
- 导入 `@/styles/variables.less` 使用主题变量

#### 4. 测试多端构建
```bash
# 测试微信小程序
pnpm dev:weapp

# 测试 H5
pnpm dev:h5

# 测试支付宝小程序
pnpm dev:alipay
```

### ⚠️ 破坏性变更

无破坏性变更，所有更新向下兼容。

### 🐛 已知问题

无已知问题。

---

## 版本规范

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

- **主版本号**：不兼容的 API 修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

---

## 反馈

如有问题或建议，请联系开发团队。
