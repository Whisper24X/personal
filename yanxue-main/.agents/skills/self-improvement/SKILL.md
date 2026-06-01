---
name: self-improvement
description: '记录学习、错误与修正，支持持续改进。适用于：(1) 命令或操作意外失败，(2) 用户纠正（如「不对」「其实是」），(3) 用户请求尚不支持的能力，(4) 外部 API 或工具失败，(5) 发现知识过时或错误，(6) 发现更优的重复任务做法。重大任务前请查阅学习记录。'
---

# 自我改进 Skill

将学习与错误记录到 markdown 文件，支持持续改进。后续可由编码 Agent 处理为修复，重要学习可提升为项目记忆。

> 条目格式见 `references/entry-formats.md`，示例见 `references/examples.md`。

## 使用原则

**何时必须记录**：用户纠正、命令或工具失败、发现知识过时或更优做法时，写入对应文件并附足上下文与 Suggested Action。

**何时可跳过**：一次性且已当场解决、无复现价值的临时问题；与已有条目完全重复且无新信息（用 See Also 关联）；纯主观偏好且不涉及正确性。

## 任务前查阅协议

**何时执行**：多步骤或高影响任务前；进入有历史问题记录的领域时。

1. **扫描 pending 数量**：`grep -c "Status.*pending" .learnings/*.md`
2. **按当前领域过滤**：`grep -l "Area.*<area>" .learnings/*.md`
3. **阅读 high/critical 的 pending 条目**：在开工前应用已知修复或规避已知陷阱

或使用脚本：`./skills/self-improvement/scripts/summary-learnings.sh [LEARNINGS_DIR]`

**定期节奏**：活跃开发期间每周做状态更新、解决与提升。

## 6 场景行动协议

### 场景 1：命令/操作意外失败

- **触发**：非零退出码、异常、超时、非预期输出
- **即时动作**：原样捕获错误输出；评估严重性（阻塞 vs 非阻塞）
- **记录**：`.learnings/ERRORS.md`（**强制**，必须在重试或报告失败之前记录）
- **后续**：若阻塞则尝试修复；若为重复问题（检查 See Also），升级优先级

### 场景 2：用户纠正

- **触发**：关键词「不对」「其实是」「你搞错了」「Actually...」「You're wrong about...」等
- **即时动作**：确认纠正，先将修正应用到当前任务
- **记录**：`.learnings/LEARNINGS.md` 类别 `correction`，优先级取决于影响范围
- **后续**：若涉及项目级约定，考虑立即提升到 AGENTS.md

### 场景 3：用户请求尚不支持的能力

- **触发**：关键词「能不能」「可以加一个」「Why can't you...」「Can you also...」等
- **即时动作**：确认，评估是否存在变通方案
- **记录**：`.learnings/FEATURE_REQUESTS.md`，附复杂度估算和变通方案（若有）
- **后续**：若为 recurring（检查 Frequency），提升优先级

### 场景 4：外部 API 或工具失败

- **触发**：HTTP 错误、外部服务超时、认证失败、速率限制
- **即时动作**：与本地错误区分；判断瞬态（重试一次）还是持久性错误
- **记录**：`.learnings/ERRORS.md`，附集成细节（端点、认证方式、速率限制信息）
- **后续**：瞬态 → 记录重试策略；持久性 → 记录降级方案或替代方案

### 场景 5：发现知识过时或错误

- **触发**：文档与现实矛盾、API 行为与预期不符、用户提供未知信息
- **即时动作**：向当前源（代码、API、文档）验证
- **记录**：`.learnings/LEARNINGS.md` 类别 `knowledge_gap`，包含新旧信息对比
- **后续**：若影响文档级别则更新相关文档；若广泛适用则提升到 AGENTS.md

### 场景 6：发现更优的重复任务做法

