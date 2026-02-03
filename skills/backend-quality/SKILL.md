---
name: backend-quality
description: 后端代码质量检查技能。用于执行依赖注入、代码格式化、Lint 检查和验证。触发场景：(1) 业务逻辑实现后 (2) 代码提交前的质量检查
allowed-tools: Bash, Read, Glob
---

# Backend Quality (Step 7)

代码质量检查与验证。

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
| wire | ✅/❌ |
| gci | ✅/❌ |
| lint | ✅/❌ |

✅ 开发完成
```
