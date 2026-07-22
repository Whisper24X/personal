# Configuration Delta

## MODIFIED Requirements

### Requirement: ExternalPluginPackageEnv
各 `DITING_PLUGIN_*_PACKAGE` 或 `TITING_PLUGIN_*_PACKAGE` 环境变量非空时，宿主 MUST 对该 kind 执行整类外置替换；为空时 MUST 保留该 kind 全部内置插件。

#### Scenario: CompletionGateExternalReplace
- **WHEN** `TITING_PLUGIN_COMPLETION_GATE_PACKAGE` 非空
- **THEN** 宿主对 completion-gate kind 执行整类外置替换
- **AND** 内置 OpenSpec completion gate 不再注册

## ADDED Requirements

### Requirement: CompletionGatePackageEnv
系统 SHALL 支持 `TITING_PLUGIN_COMPLETION_GATE_PACKAGE` 配置外置 completion-gate 插件包；未配置时使用内置 OpenSpec completion gate。

#### Scenario: DefaultCompletionGatePackage
- **WHEN** 未设置 `TITING_PLUGIN_COMPLETION_GATE_PACKAGE`
- **THEN** 配置中的 `plugins.completionGate.packageName` 为 null
- **AND** 宿主注册内置 `openspec-completion-gate`

#### Scenario: ReadCompletionGatePackage
- **WHEN** 设置 `TITING_PLUGIN_COMPLETION_GATE_PACKAGE=example-package`
- **THEN** 配置中的 `plugins.completionGate.packageName` 为 `example-package`
