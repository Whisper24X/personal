# Spec Delta: style-target-task

## ADDED Requirements

### Requirement: 用户学习风格

系统 SHALL 实现用户学习风格的创建、查询与风格测评问卷获取，行为与 `master` 一致。

#### Scenario: 创建学习风格并触发任务完成

- **WHEN** 调用 `CreateUserStyle` 成功保存用户学习风格
- **THEN** 通过 `internal/data/rpc` 封装的任务系统接口触发对应任务完成
- **AND** 任务系统调用失败不影响风格保存结果（按 master 容错策略）

#### Scenario: 查询用户风格与问卷

- **WHEN** 调用 `GetUserStyle` 或 `GetLearnStylePaper`
- **THEN** 返回用户已选风格或风格测评问卷内容

### Requirement: 用户学习目标

系统 SHALL 实现用户学习目标的创建、查询与学科总分查询，行为与 `master` 一致。

#### Scenario: 创建学习目标并触发任务完成

- **WHEN** 调用 `CreateUserLearnTarget` 成功保存学习目标
- **THEN** 通过 `internal/data/rpc` 触发对应任务完成（容错同上）

#### Scenario: 查询目标与学科总分

- **WHEN** 调用 `GetUserLearnTarget` 或 `GetSchoolScoresTotalSubject`
- **THEN** 返回用户学习目标或学校学科总分数据

### Requirement: 学习任务

系统 SHALL 实现任务列表、任务完成与任务奖励接口，第三方任务系统调用统一经 `internal/data/rpc`。

#### Scenario: 任务列表与奖励

- **WHEN** 调用 `TaskListApi` 或 `TaskReward`
- **THEN** 经 rpc 层调用任务系统返回任务列表或发放奖励结果

#### Scenario: 任务完成

- **WHEN** 调用 `TaskFinish`
- **THEN** 经 rpc 层标记任务完成并返回结果
