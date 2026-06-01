# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **goals**: Git 操作集成，支持目标文档持久化
- **goals**: 清理工作区内外来未跟踪的目标目录
- **workflow**: V2.1 增强工作流模板，支持依赖感知的 prompt
- **skills**: 技能目录与上传 UX 支持 `.agents/skills`
- **oauth**: OAuth MCP Native Login Relay 框架与原生登录中继
- **mcp**: OAuth MCP 授权 UI 与后端处理增强
- **memory**: memory markdown 文件规范化与路径校验
- **business-lines**: 业务线硬删除
- **git**: `commitRelativePathsInRepoRootIfDirty` 方法
- **tasks**: 任务开始前禁用回复输入
- **changelog-automation**: 引入 agent skill，规范从 commit 自动生成变更记录

### Changed

- **goals**: 目标文档处理改为使用临时 worktree
- **runner**: 浏览器工具链由 Playwright 切换为 chrome-devtools-mcp，并安装 xvfb
- **tasks**: 重命名 reset workflow node 相关方法，语义更清晰
- **i18n**: 前后端默认语言改为中文；移除 backend 非 zh/en 语言包
- **workflow**: V2.1 节点名称与默认工作流对齐（使用中文名）

### Fixed

- **tasks**: 修复执行消息中文件链接预览
- **tasks**: 修复任务回复续会话校验
- **tasks**: 节点失败后仍允许回复的交互逻辑
- **tasks**: 恢复已暂停任务的环境
- **mcp**: 稳定 OAuth MCP 登录流程；runner 中项目 probe 改在 runner 内执行
- **git**: 本地分支领先或落后远程时展示 reset 提示
- **goals**: 增强源文档上传能力
- **workflow**: 循环与 agent CLI 配置的节点处理；V2.1 节点名与默认工作流一致
- **prompt**: 补充 prompt 数据库 migration

[Unreleased]: https://gitlab.yc345.tv/frontend/ainative/-/compare/main...HEAD
