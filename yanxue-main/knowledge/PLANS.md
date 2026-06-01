# 执行计划

## 何时创建变更提案

当请求涉及以下情况时，应打开 `@/openspec/AGENTS.md` 并创建变更提案：

- 提及 planning、proposal、spec、change、plan
- 引入新能力、破坏性变更、架构调整
- 重大性能或安全相关改动
- 需求不清晰，需要权威规范再编码

### 跳过提案的情况

- Bug 修复（恢复预期行为）
- 拼写、格式、注释
- 非破坏性依赖更新
- 配置变更
- 为现有行为补充测试

---

## 三阶段工作流

### Stage 1: 创建变更

1. 查阅 `openspec/project.md`、`openspec list`、`openspec list --specs`
2. 选择唯一的 verb-led `change-id`（kebab-case）
3. 在 `openspec/changes/<id>/` 下创建 `proposal.md`、`tasks.md`、可选 `design.md`、spec deltas
4. 使用 `## ADDED|MODIFIED|REMOVED Requirements`，每个 requirement 至少一个 `#### Scenario:`
5. 执行 `openspec validate <id> --strict --no-interactive` 并修复问题

### Stage 2: 实施变更

1. 阅读 proposal.md
2. 阅读 design.md（如存在）
3. 阅读 tasks.md
4. 按顺序完成任务
5. 全部完成后将 tasks.md 中项标记为 `- [x]`
6. **审批通过前不开始实施**

### Stage 3: 归档变更

部署后单独 PR：

- 将 `changes/[name]/` 移至 `changes/archive/YYYY-MM-DD-[name]/`
- 更新 `specs/`（如有能力变更）
- 执行 `openspec archive <change-id> --yes`
- 执行 `openspec validate --strict --no-interactive`

---

## 实施前检查清单

- [ ] 阅读 `specs/[capability]/spec.md`
- [ ] 检查 `changes/` 中待办变更是否有冲突
- [ ] 阅读 `openspec/project.md`
- [ ] 执行 `openspec list` 查看活跃变更
- [ ] 执行 `openspec list --specs` 查看现有能力

---

## 常用命令

```bash
openspec list                  # 列出活跃变更
openspec list --specs          # 列出规范
openspec show [item]           # 查看详情
openspec validate [item]       # 校验
openspec archive <change-id> --yes  # 归档
```

---

## 完整流程

详见 [openspec/AGENTS.md](../openspec/AGENTS.md)。
