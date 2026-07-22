# Governance Specification

> 基线：当前实现（截至 2026-06）
> 参考：docs/architecture/diting-config.md、docs/architecture/diting-plugin-development.md

## Purpose

定义 observability-governance 插件及配置驱动的命令策略、输出与 diff 规模限制、脱敏与评测后策略行为。

## Requirements

### Requirement: CommandPolicyHooks
observability-governance 插件 SHALL 提供命令前策略（allow prefixes / block patterns）、命令后清理与可选 afterEval 评测后策略。

#### Scenario: BlockedCommandPattern
- **WHEN** 执行器即将运行匹配 block pattern 的命令
- **THEN** governance 插件 MUST 阻断并返回可读原因

### Requirement: AllowCommandPrefixes
当 `DITING_GOVERNANCE_ALLOW_COMMAND_PREFIXES` 非空时，系统 SHALL 仅允许命令 payload 匹配所列前缀之一（allowlist 语义）。

#### Scenario: AllowlistEnforced
- **WHEN** 配置了 allow prefixes 且命令不匹配任一前缀
- **THEN** 命令 MUST 被策略拒绝

### Requirement: BlockCommandPatterns
`DITING_GOVERNANCE_BLOCK_COMMAND_PATTERNS` SHALL 提供逗号分隔正则拦截列表；未配置时使用内置默认 block patterns。

#### Scenario: DefaultBlockPatterns
- **WHEN** 未设置 block patterns env
- **THEN** 使用内置默认正则参与拦截

### Requirement: OutputSizeLimits
系统 SHALL  enforce `DITING_GOVERNANCE_MAX_PROMPT_CHARS`（默认 16000）与 `DITING_GOVERNANCE_MAX_OUTPUT_CHARS`（默认 12000）限制命令载荷与 stdout/stderr 单段保留长度。

#### Scenario: TruncateLongOutput
- **WHEN** executor 输出超过 max output chars
- **THEN** 治理链路 MUST 截断或拒绝并记录原因

### Requirement: DiffScaleLimits
系统 SHALL 使用 `DITING_GOVERNANCE_MAX_FILES_CHANGED`（默认 20）与 `DITING_GOVERNANCE_MAX_DIFF_LINES`（默认 400）作为 diff 规模阈值参与风险判定。

#### Scenario: LargeDiffRisk
- **WHEN** 变更文件数超过阈值
- **THEN** quality/governance  MUST 反映 elevated risk 并可能触发 stop signal

### Requirement: SecretScanningRedaction
Governance 插件 MUST 提供 secret scanning 与 redaction hooks；脱敏 MUST NOT 破坏结构化数据的基本可读性。

#### Scenario: RedactSecretsInOutput
- **WHEN** executor stdout 含疑似密钥
- **THEN** 落盘日志经脱敏后写入 logs/

### Requirement: GovernanceRequiredForReadiness
environment、execution、observability-governance 三类插件健康是 readiness 必要条件；governance 缺失 MUST 导致 readiness 失败。

#### Scenario: ReadinessRequiresGovernance
- **WHEN** observability-governance 插件 unhealthy
- **THEN** GET `/api/readiness` 的 plugins 检查失败

## Technical Notes

- 实现：`apps/server/src/diting/plugins/governance.ts`、默认 observability-governance 插件
- 依赖：configuration、plugins、repair-loop
