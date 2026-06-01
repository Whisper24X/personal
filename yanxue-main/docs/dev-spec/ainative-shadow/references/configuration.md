# 配置与环境变量规范

## 系统配置
- 系统配置入口：`ainative-shadow/src/config/index.ts`
- 默认设置入口：`ainative-shadow/src/config/setting.ts`
- 快速入口配置：`ainative-shadow/src/config/fastEnter.ts`
- 顶部栏配置：`ainative-shadow/src/config/modules/headerBar.ts`

## 修改默认设置的注意事项
`src/config/setting.ts` 修改后，需要同步更新：
- `ainative-shadow/src/components/core/layouts/art-settings-panel/widget/SettingActions.vue`
- `ainative-shadow/src/store/modules/setting.ts`

## 环境变量
环境变量位于 `ainative-shadow/.env*`：
- `VITE_VERSION` - 应用版本号
- `VITE_PORT` - 本地端口
- `VITE_BASE_URL` - 部署基础路径
- `VITE_API_URL` - API 基础路径
- `VITE_API_PROXY_URL` - 开发环境代理目标
- `VITE_ACCESS_MODE` - 权限模式（frontend / backend）
- `VITE_WITH_CREDENTIALS` - 请求是否携带 Cookie
- `VITE_OPEN_ROUTE_INFO` - 路由信息调试开关
- `VITE_LOCK_ENCRYPT_KEY` - 锁屏加密密钥

## 代理配置
- Vite 代理配置在 `ainative-shadow/vite.config.ts`
- `VITE_API_PROXY_URL` 用于本地开发转发
