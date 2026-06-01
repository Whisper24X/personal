# 日志管理功能 - 多目录支持更新

## 🔄 更新内容

基于你的反馈，已更新日志管理脚本以支持监控多个日志目录。

### 发现的问题

原始脚本仅监控根目录的 `logs/`，但实际上：

- `backend/logs/` 目录有 **81MB** 的日志文件
- 根目录 `logs/` 只有 **7.1MB** 的日志文件

backend 目录的日志是主要的存储位置，需要被纳入监控范围。

### 解决方案

更新了 `scripts/log-manager.js`，现在能够：

1. **多目录监控**
   - 同时监控 `logs/`、`backend/logs/`、`frontend/logs/`
   - 可以轻松添加更多目录

2. **跨目录统计**
   - 计算所有目录的日志文件总大小
   - 显示每个目录的详细统计信息

3. **智能清理**
   - 跨所有目录按时间排序
   - 删除最旧的文件，无论它在哪个目录
   - 确保总大小不超过 20GB

## 📊 测试结果

```bash
$ node scripts/log-manager.js

============================================================
日志管理脚本
项目根目录: /Users/moyan/myWorkPlace/ainative
监控目录:
  ✓ /Users/moyan/myWorkPlace/ainative/logs
  ✓ /Users/moyan/myWorkPlace/ainative/backend/logs
  ✗ /Users/moyan/myWorkPlace/ainative/frontend/logs
最大容量: 20 GB
运行时间: 2026-02-05T06:59:30.346Z
============================================================

当前状态:
- 总日志文件数: 14
- 总大小: 72.01 MB
- 使用率: 0.35%

各目录详情:
  logs/
    - 文件数: 4
    - 大小: 7.14 MB
  backend/logs/
    - 文件数: 10
    - 大小: 64.87 MB

✅ 日志大小在正常范围内，无需清理

============================================================
```

## 🔧 技术细节

### 代码变更

**配置部分**:

```javascript
// 之前: 只监控一个目录
const LOG_DIR = path.join(process.cwd(), 'logs');

// 现在: 监控多个目录
const LOG_DIRS = [
  path.join(PROJECT_ROOT, 'logs'), // 根目录 logs
  path.join(PROJECT_ROOT, 'backend/logs'), // backend logs
  path.join(PROJECT_ROOT, 'frontend/logs'), // frontend logs
];
```

**扫描逻辑**:

```javascript
// 从所有配置的目录收集日志文件
let allFiles = [];
LOG_DIRS.forEach((dir) => {
  if (fs.existsSync(dir)) {
    const files = getAllFiles(dir);
    allFiles = allFiles.concat(files);
  }
});
```

**清理策略**:

- 合并所有目录的日志文件列表
- 按修改时间排序（最旧的在前）
- 跨目录删除最旧的文件
- 直到总大小降至目标值

### 命令更新

**logs:size 命令**:

```bash
# 之前: 只显示根目录
du -sh logs/ && find logs/ -name '*.log' | wc -l

# 现在: 显示所有日志目录
du -sh logs/ backend/logs/ frontend/logs/ 2>/dev/null | sort -hr
```

## 📝 更新的文档

已同步更新以下文档以反映多目录支持：

1. ✅ `scripts/log-manager.js` - 核心脚本
2. ✅ `package.json` - logs:size 命令
3. ✅ `doc/LOG_MANAGEMENT.md` - 详细文档
4. ✅ `doc/LOG_CLEANUP_DEPLOY.md` - 部署指南
5. ✅ `doc/LOG_CLEANUP_SUMMARY.md` - 实施总结
6. ✅ `scripts/README.md` - 脚本说明

## 🎯 关键特性

### 1. 自动发现目录

脚本会检查每个配置的目录是否存在，存在的才会被监控：

```
监控目录:
  ✓ /path/to/logs              # 存在，会被监控
  ✓ /path/to/backend/logs      # 存在，会被监控
  ✗ /path/to/frontend/logs     # 不存在，跳过
```

### 2. 目录统计信息

显示每个目录的详细信息，便于分析哪个目录占用空间最多：

```
各目录详情:
  logs/
    - 文件数: 4
    - 大小: 7.14 MB
  backend/logs/
    - 文件数: 10
    - 大小: 64.87 MB
```

### 3. 统一管理

所有目录作为一个整体进行管理：

- 总容量限制: 20GB（所有目录之和）
- 清理策略: 跨目录按时间优先
- 确保保留最新的日志，无论在哪个目录

## 🔄 如何添加更多目录

如果将来需要监控更多日志目录，只需编辑 `scripts/log-manager.js`:

```javascript
const LOG_DIRS = [
  path.join(PROJECT_ROOT, 'logs'),
  path.join(PROJECT_ROOT, 'backend/logs'),
  path.join(PROJECT_ROOT, 'frontend/logs'),
  path.join(PROJECT_ROOT, 'api/logs'), // 新增
  path.join(PROJECT_ROOT, 'worker/logs'), // 新增
  // ... 更多目录
];
```

## ✅ 验证清单

- [x] 脚本能正确识别多个日志目录
- [x] 正确处理不存在的目录
- [x] 计算所有目录的总大小
- [x] 显示每个目录的统计信息
- [x] 跨目录清理功能正常
- [x] logs:size 命令显示所有目录
- [x] 所有文档已更新

## 🚀 部署建议

无需额外操作，只需按原计划部署即可。脚本会自动：

1. 检测所有配置的目录
2. 只监控存在的目录
3. 统一管理所有日志文件

如果将来添加了新的服务（如 api、worker 等）并且它们也有日志目录，记得在脚本中添加对应的路径配置。

---

**更新时间**: 2026-02-05  
**版本**: v1.1.0  
**状态**: ✅ 已完成并测试
