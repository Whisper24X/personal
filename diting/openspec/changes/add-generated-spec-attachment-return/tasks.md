## 1. Plugin API

- [x] 1.1 为 OpenSpec review request 增加 `openspecPath` 本地绝对路径字段。
- [x] 1.2 移除 generated OpenSpec archive 上传契约和上传请求/响应类型。
- [x] 1.3 确保插件不再暴露 `uploadGeneratedSpecAttachment` 能力。

## 2. Core Product Workflow

- [x] 2.1 写测试证明 `openspecSourceState=none` 的 product task 在 review request 中携带 `openspecPath`。
- [x] 2.2 写测试证明 legacy `spec文档` 附件路径仍可创建 review，且不触发 generated upload。
- [x] 2.3 删除确定性 `openspec-<change-id>.zip` 打包函数和相关 helper。
- [x] 2.4 在创建或复用 OpenSpec review 前计算 `workspaceId/openspec/changes/<changeId>`。
- [x] 2.5 持久化 `openSpecReview.openspecPath` metadata，并在 HumanReview/日志中包含该路径。
- [x] 2.6 approval handoff 对无附件生成路径校验 `openspecPath`，缺失时 fail closed。

## 3. Meegle Integration

- [x] 3.1 增加 Meegle adapter 测试：OpenSpec review 子任务描述包含 `openspecPath`。
- [x] 3.2 删除 Meegle archive 上传实现和仅供上传使用的 helper。
- [x] 3.3 创建 review 子任务时展示 `OpenSpec 文档绝对路径` 和审核文件提示。
- [x] 3.4 保留 legacy `spec文档` 读取逻辑，不对用户附件做写回或替换。

## 4. Review And Visibility

- [x] 4.1 OpenSpec review payload 包含 generated OpenSpec 本地绝对路径。
- [x] 4.2 产品任务诊断展示 `openspecPath`。
- [x] 4.3 更新 product-agent 使用文档，说明无附件生成后会在评审子任务中返回 OpenSpec 绝对路径。

## 5. Verification

- [x] 5.1 运行 product workflow 与 Meegle adapter 聚焦测试。
- [x] 5.2 运行 TypeScript type check。
- [x] 5.3 聚焦测试和 type check 通过后运行 build。
