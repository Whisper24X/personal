# 质量评分标准

## 代码质量检查维度

- **Lint**：语法与风格
- **类型**：TypeScript / Go 类型正确性
- **安全**：gosec、SQL 注入、敏感数据

---

## 后端检查

| 命令 | 作用 | 时机 |
|-----|------|------|
| `make wire` | 依赖注入检查 | 修改 Provider 后 |
| `make build` | 编译检查 | 提交前 |
| `make lint` | 代码规范 (golangci-lint) | 提交前 |
| `make gosec` | 安全扫描 | 提交前 |
| `make gci` | Import 格式化 | 提交前 |


### 提交前推荐

```bash
make gci && make wire && make lint && make gosec && make build
```

---

## 前端检查

| 命令 | 作用 |
|-----|------|
| `pnpm lint` | ESLint |
| `pnpm lint:fix` | 自动修复 |
| `pnpm type-check` | TypeScript 类型 |
| `pnpm lint:stylelint` | 样式 (shadow) |
| `pnpm format` | Prettier 格式化 |

---

## 提交前检查清单

### 通用

- [ ] 符合 ESLint / Go Lint
- [ ] 无类型错误
- [ ] 命名清晰
- [ ] 关键逻辑有注释
- [ ] 错误处理完善

### 前端

- [ ] 组件拆分合理
- [ ] Props / Emits 有类型
- [ ] API 调用有错误处理
- [ ] Loading / Empty 状态
- [ ] 样式 scoped

### 后端

- [ ] 分层清晰 (Service/Biz/Data)
- [ ] 接口定义在 Biz 层
- [ ] SQL 参数化
- [ ] 事务处理正确

---

## 相关文档

- [code-review-ainative Skill](../.cursor/skills/code-review-ainative/SKILL.md)
- [后端代码检查](../docs/dev-spec/ainative-backend/references/code-check.md)
- [openspec/project.md](../openspec/project.md) - Testing Strategy
