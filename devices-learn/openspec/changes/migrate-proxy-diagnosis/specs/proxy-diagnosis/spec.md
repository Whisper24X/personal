# Spec Delta: proxy-diagnosis

## ADDED Requirements

### Requirement: 用户信息代理查询

系统 SHALL 实现用户续费资格与学情基础信息查询，外部依赖经 `internal/data/rpc`，行为与 `master` 一致。

#### Scenario: 查询续费资格与学情信息

- **WHEN** 调用 `QueryIfUserCanRenewal` 或 `QueryScholarBasicInfo`
- **THEN** 经 rpc 层聚合外部服务结果并返回；外部失败时按 master 错误策略返回

### Requirement: 桌面每日数据

系统 SHALL 实现 `QueryDailyData`，聚合返回设备桌面每日数据，行为与 `master` 一致。

#### Scenario: 查询每日数据

- **WHEN** 调用 `QueryDailyData`
- **THEN** 经 rpc/Repo 聚合返回当日数据

### Requirement: 课程学习数据查询

系统 SHALL 实现按 cvsIds 查询完成情况与按 ids 查询成绩，行为与 `master` 一致。

#### Scenario: 完成情况与成绩查询

- **WHEN** 调用 `GetTopicFinishedByCvsIds` 或 `GetTopicScoreByIds`
- **THEN** 经 rpc 层向题库/课程后端查询并返回结果

### Requirement: 诊断业务查询与回调

系统 SHALL 实现诊断相关的列表、教材、考试选择与结果上报等接口，外部依赖经 `internal/data/rpc`，行为与 `master` 一致。

#### Scenario: 诊断列表与教材查询

- **WHEN** 调用 `DiagnosisCvsList`、`DiagnosisSchoolYearList`、`GetTextbookIdsBySchoolYear`、`GetUserSelectTextbookLast`
- **THEN** 返回对应诊断/教材数据

#### Scenario: 考试选择、重做与信息查询

- **WHEN** 调用 `UserSelectExamInfo`、`UserSelectExamFinishInfo`、`UserSelectExamRedo`、`UserSelectTextbookReport`
- **THEN** 返回考试选择/完成/重做/报告数据

#### Scenario: 考试完成通知与结果上报

- **WHEN** 调用 `UserExamFinishNotice` 或 `UserExamResultReport`
- **THEN** 经 rpc 层处理通知/上报并返回结果
