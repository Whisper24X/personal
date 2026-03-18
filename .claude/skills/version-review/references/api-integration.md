# API 集成

## 接口

1. **启动评审**：`POST /api/projects/:id/versions/:versionId/review/start`
   - 初始化评审状态并生成第一题
   - 返回：`{ status: "generating_question", currentRound: 1 }`

2. **获取状态**：`GET /api/projects/:id/versions/:versionId/review/status`
   - 返回当前评审状态、当前问题、历史 Q&A
   - 前端需定期轮询

3. **提交回答**：`POST /api/projects/:id/versions/:versionId/review/answer`
   - 提交用户回答并自动生成下一题
   - 返回：`{ status: "generating_question", currentRound: N }`

4. **继续评审**：`POST /api/projects/:id/versions/:versionId/review/continue`
   - 手动触发下一题生成（通常不需要）

## 前端流程

1. 调用 `startReview` 初始化
2. 每 2 秒轮询 `getStatus`
3. 当状态为 `waiting_answer`，展示问题并等待输入
4. 调用 `submitAnswer` 提交回答
5. 继续轮询，直到状态为 `completed` 或 `failed`

## 错误处理

- **知识检索失败**：使用空知识上下文继续，采用默认问题模板
- **问题生成失败**：使用兜底问题："请检查版本想法在[question type]方面是否存在问题？"
- **状态持久化失败**：记录错误并返回错误状态给前端
- **文档生成失败**：将状态置为 `failed` 并返回错误信息
