# Constants Guide

## 位置

业务常量统一放到 `internal/data/constant/constant.go`。

## 必须抽取的常量

- 场景值：`scene_type`
- 状态值：`status`
- 类型值：`type` / `source` / `problemType`
- 规则版本：`rule_version`
- 跨 Biz / Data / Service / Test 复用的固定业务值

## 命名

使用“业务域 + 对象 + 属性 + 值”的导出命名：

- `QuestionPushSceneTypeSyncPracticeTask`
- `StudentMistakeStatusUnfixed`
- `ExerciseSetStatusCompleted`

## Biz 使用方式

Biz 层直接引用 `constant.*`，不要在 Biz 中再定义同义别名。

```go
// Good
if req.GetSceneType() == constant.QuestionPushSceneTypeMistakeBookRedo {
    // ...
}

// Bad
const SceneTypeMistakeBookRedo = constant.QuestionPushSceneTypeMistakeBookRedo
```

## 不要过度抽取

只在单个函数内部使用、且不是业务语义的临时技术值，可以保留在局部。

## 收尾检查

后端任务收尾时扫描 Biz 层常量块：

```bash
rg "const \(" internal/biz -g "*.go"
```

如果结果包含本次新增的业务常量，迁移到 `internal/data/constant` 后再继续质量门禁。
