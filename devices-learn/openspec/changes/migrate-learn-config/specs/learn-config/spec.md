# Spec Delta: learn-config

## ADDED Requirements

### Requirement: UseCase 依赖注入模式

`LearnConfigV1LearnConfigUseCase` SHALL 通过构造函数注入 `LearnConfigRepo` 与 `CommonRepo`（按需），由 wire 完成装配，不得在 UseCase 内部直接构造 Data 依赖。本要求作为整个迁移的 DI 基线模式。

#### Scenario: 构造 UseCase 时注入 Repo

- **WHEN** wire 装配 `LearnConfigV1LearnConfigUseCase`
- **THEN** 构造函数接收 `LearnConfigRepo` 接口实例与 `log.Logger`
- **AND** `make wire` 生成的 `wire_gen.go` 编译通过

### Requirement: 学习配置 CSV 解析

系统 SHALL 提供 `ParseLearnConfigCsvFile`，从给定 CSV 文件 URL 读取内容并解析为结构化数据，且对标题与数据进行严格校验。

#### Scenario: 合法 CSV 解析成功

- **WHEN** 传入的 CSV 标题列均为 `名称|字段名|类型` 三段格式且类型为 `string` 或 `number`
- **THEN** 返回每行数据的结构化列表
- **AND** `number` 类型字段解析为数值，空值记为 `0`；`string` 类型字段去除首尾空格

#### Scenario: 文件为空或格式非法时报错

- **WHEN** CSV 内容行数 ≤ 1、包含空行/换行符、标题不满足三段格式、或类型非 `string`/`number`、或数据列数与标题不一致
- **THEN** 返回对应中文错误信息，不返回数据

### Requirement: 学习配置保存

系统 SHALL 提供 `StoreLearnConfig`，先解析 `fileUrl` 指向的 CSV，再按 `id` 是否为空执行新增或更新。

#### Scenario: id 为空时新增

- **WHEN** 请求 `id` 为空
- **THEN** 以解析后的数据创建一条学习配置，初始状态为启用，返回新记录 `id`

#### Scenario: id 非空时更新

- **WHEN** 请求 `id` 非空且记录存在
- **THEN** 更新该记录的 key/description/fileUrl/updatedBy/data，返回记录 `id`

#### Scenario: id 非空但记录不存在

- **WHEN** 请求 `id` 非空但查询不到对应记录
- **THEN** 返回「数据不存在」错误

### Requirement: 学习配置列表分页查询

系统 SHALL 提供 `QueryLearnConfigListShadow`，按 `updatedAt desc` 排序分页返回学习配置列表及总数。

#### Scenario: 分页参数规整

- **WHEN** `pageSize < 0` 或 `pageSize > 1000`
- **THEN** `pageSize` 重置为 100；`page >= 1` 时按 `pageSize * (page-1)` 计算 offset

#### Scenario: 返回列表与总数

- **WHEN** 查询成功
- **THEN** 返回总数 `total` 与解析后的配置列表（每项含 id/key/description/fileUrl/data/status/时间字段）

### Requirement: 按 key 查询学习配置

系统 SHALL 提供 `QueryLearnConfigByKey`，按 key 列表返回对应配置，并优先走本地缓存与 Redis 缓存。

#### Scenario: 命中缓存

- **WHEN** 请求 key 在本地缓存或 Redis 缓存中存在
- **THEN** 直接返回缓存中的 `LearnConfigItem`，不查数据库

#### Scenario: 缓存未命中回源

- **WHEN** 缓存未命中
- **THEN** 从数据库按 key 查询启用状态的配置，回填缓存后返回

### Requirement: 学习配置状态变更

系统 SHALL 提供 `UpdateLearnConfigStatus`，按 `id` 更新配置状态。

#### Scenario: 更新状态成功

- **WHEN** 传入合法 `id` 与 `status`（-1 删除 / 1 启用）
- **THEN** 更新该记录状态并清理相关缓存，返回 `isSucceed = true`
