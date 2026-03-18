# 条目格式

学习、错误、功能请求的 markdown 格式模板。示例见 `references/examples.md`。

## 学习条目

追加到 `.learnings/LEARNINGS.md`：

```markdown
## [LRN-YYYYMMDD-XXX] category

**Logged**: ISO-8601 时间戳
**Priority**: low | medium | high | critical
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config | workflow | task

### Summary

一行描述所学内容

### Details

完整上下文：发生了什么、哪里不对、正确做法

### Suggested Action

具体修复或改进建议

### Metadata

- Source: conversation | error | user_feedback
- Related Files: path/to/file.ext
- Tags: tag1, tag2
- See Also: LRN-20250110-001（若与已有条目相关）

---
```

## 错误条目

追加到 `.learnings/ERRORS.md`：

```markdown
## [ERR-YYYYMMDD-XXX] skill_or_command_name

**Logged**: ISO-8601 时间戳
**Priority**: high
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config | workflow | task

### Summary

简要描述失败内容

### Error
```

实际错误信息或输出

```

### Context

- 尝试的命令/操作
- 使用的输入或参数
- 相关环境信息

### Suggested Fix

若可识别，可能的解决方案

### Metadata

- Reproducible: yes | no | unknown
- Related Files: path/to/file.ext
- See Also: ERR-20250110-001（若为复现问题）

---
```

## 功能请求条目

追加到 `.learnings/FEATURE_REQUESTS.md`：

```markdown
## [FEAT-YYYYMMDD-XXX] capability_name

**Logged**: ISO-8601 时间戳
**Priority**: medium
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config | workflow | task

### Requested Capability

用户希望实现的能力

### User Context

为何需要、要解决的问题

### Complexity Estimate

simple | medium | complex

### Suggested Implementation

如何实现、可能扩展的方向

### Metadata

- Frequency: first_time | recurring
- Related Features: existing_feature_name

---
```

## ID 生成规则

格式：`TYPE-YYYYMMDD-XXX`

- TYPE：`LRN`（学习）、`ERR`（错误）、`FEAT`（功能）
- YYYYMMDD：当前日期
- XXX：序号或 3 位随机字符（如 `001`、`A7B`）

示例：`LRN-20250115-001`、`ERR-20250115-A3F`、`FEAT-20250115-002`

## 解决条目

问题修复后，更新条目：

1. 将 `**Status**: pending` 改为 `**Status**: resolved`
2. 在 Metadata 后添加解决说明：

```markdown
### Resolution

- **Resolved**: 2025-01-16T09:00:00Z
- **Commit/PR**: abc123 或 #42
- **Notes**: 简要描述所做修改
```

其他状态值：

- `in_progress` - 正在处理
- `wont_fix` - 决定不处理（在 Resolution 中说明原因）
- `promoted` - 已提升到 AGENTS.md
