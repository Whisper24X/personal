# Spec Delta: nps

## ADDED Requirements

### Requirement: NPS 弹窗与提交

系统 SHALL 实现 NPS 弹窗规则判定与答案提交，行为与 `master` 一致。

#### Scenario: 获取弹窗

- **WHEN** 调用 `GetNpsPopup`
- **THEN** 按设备/用户/场景命中规则返回是否弹窗及弹窗内容

#### Scenario: 提交答案

- **WHEN** 调用 `SubmitNpsAnswer`
- **THEN** 持久化用户 NPS 答案，并按 master 逻辑更新场景计数 / 触发后续流程

### Requirement: NPS 列表与多维度统计

系统 SHALL 实现 NPS 后台列表与趋势、词云、用户/设备/版本维度统计查询，行为与 `master` 一致。

#### Scenario: 列表与趋势

- **WHEN** 调用 `ListNpsShadow`、`GetNpsTrendListShadow`、`GetStageNpsTrendListShadow`
- **THEN** 返回分页列表与趋势数据

#### Scenario: 词云与多维度分布

- **WHEN** 调用 `GetNpsWordCloudShadow`、`GetNpsDeepUseUserListShadow`、`GetNpsNewOldUserListShadow`、`GetNpsModelDeviceListShadow`、`GetNpsDesktopVersionListShadow`、`GetNpsOnionVersionListShadow`
- **THEN** 返回对应维度统计结果

### Requirement: NPS 汇总生成

系统 SHALL 实现 NPS 汇总生成，支持接口触发与定时任务触发，行为与 `master` 一致。

#### Scenario: 接口触发汇总

- **WHEN** 调用 `GenerateNpsSummaryShadow`
- **THEN** 生成并持久化 NPS 汇总数据

#### Scenario: 定时任务触发汇总

- **WHEN** Cron summary 任务到点执行
- **THEN** 调用汇总逻辑生成汇总数据

### Requirement: NPS 异步与下载链路

系统 SHALL 恢复 NPS MQ consumer 与自定义下载路由，并纳入服务运行。

#### Scenario: MQ consumer 运行

- **WHEN** 服务启动
- **THEN** NPS MQ consumer 注册并消费对应消息，Cron/RabbitMQ server 纳入 Kratos app server 列表

#### Scenario: 下载路由可用

- **WHEN** 访问 NPS 下载自定义路由
- **THEN** 返回导出文件（如 master 提供该能力）
