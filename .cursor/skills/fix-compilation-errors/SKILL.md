---
name: fix-compilation-errors
description: Diagnoses and fixes TypeScript build errors including TS6133 (unused variables), TS2307 (module not found), TS2339 (property does not exist). Use when build fails, when tsc/tsc-alias errors are reported, when user mentions compilation errors or "declared but never read".
---

# 修复编译错误

## 触发场景

- `pnpm build` / `tsc` 构建失败
- 错误信息包含 `error TS6xxx` 或 `error TS2xxx`
- 用户提到「编译失败」「未使用的变量」「declared but never read」

---

## 常见错误与修复策略

### TS6133: 变量已声明但从未读取

```
error TS6133: 'XXX' is declared but its value is never read.
```

**处理顺序**：

1. **移除**：若确实不需要，直接删除该声明
2. **使用**：若为预留或文档用途，在合适位置引用它（如 `path.join(workDir, Deploy.DEPLOY_LOG_FILE)`）
3. **下划线前缀**（最后手段）：`private static readonly _UNUSED = 'path'` 表示有意保留

**优先移除**：未使用的常量、未使用的 import、未使用的参数。

---

### TS2307: 找不到模块

```
error TS2307: Cannot find module 'xxx' or its corresponding type declarations.
```

**处理**：

1. 检查 `import` 路径是否正确（相对路径、alias）
2. 若为 npm 包：`pnpm add xxx` 或 `pnpm add -D @types/xxx`
3. 若为 monorepo 内部包：确认 `pnpm-workspace.yaml` 与 `package.json` 的 `name` 一致

---

### TS2339: 属性不存在

```
error TS2339: Property 'xxx' does not exist on type 'YYY'.
```

**处理**：

1. 检查拼写与类型定义
2. 若属性可选：使用 `obj?.xxx` 或类型断言
3. 更新 `@mind2build/shared` 等共享类型定义

---

## 修复流程

1. **定位**：从错误输出读取 `file:line:col`，打开对应文件
2. **理解**：结合错误码和上下文判断根因
3. **修改**：按上述策略做最小改动
4. **验证**：运行 `pnpm --filter @mind2build/backend build` 或完整 `pnpm --filter "@mind2build/*" build`

---

## 示例

**TS6133 移除未使用常量**：

```typescript
// Before
private static readonly DEPLOY_LOG_FILE = 'docs/deploy/deployLog.md';  // 未使用

// After - 直接删除该行
```

**TS6133 使用常量**（若后续需要读取该文件）：

```typescript
const logPath = path.join(workDir, Deploy.DEPLOY_LOG_FILE);
const content = await fs.readFile(logPath, 'utf-8').catch(() => '');
```
