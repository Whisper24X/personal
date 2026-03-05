---
name: backend-quality
description: 后端代码质量检查技能。用于执行依赖注入、代码格式化、Lint 检查和验证。触发场景：(1) 业务逻辑实现后 (2) 代码提交前的质量检查
allowed-tools: Bash, Read, Glob
---

# Backend Quality (Step 7)

代码质量检查与验证。

## 前置检查：http.go 注册验证

**在执行任何 make 命令之前**，必须验证本次新增的所有 Service 均已注册到 `internal/server/http.go`：

```bash
grep "Register{Table}HTTPServer" ainative-backend/internal/server/http.go
```

- ❌ 若未找到 → **立即停止**，返回 Step 6 (`backend-codeing`) 的 Step 4 补充注册，再重新执行本步骤
- ✅ 找到后 → 继续执行以下命令

## 命令

```bash
cd ainative-backend && make wire
cd ainative-backend && make gci
cd ainative-backend && make lint
```

## 输出

```
## Step 7: 质量检查
| 检查项 | 状态 |
|--------|------|
| http.go 注册验证 | ✅/❌ |
| wire | ✅/❌ |
| gci | ✅/❌ |
| lint | ✅/❌ |

✅ 开发完成
```