- **触发信号**：可自动化的手动步骤；可抽象的重复代码模式；调查中发现的性能优化；发现更简方案
- **即时动作**：记录对比（旧做法 vs 新做法，附理由）
- **记录**：`.learnings/LEARNINGS.md` 类别 `best_practice`，包含 before/after 对比
- **后续**：若适用于 >1 个文件/功能，提升到 AGENTS.md 或提取为 skill

## ainative 工作流集成

`.learnings/` 位于 workspace 根目录。

- **日常记录**：读写当前 workspace 根目录的 `<workspace_root>/.learnings/`（如 ainative-workspace/.learnings/）
- **Skill 目录下的 .learnings**：`skills/self-improvement/.learnings/` 仅作格式参考，不作为日常记录目标
- **提升目标**：AGENTS.md（workspace 根目录）

### CLI 对话场景

当 CLI 修改任务中收到包含纠正/功能请求触发词的用户输入时，**必须在完成主任务后**将纠正/请求记录到 `.learnings/`。触发词见 `references/ainative-triggers.md`。

## 提升到项目记忆

当学习可广泛适用（非一次性修复）时，提升为永久项目记忆。

- **何时提升**：适用于多个文件/功能；任何贡献者都应了解；可避免重复错误
- **如何提升**：提炼为简洁规则 → 添加到 AGENTS.md 合适章节 → 更新原条目 `Status: promoted`、`Promoted: AGENTS.md`

示例见 `references/examples.md`。

## 重复模式检测

1. **先搜索**：`grep -r "keyword" .learnings/`
2. **关联条目**：在 Metadata 中添加 `**See Also**: ERR-20250110-001`
3. **提高优先级**：若问题反复出现
4. **考虑系统性修复**：文档缺失 → 提升到 AGENTS.md；自动化缺失 → 添加到 AGENTS.md

## 优先级与领域

| 优先级     | 适用场景                             |
| ---------- | ------------------------------------ |
| `critical` | 阻塞核心功能、数据丢失风险、安全问题 |
| `high`     | 影响大、影响常用流程、反复出现       |
| `medium`   | 中等影响、有变通方案                 |
| `low`      | 小问题、边缘情况、锦上添花           |

| Area       | 范围                               |
| ---------- | ---------------------------------- |
| `frontend` | UI、组件、客户端代码               |
| `backend`  | API、服务、服务端代码              |
| `infra`    | CI/CD、部署、Docker、云            |
| `tests`    | 测试文件、测试工具、覆盖率         |
| `docs`     | 文档、注释、README                 |
| `config`   | 配置文件、环境、设置               |
| `workflow` | 工作流步骤、角色、动作（ainative） |
| `task`     | 任务拆解、子任务执行（ainative）   |

## 最佳实践

1. **立即记录** - 问题刚发生时上下文最完整
2. **具体明确** - 后续 Agent 需快速理解
3. **包含复现步骤** - 尤其是错误
4. **关联相关文件** - 便于修复
5. **给出具体修复建议** - 而非仅「调查」
6. **积极提升** - 有疑问就加入 AGENTS.md

## Gitignore 选项

- **本地保留**：`.learnings/` 加入 .gitignore
- **团队共享**：不加入 .gitignore
- **混合**：`.learnings/*.md` 忽略，`!.learnings/.gitkeep` 保留

## 自动 Skill 提取

当学习满足 Recurring、Verified、Non-obvious、Broadly applicable 或 User-flagged 时，可提取为 skill。

1. 识别候选
2. 运行 `./skills/self-improvement/scripts/extract-skill.sh skill-name --dry-run` 预览
3. 执行 `SKILLS_DIR=./skills ./skills/self-improvement/scripts/extract-skill.sh skill-name`
4. 完善 SKILL.md，使用 `assets/SKILL-TEMPLATE.md`
5. 更新学习条目：`Status: promoted_to_skill`，`Skill-Path: skills/<name>`

提取前确认：方案已测试、描述脱离上下文仍清晰、代码示例自包含、无项目专属硬编码、符合命名规范（小写、连字符）。
