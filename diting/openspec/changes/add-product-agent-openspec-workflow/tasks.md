## 1. 契约与测试基线

- [x] 1.1 为 `AgentKind=product`、`driverId=openspec-product`、product metadata、review metadata 与 handoff artifact 补 plugin-api 类型。
- [x] 1.2 为 product/programming agent kind 分派、product preflight 缺附件不阻断、programming 缺 approved OpenSpec 阻断写失败测试。
- [x] 1.3 为 Meegle OpenSpec review 前缀门禁、review issue 创建/复用/查询、unprefixed reply 不推进写失败测试。
- [x] 1.4 为 workspace bootstrap、legacy spec import、approved workspace restore 写环境插件测试。

## 2. Agent 调度泛化

- [x] 2.1 泛化 `ServiceAgentWorkerPool`，按 agent kind 查找 queued task 并 claim 匹配 agent。
- [x] 2.2 支持 seed `product-agent-*`，并保留现有 `programming-agent-*` 与 legacy codex/cursor 兼容行为。
- [x] 2.3 将 agent plugin selection 从 executor capability 演进为 `agentKind`、`driverId`、`runtimeProviderId`、capability 组合选择。
- [x] 2.4 更新 execution/run/log 记录，确保 product task 记录 `agentKind=product`、`driverId=openspec-product` 与 runtime provider。

## 3. Workspace-first 同步与预检

- [x] 3.1 实现 `openspecSourceState` 归一化：none、legacy_attachment、draft_workspace、review_pending、changes_requested、approved_workspace、invalid。
- [x] 3.2 将 task preflight 拆为 intake、product workspace、legacy import、programming 四层规则。
- [x] 3.3 修改 Meegle sync/ingest：无 spec 附件时创建或恢复 product task，而不是 blocked。
- [x] 3.4 修改 legacy spec 附件路径：仅 legacy_attachment 模式校验附件类型、大小、zip-slip 与根级 `openspec/`。

## 4. Environment 与 Product workspace

- [x] 4.1 实现 `bootstrap_product_workspace`：创建 workspace、写 `task.md`、准备 repos、初始化或允许生成 `openspec/`。
- [x] 4.2 实现 `import_legacy_spec`：将现有 spec 附件导入 product workspace 并记录 metadata。
- [x] 4.3 实现 `restore_workspace`：programming task 按 `workspaceId` 复用 approved workspace。
- [x] 4.4 调整 cleanup 策略：product task 等待 review 时保留 workspace，workspace 丢失时 fail closed。

## 5. ProductSpecDriver 与 runtime provider

- [x] 5.1 新增 ProductSpecDriver，定义 context normalize、OpenSpec draft、self review、validate/repair、review package 节点。
- [x] 5.2 接入 Codex/Cursor product runtime provider，cwd 固定 workspace root，prompt 约束只产出 OpenSpec/审核 artifact。
- [x] 5.3 运行等价 OpenSpec 结构校验并将结果写入 `artifacts/openspec-validation.json`；Agent 非交互环境不直接执行 OpenSpec CLI。
- [x] 5.4 product driver 成功后写 `artifacts/product-review.md` 与 Meegle review payload，并将 task 转入 `needs_human`。

## 6. Meegle OpenSpec review 闭环

- [x] 6.1 扩展 task-integration 契约，新增 OpenSpec review issue 创建/复用/查询能力。
- [x] 6.2 实现 Meegle OpenSpec review adapter，支持 `【评审通过】`、`【需要修改】`、`【废弃】` 前缀解析。
- [x] 6.3 将 review 状态写入 HumanReview 与 task metadata，unprefixed reply 只记录不推进。
- [x] 6.4 review 能力不可用或创建/读取失败时 fail closed，禁止进入 programming 开发阶段。

## 7. Approved handoff 到开发链路

- [x] 7.1 审核通过后锁定 approved revision，写入 `artifacts/handoff.json`。
- [x] 7.2 将当前 task 切换为 `agentKind=programming`，并写入 `sourceProductTaskId`、`workspaceId`、`openspecChangeId`。
- [x] 7.3 programming task 执行前校验 approved OpenSpec 与 workspace restore，缺失时 blocked。
- [x] 7.4 确保 programming task 继续使用既有 completion gate、quality、repair loop 与 PR 流程。

## 8. UI、配置与文档

- [x] 8.1 增加 product agent count、review gate、workspace restore、legacy attachment compatibility 相关配置读取与文档。
- [x] 8.2 Web 控制台展示 product task、OpenSpec review 状态、approved handoff 与 workspace restore 诊断信息。
- [x] 8.3 同步更新 docs/architecture、README 和 dev-spec 中受影响的叙事文档。
- [x] 8.4 增加 diagnose/task 输出，区分 product review needs_human 与 programming repair needs_human。

## 9. 验证

- [x] 9.1 完成 OpenSpec delta spec 手动严格格式检查；该 workspace 的 active change 位于 `changes/` 且 OpenSpec CLI 需由用户终端执行。
- [x] 9.2 运行 `npm test -- --runInBand`。
- [x] 9.3 运行 `npm run type-check`。
- [x] 9.4 运行 `npm run build`。
