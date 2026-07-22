# GORM

## 适用场景

- 新建表后生成 GORM model/dao/repo
- 表结构变更后重新生成 GORM
- 检查 GORM 工件是否存在

## 命令

```bash
cd studyspace-service && make gorm
```

如需指定表，按当前 Makefile/工具支持的 `TABLES={table}` 方式执行。
执行前后必须核对 `internal/data/gorm/studyspace_service_*` 的目标文件和 diff，只接受本次表结构相关的生成变更。

## 生成文件

当前项目生成路径通常为：

- `studyspace-service/internal/data/gorm/studyspace_service_model/*.gen.go`
- `studyspace-service/internal/data/gorm/studyspace_service_dao/*.gen.go`
- `studyspace-service/internal/data/gorm/studyspace_service_repo/*.repo.go`

## 禁止行为

- 禁止手动编辑 `internal/data/gorm/**/*.gen.go`。
- 禁止手动编辑生成 DAO。
- 生成 Repo 能满足调用时，业务层应优先使用现有生成 Repo 方法。
- 只有生成 Repo 缺少必要能力时，才在 `internal/data` 补自定义方法。

## 验证

- 检查对应 model、dao、repo 文件存在。
- 检查生成字段与 SQL 字段一致。
- 编译或目标包测试通过。

## 输出模板

```markdown
## GORM Result
- Command:
- Generated files:
- Verification:
```
