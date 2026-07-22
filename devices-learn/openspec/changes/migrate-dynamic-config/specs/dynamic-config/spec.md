# Spec Delta: dynamic-config

## ADDED Requirements

### Requirement: 动态学习配置管理

系统 SHALL 实现 dynamic_learn_config 的批量创建、设备侧列表查询、后台 shadow 列表查询、保存与状态变更，行为与 `master` 一致。

#### Scenario: 后台 shadow 列表查询

- **WHEN** 调用 `QueryDynamicLearnConfigShadowList` 并传入分页参数
- **THEN** 返回完整配置列表与总数（含未启用项），供后台管理使用

#### Scenario: 设备侧列表查询

- **WHEN** 调用 `QueryDynamicLearnConfigListApi`
- **THEN** 仅返回启用状态的配置，按业务规则过滤/排序

#### Scenario: 批量创建与保存

- **WHEN** 调用 `BatchCreateDynamicLearnConfig` 或 `StoreDynamicLearnConfig`
- **THEN** 按 id 空/非空新增或更新记录，并清理相关缓存

#### Scenario: 状态变更

- **WHEN** 调用 `UpdateDynamicLearnConfigStatus`
- **THEN** 更新指定记录状态并清理缓存

### Requirement: 动态功能配置管理

系统 SHALL 实现 dynamic_function_config 的设备侧/后台列表查询、保存与状态变更，行为与 `master` 一致。

#### Scenario: 列表查询区分 api 与 shadow

- **WHEN** 调用 `QueryDynamicFunctionConfigListApi` 或 `QueryDynamicFunctionConfigListShadow`
- **THEN** api 仅返回启用项、shadow 返回全部并带分页总数

#### Scenario: 保存与状态变更

- **WHEN** 调用 `StoreDynamicFunctionConfig` 或 `UpdateDynamicFunctionConfigStatus`
- **THEN** 新增/更新或变更状态，并清理相关缓存

### Requirement: 动态 Dock 配置管理（v1 与 v2）

系统 SHALL 实现 dynamic_dock_config v1 与 v2 两套接口的列表查询、保存与状态变更，v1/v2 行为分别与 `master` 对应版本一致。

#### Scenario: v1 与 v2 接口并存

- **WHEN** 分别调用 v1（`QueryDynamicDockConfigListApi` 等）与 v2（`QueryDynamicDockConfigListApiV2` 等）
- **THEN** 各自走对应版本逻辑与 Repo（v2 使用 `DynamicDockConfigV2Repo`），互不影响

#### Scenario: 后台 shadow 与设备侧 api 区分

- **WHEN** 调用 shadow 列表与 api 列表
- **THEN** shadow 返回全部并分页、api 仅返回启用项

#### Scenario: 保存与状态变更

- **WHEN** 调用 `StoreDynamicDockConfig(V2)` 或 `UpdateDynamicDockConfigStatus(V2)`
- **THEN** 新增/更新或变更状态，并清理相关缓存
