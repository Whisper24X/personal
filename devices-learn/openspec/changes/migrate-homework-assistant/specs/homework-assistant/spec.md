# Spec Delta: homework-assistant

## ADDED Requirements

### Requirement: 搜题

系统 SHALL 实现拍照/文本搜题、推荐题目搜索、异步批量搜题与搜题设备注册，第三方搜索/资源服务经 `internal/data/rpc`，行为与 `master` 一致。

#### Scenario: 同步搜题

- **WHEN** 调用 `SearchQuestion` 或 `QueryRecommendTopicsSearch`
- **THEN** 经 rpc 层调用题目搜索服务，返回搜题结果并落搜题记录

#### Scenario: 异步批量搜题

- **WHEN** 调用 `BatchSearchQuestionAsync`
- **THEN** 创建异步任务并立即返回任务标识，后台完成批量搜题

#### Scenario: 设备注册

- **WHEN** 调用 `RegisterSearchDevices`
- **THEN** 注册/更新搜题设备信息

### Requirement: 整页批改

系统 SHALL 实现整页批改、批改详情查询与批改结果更新，批改依赖 TAL/OpenAI 与 OSS，经 `internal/data/rpc`，行为与 `master` 一致。

#### Scenario: 发起整页批改

- **WHEN** 调用 `HomeworkFullPageCorrection`
- **THEN** 上传/读取 OSS 资源并调用批改服务，返回批改结果或任务标识

#### Scenario: 查询与更新批改结果

- **WHEN** 调用 `QueryHomeworkFullPageCorrectionDetailById` 或 `UpdateQuestionCorrectionResult`
- **THEN** 返回批改详情或更新指定题目批改结果

### Requirement: 记录与报告查询

系统 SHALL 实现搜题/批改记录、报告与错题统计查询，行为与 `master` 一致。

#### Scenario: 记录与结果查询

- **WHEN** 调用 `QuerySearchRecordList`、`QuerySearchResultById`、`QueryCorrectionRecordList`
- **THEN** 返回分页记录或单条结果

#### Scenario: 报告与错题统计

- **WHEN** 调用 `QueryHomeworkAssistantReport`、`QueryHomeworkTaskWrongQuestionCount`、`QueryHomeworkTaskWrongQuestionRectificationInfo`
- **THEN** 返回报告与错题数量/订正信息

### Requirement: 错题订正与分数排行

系统 SHALL 实现错题订正信息存储、订正分数、任务分数存储与分数排行查询，排行支持 Cron 生成，行为与 `master` 一致。

#### Scenario: 错题订正存储

- **WHEN** 调用 `StoreWrongQuestionRectificationInfo` 或 `StoreHomeworkAssistantRectificationScore`
- **THEN** 持久化订正信息与订正分数

#### Scenario: 任务分数与排行查询

- **WHEN** 调用 `StoreHomeworkAssistantTaskScore` 或 `QueryHomeworkAssistantScoreRankList`
- **THEN** 存储任务分数或返回分数排行榜

#### Scenario: 排行生成（接口与 Cron）

- **WHEN** 调用 `GenerateRankList` 或排行 Cron 到点执行
- **THEN** 生成并持久化分数排行榜数据
