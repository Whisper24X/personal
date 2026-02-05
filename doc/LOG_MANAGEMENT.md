# 日志管理系统

## 概述

为防止日志文件过大导致服务崩溃，本系统实现了自动日志清理机制，限制所有日志目录总大小不超过 20GB。

系统会自动监控以下目录：

- `logs/` - 根目录日志（PM2、全局日志等）
- `backend/logs/` - 后端应用日志
- `frontend/logs/` - 前端应用日志（如果存在）

所有目录的日志文件总大小作为整体进行管理，超过阈值时会跨目录删除最旧的日志文件。

## 配置说明

### 当前日志配置

- **全局日志**: 保留 14 天，单文件最大 20MB
- **项目日志**: 保留 30 天，单文件最大 20MB
- **总容量限制**: 20GB（所有目录总和）
- **监控目录**:
  - `logs/` - 根目录日志
  - `backend/logs/` - 后端应用日志
  - `frontend/logs/` - 前端应用日志（如果存在）
- **清理阈值**: 达到 90% (18GB) 时触发清理
- **目标容量**: 清理后保持在 70% (14GB) 以下

### 文件说明

1. **scripts/log-manager.js**
   - 日志清理核心脚本
   - 递归扫描多个 `logs/` 目录及所有子目录
   - 计算总大小，超过阈值时删除最旧的日志文件
   - 支持监控：根目录 logs/、backend/logs/、frontend/logs/

2. **scripts/setup-log-cleanup-cron.sh**
   - Cron 定时任务设置脚本
   - 配置每小时执行一次日志清理
   - 适用于非 PM2 环境

3. **ecosystem.config.js**
   - PM2 配置文件
   - 已添加 `log-cleanup` 任务，每小时自动运行

## 使用方法

### 方法一：使用 PM2（推荐）

如果使用 PM2 管理服务，日志清理任务已集成到配置中：

```bash
# 启动所有服务（包括日志清理任务）
pm2 start ecosystem.config.js

# 或单独启动日志清理任务
pm2 start ecosystem.config.js --only log-cleanup

# 查看日志清理任务状态
pm2 list

# 查看日志清理日志
pm2 logs log-cleanup

# 手动触发一次清理
pm2 restart log-cleanup
```

### 方法二：使用 Cron

如果不使用 PM2，可以设置 Cron 定时任务：

```bash
# 运行设置脚本
cd /path/to/ainative
chmod +x scripts/setup-log-cleanup-cron.sh
./scripts/setup-log-cleanup-cron.sh

# 查看 cron 任务列表
crontab -l

# 手动编辑 cron（如需修改）
crontab -e
```

### 方法三：手动运行

可以随时手动运行清理脚本：

```bash
# 在项目根目录下运行
node scripts/log-manager.js
```

## 日志清理逻辑

1. **扫描**: 递归扫描配置的所有日志目录（`logs/`、`backend/logs/`、`frontend/logs/`）
2. **统计**: 统计所有目录下所有 `.log` 文件的总大小
3. **判断**: 如果总大小超过 18GB (90% 阈值)
4. **清理**: 跨所有目录按文件修改时间排序，删除最旧的文件
5. **停止**: 当总大小降至 14GB (70%) 以下时停止

注意：清理是跨目录进行的，会从所有目录中找出最旧的文件进行删除，确保保留相对较新的日志。

## 日志输出

### PM2 方式

- 清理日志位置: `logs/log-cleanup-out.log`
- 错误日志位置: `logs/log-cleanup-error.log`

### Cron 方式

- 清理日志位置: `logs/log-cleanup.log`

## 监控与维护

### 查看日志使用情况

```bash
# 查看所有日志目录大小
du -sh logs/ backend/logs/ frontend/logs/

# 查看各子目录大小（排序）
du -h logs/ backend/logs/ frontend/logs/ | sort -hr | head -20

# 统计日志文件数量
find logs/ backend/logs/ frontend/logs/ -name "*.log" 2>/dev/null | wc -l
```

### 调整配置参数

如需修改容量限制或清理阈值，编辑 `scripts/log-manager.js`:

```javascript
// 配置监控的日志目录
const LOG_DIRS = [
  path.join(PROJECT_ROOT, 'logs'), // 根目录 logs
  path.join(PROJECT_ROOT, 'backend/logs'), // backend logs
  path.join(PROJECT_ROOT, 'frontend/logs'), // frontend logs
  // 可以添加更多目录...
];

const MAX_SIZE_GB = 20; // 修改最大容量
const SAFETY_MARGIN = 0.9; // 修改触发阈值（0.9 = 90%）

// 目标大小在 cleanupOldLogs 函数中设置
const targetSize = MAX_SIZE_BYTES * 0.7; // 清理到 70%
```

### 调整清理频率

**PM2 方式**: 编辑 `ecosystem.config.js`

```javascript
cron_restart: '0 * * * *',  // 每小时
// 可改为:
cron_restart: '*/30 * * * *',  // 每 30 分钟
cron_restart: '0 */2 * * *',   // 每 2 小时
```

**Cron 方式**: 编辑 crontab

```bash
crontab -e
# 修改时间配置，格式: 分 时 日 月 周
```

## 应急处理

### 如果服务已经崩溃

```bash
# 1. 立即手动清理日志
node scripts/log-manager.js

# 2. 或直接删除旧日志
find logs/ -name "*.log" -mtime +7 -delete

# 3. 重启服务
pm2 restart all
```

### 紧急情况下快速释放空间

```bash
# 删除所有目录中超过 7 天的日志
find logs/ backend/logs/ frontend/logs/ -name "*.log" -mtime +7 -exec rm {} \; 2>/dev/null

# 删除超过 3 天的日志
find logs/ backend/logs/ frontend/logs/ -name "*.log" -mtime +3 -exec rm {} \; 2>/dev/null

# 只保留最近 1 天的日志（慎用！）
find logs/ backend/logs/ frontend/logs/ -name "*.log" -mtime +1 -exec rm {} \; 2>/dev/null
```

## 最佳实践

1. **定期监控**: 每周检查一次日志使用情况
2. **合理配置**: 根据业务量调整日志保留策略
3. **日志分级**: 生产环境使用 `info` 级别，避免过多 `debug` 日志
4. **及时归档**: 重要日志可以定期归档到其他存储
5. **告警设置**: 配置磁盘空间告警，提前预警

## 故障排查

### 清理脚本未运行

```bash
# 检查 PM2 任务状态
pm2 list
pm2 logs log-cleanup --lines 50

# 检查 Cron 任务
crontab -l
tail -f logs/log-cleanup.log
```

### 日志仍在增长

1. 检查是否有其他进程在写日志
2. 检查日志滚动配置是否生效
3. 检查是否有死循环或异常导致大量日志

### 权限问题

```bash
# 确保脚本有执行权限
chmod +x scripts/log-manager.js
chmod +x scripts/setup-log-cleanup-cron.sh

# 确保日志目录有写权限
chmod -R 755 logs/
```

## 技术支持

如有问题，请查看以下日志：

- PM2 日志: `pm2 logs`
- 清理日志: `logs/log-cleanup-out.log`
- 系统日志: `/var/log/syslog` 或 `journalctl -u cron`
