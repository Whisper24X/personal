# API Generation

## 适用场景

- Proto 新增或修改后
- 需要重新生成 `pb.go`、`grpc.pb.go`、`http.pb.go`、`pb.validate.go`
- 需要更新 swagger

## 标准生成顺序

Proto 新增或修改后必须按顺序执行：

```bash
cd studyspace-service && make api
cd studyspace-service && make protocode
```

`make api` 生成：

- `api/{position}/v1/*.pb.go`
- `api/{position}/v1/*_http.pb.go`
- `api/{position}/v1/*_grpc.pb.go`
- `api/{position}/v1/*.pb.validate.go`
- `doc/swagger/**/*.json`

`make protocode` 生成 data/biz/service 基线代码。后续业务实现必须基于生成后的文件继续修改，不允许跳过该步骤直接手写 Biz/Data/Service。
执行生成前后必须核对目标 proto、pb、swagger、data/biz/service 文件和 diff；如出现与本次 API 契约无关的改动，先暂停并说明风险。

## 命令口径

- 不使用历史错误脚手架命令，当前 Makefile 没有该目标。
- 不默认使用未定义的 proto alias，除非 Makefile 已新增对应目标。
- 如果用户口径和 Makefile 不一致，先核对并说明差异。

## 禁止行为

- 禁止手动编辑 API 生成文件。
- 禁止只执行 `make wire` 代替 `make api`。
- 禁止 proto 修改后跳过 API 生成。
- 禁止 proto 修改后跳过 `make protocode`。

## 验证

- 检查新增/修改 proto 对应的 pb/http/grpc/validate 文件已更新。
- 检查 swagger 已生成。
- 检查 data/biz/service 基线代码已由 `make protocode` 生成。
- 进入 Code 和 Quality。

## 输出模板

```markdown
## API Generation Result
- Commands:
- Generated files:
- Swagger:
- Protocode:
- Next: Code based on generated files
```
