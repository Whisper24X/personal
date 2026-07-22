# Project Context

## 后端模块

- 子项目目录：`<backend-dir>`，优先使用用户指定目录；未指定时从任务涉及文件、`go.mod` 和 `Makefile` 推断。
- Go module：`<go-module>`，读取 `<backend-dir>/go.mod` 的 module 值。
- API 目录：`<backend-dir>/api/{position}/v{version}`，以当前模块实际目录为准。
- SQL 目录：`<backend-dir>/doc/sql/**` 或任务指定目录，以当前模块已有规范为准。
- 服务入口：优先检查 `<backend-dir>/cmd/server`、`internal/server`、`internal/service`、`internal/biz`、`internal/data`。

## GORM 生成包

- Model：`internal/data/gorm/*_model` 或当前模块实际生成包。
- DAO：`internal/data/gorm/*_dao` 或当前模块实际生成包。
- Repo：`internal/data/gorm/*_repo` 或当前模块实际生成包。

## 常用导入

```go
pb "<go-module>/api/{position}/v{version}"
"<go-module>/internal/biz"
"<go-module>/internal/data/errorx"
"<go-module>/internal/data/gorm/{module}_model"
"<go-module>/internal/data/gorm/{module}_dao"
"<go-module>/internal/data/gorm/{module}_repo"
```

## 标准命令

```bash
cd <backend-dir> && make sqlimport <sql-file>
cd <backend-dir> && make gorm
cd <backend-dir> && make sqltopb <position> {table}
cd <backend-dir> && make api
cd <backend-dir> && make protocode
cd <backend-dir> && make wire
```

生成命令执行前后必须核对目标文件和 diff，避免 `make sqltopb`、`make gorm`、`make api`、`make protocode` 覆盖用户未提交且不属于本次任务的改动。

## Proto/API 生成顺序

涉及新增或修改 Proto/API 时，生成顺序固定为：

```text
Proto -> make api -> make protocode -> 基于生成文件改代码 -> make wire -> 验证
```

不要跳过 `make protocode` 直接手写 Biz/Data/Service。
