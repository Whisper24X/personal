# devices-learn 业务逻辑迁移 设计文档

## 背景与目标

`devices-learn` 的 `refact-tmp` 分支已按最新框架（Kratos + GORM + `yc_turbo_kit`）生成好骨架：
`api/*/v1/*.proto`、GORM repo、`internal/biz` 的逐方法空 handler、`internal/service`、`internal/data` 各 domain 文件、`internal/data/rpc` 第三方接口骨架。

目标：**在 `refact-tmp` 分支中，按 `master` 分支的业务逻辑，把这些空 handler 全量补齐**，保持现有生成物与接口契约不变。

## 澄清问题及结论

| 问题 | 结论 |
| --- | --- |
| 是否改数据库 schema / Proto / API 契约？ | 默认不改。只填业务逻辑。只有发现 `master` 行为无法用现有 `refact-tmp` API 表达时，才回到 `make sqltopb`/`make api`/`make protocode`，且需先停下确认。 |
| 第三方接口放哪里？ | 全部落在 `internal/data/rpc`（已有 `grpc.go`/`http.go` 骨架）。Biz 只依赖接口，Data Repo 组合调用，不把第三方请求散落到 Biz。 |
| 封装粒度？ | 不过度封装。优先复用生成 Repo（`internal/data/gorm/devices_learn_repo`），仅在 DTO 转换、复杂查询、事务、缓存清理等生成 Repo 无法覆盖时，才在 `internal/data/*.go` 补自定义方法。 |
| 开发流程？ | 强制使用 `backend-dev` 技能流水线，主路径为「只改业务逻辑」：Audit -> Code -> Quality。 |
| 当前 DI 现状？ | `internal/data/data.go` 的 ProviderSet 已注册各 Repo；但 `internal/biz` 的 UseCase 构造函数只注入 `logger`，未注入 Repo。需要在每个 domain 迁移时补齐 UseCase -> Repo 注入并 `make wire`。 |

## 拆解策略（核心决策）

**按 domain 拆分为多个 OpenSpec change**，而非一个巨型 change。理由：迁移横跨 7-8 个 domain，单个 change 制品过大、验证周期过长、Code Review 不可控；按 domain 拆分后每个 change 可独立编译、测试、回归。

change 拆分与建议顺序（低风险 -> 高风险）：

| 顺序 | change-id | 覆盖 domain | 说明 |
| --- | --- | --- | --- |
| 1 | `migrate-learn-config` | learn_config | **首个 change，跑通整个流程**，同时确立「UseCase 注入 Repo + wire」的 DI 模式 |
| 2 | `migrate-dynamic-config` | dynamic_learn_config / dynamic_function_config / dynamic_dock_config(v2) | 表驱动配置类，复用生成 Repo |
| 3 | `migrate-style-target-task` | style / target / task | 含「创建学习风格/目标后任务完成」联动副作用；task 第三方调用入 `data/rpc` |
| 4 | `migrate-proxy-diagnosis` | user / desktop / course_learn / diagnosis | 无表/聚合代理类，外部服务封装入 `data/rpc` |
| 5 | `migrate-nps` | nps / nps_case / nps_go_learn_scene_num | 含 MQ consumer、Cron summary、自定义下载路由 |
| 6 | `migrate-homework-assistant` | homework_assistant | 搜题/批改/OSS/排行/异步任务，最复杂，含 yc_oss、TAL/OpenAI 等 RPC 与排行 Cron |

> 本文档作为整个迁移的总纲；每个 change 各自拥有 `proposal.md` / `specs/` / `tasks.md` / `design.md`（可引用本总纲）。

## 技术设计

### 架构分层（保持框架既定分层）

```
Service（仅透传）-> Biz（UseCase + Repo 接口 + 业务逻辑）-> Data（Repo 实现，优先复用生成 Repo）
                                                              └─ rpc/（第三方 HTTP/gRPC 客户端）
```

### 每个 domain 的迁移步骤（backend-dev「只改业务逻辑」流水线）

1. **Audit**：对比 `master` 对应业务文件与 `refact-tmp` 空 handler，列出方法清单、所需 Repo / RPC / 配置 / MQ / Cron。
2. **Code**（顺序固定 Biz -> Data -> Service -> Server -> Wire）：
   - 在 UseCase 构造函数注入所需 Repo（替换「只有 logger」）。
   - Biz 填充业务逻辑，Repo 接口按需扩展。
   - Data 优先用生成 Repo；第三方调用统一封装到 `internal/data/rpc`。
   - Service 保持只透传。
   - 注入关系变化后执行 `make wire`。
3. **Quality**：`make wire` -> `gofmt` -> 目标包 `go test` -> `make build`，清理构建产物。

### 关键决策

- **DI 模式统一**：UseCase 构造函数显式接收 Repo 接口（如 `LearnConfigRepo`、`CommonRepo`），由 wire 注入。首个 change 确立该模式，后续 domain 套用。
- **第三方接口归属**：一律 `internal/data/rpc`；Biz 通过 Repo 接口间接调用。
- **生成物保护（禁止手改）**：`api/**/*.pb.go`、`api/**/*_http.pb.go`、`api/**/*_grpc.pb.go`、`api/**/*.pb.validate.go`、`doc/swagger/**/*.json`、`internal/data/gorm/**/*.gen.go`、`internal/data/gorm/**/*repo.go`、`cmd/devices-learn/wire_gen.go`。
- **常量归属**：`internal/data/constant`；缓存 Key 归属 `internal/data/cache/cachekey.go`。

### 风险与约束

- 迁移量大：按 domain 分批提交验证点，单批保证可编译、可启动、可回归。
- 第三方服务/测试环境可能阻塞端到端验证：阻塞时记录阻塞命令、错误摘要、已完成工件、未验证项、下一步。
- 若 `refact-tmp` Proto 与 `master` API 行为不一致：停在该 domain，确认是否允许改 proto 并执行 `make api`/`make protocode`。
- **TDD 约束**：本项目当前 `internal/biz` 等包测试基础设施需确认；首个 change 的第一个 task 为「搭建/确认测试基础设施」，后续 task 在其上按 RED-GREEN-REFACTOR 推进。

### 测试策略（Go profile）

- `test_single`：`go test ./internal/biz/... -run TestXxx -v`
- `test_all`：`go test ./... -cover`
- `build`：`make build`（输出 `bin/`，完成后清理多余产物）
- `lint`：`make lint`（golangci-lint）
- test_mapping：`foo.go` -> 同目录 `foo_test.go`
- 生成物豁免：`*.pb.go`、`*.gen.go`、`*repo.go` 等不要求测试

## Open Questions（供 Code Review 阶段补充）

- gRPC 注册是否为线上契约（当前 `internal/server/http.go` 仅注册 HTTP Gateway，是否需补 gRPC registration）。
- NPS 自定义下载路由、MQ consumer、Cron summary 在新框架 `internal/server/{cron,rabbitmq}.go` 的注册方式是否已就绪。
- 项目规则引用的 `docs/backend-coding-workflow.md` 在工作区缺失，迁移以 `backend-dev/SKILL.md` 与 Makefile target 为准。
