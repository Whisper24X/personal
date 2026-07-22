# Quality Gate

## 前置检查

执行命令前先确认本次新增/修改的 HTTP Service 已注册：

```bash
rg "Register{Service}HTTPServer" studyspace-service/internal/server/http.go
```

找不到注册时，立即回到 Code 步骤补充 server 注入，不要继续执行生成或构建。

## 必须执行

按影响范围执行最低验证：

```bash
cd studyspace-service && make wire
cd studyspace-service && gofmt -w <changed-go-files>
cd studyspace-service && rg "const \(" internal/biz -g "*.go"
cd studyspace-service && go test ./internal/biz ./internal/service ./internal/server ./internal/data
cd studyspace-service && go build ./cmd/server
```

`rg "const \(" internal/biz -g "*.go"` 用于确认 Biz 层没有新增业务常量；若发现本次新增的场景、状态、类型、规则版本等常量，迁移到 `internal/data/constant` 后再继续。

如果 `go build ./cmd/server` 生成 `studyspace-service/server`，必须删除。

## 有条件执行

```bash
cd studyspace-service && make gci
cd studyspace-service && make lint
```

`make lint` 如果因历史问题失败，要区分本次引入问题和既有问题，并在结果中说明。

## 阻塞处理

如果数据库连接、`yc_turbo_kit`/`buf`/`wire` 安装、权限、网络或本地环境导致命令无法继续，不要无限重试，也不要把未验证项标记为通过。按以下模板输出阻塞结果：

```markdown
## Blocked Result
- Blocked command:
- Error summary:
- Completed artifacts:
- Unverified items:
- Next action needed:
```

阻塞前已产生的代码或生成物仍需检查 diff，并说明哪些变更属于本次任务。

## 生成物检查

- Proto 修改后，确认已先执行 `make api` 生成 pb/http/grpc/validate/swagger。
- Proto 修改后，确认 pb/http/grpc/validate/swagger 文件存在。
- Proto 修改后，确认已执行 `make protocode` 并基于生成后的 data/biz/service 文件继续实现。
- Wire 修改后，确认 `cmd/server/wire_gen.go` 更新。
- 不保留本地二进制、临时探针、调试脚本，除非用户明确要求。

## 输出模板

```markdown
## Quality Result
| Check | Status | Notes |
| --- | --- | --- |
| HTTP registration | ✅/❌ | ... |
| make protocode | ✅/❌ | ... |
| make wire | ✅/❌ | ... |
| gofmt | ✅/❌ | ... |
| constants scan | ✅/❌ | ... |
| go test | ✅/❌ | ... |
| go build | ✅/❌ | ... |
| artifact cleanup | ✅/❌ | ... |
```
