# ainative 工作流触发词

针对 ainative 项目的中文触发词，用于 self-improvement skill 的 Detection Triggers。

## 用户纠正（→ 场景 2 | LEARNINGS.md, category: correction）

- 「不对」「不是这样」「你搞错了」
- 「其实是」「应该是」「正确做法是」
- 「这里错了」「那里有问题」
- 「你理解错了」「我说的是…」

## 功能缺失请求（→ 场景 3 | FEATURE_REQUESTS.md）

- 「能不能…」「可以加一个…」
- 「希望支持…」「需要增加…」
- 「为什么没有…」「有没有办法…」

## 知识过时/错误（→ 场景 5 | LEARNINGS.md, category: knowledge_gap）

- 用户提供了你未掌握的信息
- 文档与当前实现不一致
- API 行为与预期不符

## 错误/失败（→ 场景 1 本地 / 场景 4 外部 API | ERRORS.md）

- 命令返回非零退出码
- 异常或堆栈跟踪
- 超时或连接失败
- 构建/测试失败

## ainative 特有 Area

| Area       | 范围                   |
| ---------- | ---------------------- |
| `workflow` | 工作流步骤、角色、动作 |
| `docs`     | PRD、MRD、DESIGN 文档  |
| `task`     | 任务拆解、子任务执行   |
