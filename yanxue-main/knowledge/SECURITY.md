# 安全约束

## 认证方式

- **JWT**：Bearer Token
- **Header**：`Authorization: Bearer <token>`
- Token 解析失败或缺失时返回相应错误码

---

## 白名单与可选认证

### Shadow (管理后台)

- 白名单接口（如登录）无需 Token
- 非白名单接口必须携带有效 Token

### Wechat (小程序)

- 白名单接口：登录、发送验证码、商品详情（可选）等
- 可选认证：部分接口有 Token 则解析，无则跳过

---

## 权限控制

### 路由级

- 前端：路由守卫 `beforeEach` 检查登录与权限
- 后端：中间件按白名单匹配，非白名单需通过 JWT 校验

### 按钮级

- Shadow：`v-auth` 指令控制按钮显示
- 权限来源于 `meta.authList` 或后端菜单

### RBAC

- 角色 (SysRole) + 权限 (SysPermission)
- 部门层级 (SysDept)
- SysRolePermission 关联角色与权限

---

## 安全扫描

- **gosec**：`make gosec` 扫描 Go 代码
- 检查 SQL 注入、硬编码密钥、弱加密等

---

## 敏感数据处理

- 密码：加密存储，不明文传输
- Token：通过 Header 传递，不写入 URL
- 日志：避免记录完整 Token、密码等敏感信息

---

## 相关文档

- [ainative-backend 认证中间件](../ainative-backend/internal/pkg/middleware/auth/)
- [Shadow 路由与权限](../docs/dev-spec/ainative-shadow/references/routing-permission.md)
- [App API 请求规范](../docs/dev-spec/ainative-app/references/api-request.md)
- [openspec/project.md](../openspec/project.md) - Authentication
