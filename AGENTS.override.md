# 子目录级覆盖规则

当 AI 在以下子目录工作时，优先应用对应规则，覆盖根目录 AGENTS.md 中的通用约定。

## ainative-app

- 中文返回
- Vue 开发，只修改必要文件
- 非必要文件不做任何修改，也不要修改格式

## ainative-shadow

- 中文返回
- Vue3 + TS + Element Plus
- 表格使用 CommonTable 实现
- 只修改必要文件

## ainative-backend

- 中文返回
- Go/Kratos 洋葱架构
- 遵循 Biz/Data/Service 分层
- 业务逻辑放在 Biz 层，Data 层实现 Repository 接口
