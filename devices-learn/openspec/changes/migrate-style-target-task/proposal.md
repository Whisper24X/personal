# Proposal: migrate-style-target-task

## Why

`style`、`target`、`task` 三组接口在 `refact-tmp` 仅有空 handler。其中 style/target 依赖本地表，task 涉及第三方任务系统调用，且 `master` 中「创建学习风格/目标后触发任务完成」存在跨 domain 联动副作用。需按 master 业务全量补齐。

## What Changes

- Style：`CreateUserStyle`、`GetUserStyle`、`GetLearnStylePaper`。
- Target：`CreateUserLearnTarget`、`GetUserLearnTarget`、`GetSchoolScoresTotalSubject`。
- Task：`TaskFinish`、`TaskListApi`、`TaskReward`。
- UseCase 注入 `UserLearnStyleRepo`、`UserLearnTargetRepo` 及 Task 相关 Repo。
- **第三方任务系统接口统一封装到 `internal/data/rpc`**，由 `internal/data` 的 Task Repo 组合调用；Biz 仅依赖接口。
- 保留 master 中「创建 style/target 成功后调用 task 完成」的副作用，落在 Biz 编排层。`make wire`。

## Impact

- Affected specs: `style-target-task`
- Affected code: `internal/biz/style_v1_*`、`internal/biz/target_v1_*`、`internal/biz/task_v1_*`、`internal/data/userlearnstyle.go`、`userlearntarget.go`、新增/恢复 Task data repo、`internal/data/rpc/*`（第三方）、`wire_gen.go`（生成）。
- 不改动 schema/proto/API 契约与生成物。
- 行为蓝本：`master:internal/biz/style.go`、`target.go`、`task.go` 与 `master:internal/data/*`、`internal/data/rpc/*`。
