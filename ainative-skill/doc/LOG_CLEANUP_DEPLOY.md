# 日志清理部署快速指南

> ⚠️ **重要**: 本指南用于在服务器上快速部署日志清理功能，防止日志文件过大导致服务崩溃

## 🎯 解决的问题

- 日志文件无限增长导致磁盘空间耗尽
- 服务器因磁盘满而崩溃
- 缺乏自动化的日志管理机制

## 📋 快速部署步骤

### 1️⃣ 拉取最新代码

```bash
cd /path/to/ainative
git pull origin feat/mo  # 或你的分支名
```

### 2️⃣ 确认文件存在

检查以下文件是否存在：

```bash
ls -la scripts/log-manager.js
ls -la scripts/setup-log-cleanup-cron.sh
cat ecosystem.config.js | grep log-cleanup
```

### 3️⃣ 检查日志目录

脚本会自动监控以下目录：

- `logs/` - 根目录日志
- `backend/logs/` - 后端日志
- `frontend/logs/` - 前端日志（如果存在）

查看当前日志使用情况：

```bash
pnpm logs:size
```

### 4️⃣ 给脚本添加执行权限

```bash
chmod +x scripts/log-manager.js
chmod +x scripts/setup-log-cleanup-cron.sh
```

### 4️⃣ 测试日志清理脚本

```bash
# 手动运行一次，查看当前日志使用情况
node scripts/log-manager.js
```

你应该看到类似的输出：

```
============================================================
日志管理脚本
日志目录: /path/to/ainative/logs
最大容量: 20 GB
运行时间: 2026-02-05T06:44:19.034Z
============================================================

当前状态:
- 日志文件数: 123
- 总大小: 5.2 GB
- 使用率: 26.00%

✅ 日志大小在正常范围内，无需清理

============================================================
```

### 5️⃣ 选择部署方式

#### 方式 A: 使用 PM2（推荐）⭐

如果你的服务使用 PM2 管理：

```bash
# 重启 PM2 服务（会自动启动日志清理任务）
pm2 restart ecosystem.config.js

# 或者只启动日志清理任务
pm2 start ecosystem.config.js --only log-cleanup

# 查看任务状态
pm2 list

# 查看日志清理日志
pm2 logs log-cleanup

# 手动触发一次清理
pm2 restart log-cleanup
```

#### 方式 B: 使用 Cron

如果不使用 PM2：

```bash
# 运行设置脚本
./scripts/setup-log-cleanup-cron.sh

# 按提示确认后，会自动添加 cron 任务

# 验证 cron 任务
crontab -l
```

### 6️⃣ 验证部署成功

等待 1 小时后，检查日志清理是否执行：

```bash
# PM2 方式
pm2 logs log-cleanup --lines 20

# Cron 方式
tail -20 logs/log-cleanup.log

# 查看日志目录大小
du -sh logs/
```

## 🔍 日常监控

### 查看日志使用情况

```bash
# 方式 1: 使用 npm script（显示所有日志目录）
pnpm logs:size

# 方式 2: 详细查看各目录
du -h logs/ backend/logs/ frontend/logs/ 2>/dev/null
find logs/ backend/logs/ frontend/logs/ -name "*.log" 2>/dev/null | wc -l
```

### 手动清理日志

```bash
# 方式 1: 使用 npm script
pnpm logs:cleanup

# 方式 2: 直接运行脚本
node scripts/log-manager.js
```

### 查看清理历史

```bash
# PM2 方式
pm2 logs log-cleanup

# Cron 方式
tail -100 logs/log-cleanup.log
```

## ⚙️ 配置说明

### 当前配置

- **总容量上限**: 20 GB（所有日志目录总和）
- **监控目录**:
  - `logs/` - 根目录日志（PM2、全局日志等）
  - `backend/logs/` - 后端应用日志
  - `frontend/logs/` - 前端应用日志（如果存在）
- **清理阈值**: 18 GB (90%)
- **清理目标**: 14 GB (70%)
- **执行频率**: 每小时一次
- **清理策略**: 跨所有目录，按文件修改时间删除最旧的日志

### 修改配置

如需调整参数，编辑 `scripts/log-manager.js`:

```javascript
// 配置监控的日志目录
const LOG_DIRS = [
  path.join(PROJECT_ROOT, 'logs'), // 根目录 logs
  path.join(PROJECT_ROOT, 'backend/logs'), // backend logs
  path.join(PROJECT_ROOT, 'frontend/logs'), // frontend logs
];

const MAX_SIZE_GB = 20; // 修改总容量上限
const SAFETY_MARGIN = 0.9; // 修改清理阈值（0.9 = 90%）

// 在 cleanupOldLogs 函数中修改清理目标
const targetSize = MAX_SIZE_BYTES * 0.7; // 0.7 = 70%
```

修改后重启服务：

```bash
# PM2
pm2 restart log-cleanup

# Cron
# 无需重启，下次执行时自动生效
```

## 🚨 应急处理

### 如果服务已经崩溃

```bash
# 1. 立即手动清理
cd /path/to/ainative
node scripts/log-manager.js

# 2. 或快速删除旧日志（7天前）
find logs/ -name "*.log" -mtime +7 -delete

# 3. 重启服务
pm2 restart all
```

### 紧急释放空间

```bash
# 删除所有目录中 7 天前的日志
find logs/ backend/logs/ frontend/logs/ -name "*.log" -mtime +7 -exec rm {} \; 2>/dev/null

# 删除 3 天前的日志
find logs/ backend/logs/ frontend/logs/ -name "*.log" -mtime +3 -exec rm {} \; 2>/dev/null

# 只保留最近 1 天（慎用！）
find logs/ backend/logs/ frontend/logs/ -name "*.log" -mtime +1 -exec rm {} \; 2>/dev/null
```

## 📊 监控建议

### 设置告警

建议在监控系统中设置以下告警：

1. **磁盘使用率告警**: 当磁盘使用超过 80% 时告警
2. **日志大小告警**: 当 logs 目录超过 15GB 时告警
3. **清理任务失败告警**: 当日志清理任务连续失败时告警

### 定期检查

每周检查一次：

```bash
# 1. 查看日志使用情况
pnpm logs:size

# 2. 查看清理任务运行情况
pm2 logs log-cleanup --lines 50

# 3. 查看磁盘空间
df -h
```

## 📝 变更清单

本次部署包含以下文件变更：

1. **新增**: `scripts/log-manager.js` - 日志清理核心脚本
2. **新增**: `scripts/setup-log-cleanup-cron.sh` - Cron 设置脚本
3. **新增**: `doc/LOG_MANAGEMENT.md` - 详细文档
4. **新增**: `doc/LOG_CLEANUP_DEPLOY.md` - 本快速指南
5. **更新**: `ecosystem.config.js` - 添加日志清理 PM2 任务
6. **更新**: `package.json` - 添加日志管理相关脚本
7. **更新**: `scripts/README.md` - 添加日志管理工具说明

## 🔗 相关文档

- [详细文档](./LOG_MANAGEMENT.md) - 完整的日志管理文档
- [脚本说明](../scripts/README.md) - 所有脚本工具说明

## 💡 最佳实践

1. ✅ 使用 PM2 方式部署（更稳定、更易管理）
2. ✅ 定期检查日志使用情况（每周一次）
3. ✅ 设置磁盘空间告警（提前预警）
4. ✅ 根据业务量调整日志保留策略
5. ✅ 生产环境使用 `info` 日志级别（避免过多 debug 日志）

## ❓ 常见问题

### Q: 如何查看日志清理任务是否在运行？

**A**: 使用 `pm2 list` 或 `crontab -l` 查看

### Q: 清理任务会删除重要日志吗？

**A**: 只在总大小超过 18GB 时才清理，且按时间删除最旧的文件

### Q: 如何暂停日志清理？

**A**:

- PM2: `pm2 stop log-cleanup`
- Cron: `crontab -e` 然后注释掉对应行

### Q: 如何修改清理频率？

**A**:

- PM2: 编辑 `ecosystem.config.js` 中的 `cron_restart`
- Cron: 运行 `crontab -e` 修改时间配置

---

**部署日期**: 2026-02-05  
**版本**: v1.0.0  
**状态**: ✅ 已测试
