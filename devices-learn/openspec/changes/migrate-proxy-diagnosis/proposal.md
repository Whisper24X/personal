# Proposal: migrate-proxy-diagnosis

## Why

`user`、`desktop`、`course_learn`、`diagnosis` 四组接口多为无表 / 聚合 / 代理查询，依赖其他后端服务。`refact-tmp` 仅有空 handler，且对应的外部服务 Data repo 在新框架尚未恢复。需按 master 业务补齐，并把外部调用统一收敛到 `internal/data/rpc`。

## What Changes

- User：`QueryIfUserCanRenewal`、`QueryScholarBasicInfo`。
- Desktop：`QueryDailyData`。
- CourseLearn：`GetTopicFinishedByCvsIds`、`GetTopicScoreByIds`。
- Diagnosis：`DiagnosisCvsList`、`DiagnosisSchoolYearList`、`GetTextbookIdsBySchoolYear`、`GetUserSelectTextbookLast`、`UserExamFinishNotice`、`UserExamResultReport`、`UserSelectExamFinishInfo`、`UserSelectExamInfo`、`UserSelectExamRedo`、`UserSelectTextbookReport`。
- 新增/恢复对应 Data repo（User、Desktop、Topic/CourseLearn、Diagnosis、ProblemChange），外部服务调用全部封装在 `internal/data/rpc`。
- UseCase 注入对应 Repo 接口；Biz 只依赖接口。`make wire`。

## Impact

- Affected specs: `proxy-diagnosis`
- Affected code: `internal/biz/user_v1_*`、`desktop_v1_*`、`courselearn_v1_*`、`diagnosis_v1_*`、新增 `internal/data/*.go` 聚合 repo、`internal/data/rpc/*`、`wire_gen.go`（生成）。
- 不改动 schema/proto/API 契约与生成物。
- 行为蓝本：`master:internal/biz/{user,desktop,course_learn,diagnosis}.go`、`master:internal/data/diagnosis.go` 等与 `internal/data/rpc/*`。
