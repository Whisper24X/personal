# Project Context

## 后端模块

- 子项目目录：`studyspace-service`
- Go module：`gitlab.yc345.tv/backend/studyspace-service`
- Shadow API：`studyspace-service/api/shadow/v1`
- App API：`studyspace-service/api/app/v1`
- SQL 目录：`studyspace-service/doc/sql/studyspace_crm`

## GORM 生成包

- Model：`internal/data/gorm/studyspace_service_model`
- DAO：`internal/data/gorm/studyspace_service_dao`
- Repo：`internal/data/gorm/studyspace_service_repo`

## 常用导入

```go
pb "gitlab.yc345.tv/backend/studyspace-service/api/shadow/v1"
"gitlab.yc345.tv/backend/studyspace-service/internal/biz"
"gitlab.yc345.tv/backend/studyspace-service/internal/data/errorx"
"gitlab.yc345.tv/backend/studyspace-service/internal/data/gorm/studyspace_service_model"
"gitlab.yc345.tv/backend/studyspace-service/internal/data/gorm/studyspace_service_dao"
"gitlab.yc345.tv/backend/studyspace-service/internal/data/gorm/studyspace_service_repo"
```

## 标准命令

```bash
cd studyspace-service && make sqlimport ./doc/sql/studyspace_crm/{file}.sql
cd studyspace-service && make gorm
cd studyspace-service && make sqltopb shadow {table}
cd studyspace-service && make sqltopb app {table}
cd studyspace-service && make api
cd studyspace-service && make protocode
cd studyspace-service && make wire
```

生成命令执行前后必须核对目标文件和 diff，避免 `make sqltopb`、`make gorm`、`make api`、`make protocode` 覆盖用户未提交且不属于本次任务的改动。

## Proto/API 生成顺序

涉及新增或修改 Proto/API 时，生成顺序固定为：

```text
Proto -> make api -> make protocode -> 基于生成文件改代码 -> make wire -> 验证
```

不要跳过 `make protocode` 直接手写 Biz/Data/Service。
