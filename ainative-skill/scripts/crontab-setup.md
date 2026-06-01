# Crontab 定时任务配置说明

## 功能

每小时自动清理 `backend/logs` 目录下的所有文件

## 设置步骤

### 1. 编辑 crontab

```bash
crontab -e
```

### 2. 添加以下行（每小时运行一次）

```bash
# 每小时清理 backend/logs 目录
0 * * * * /Users/l/Documents/work/code/demo/aitest/testflow/scripts/clean-backend-logs.sh >> /dev/null 2>&1
```

### 3. 如果需要记录日志，可以使用以下配置

```bash
# 每小时清理 backend/logs 目录（带日志记录）
0 * * * * /Users/l/Documents/work/code/demo/aitest/testflow/scripts/clean-backend-logs.sh >> /tmp/backend-logs-cleanup.log 2>&1
```

## Cron 表达式说明

- `0 * * * *` - 每小时的 0 分执行（即每小时执行一次）
- 格式：`分钟 小时 日 月 星期`

## 其他常用时间示例

- `0 */2 * * *` - 每 2 小时执行一次
- `0 0 * * *` - 每天 0 点执行
- `0 0 * * 0` - 每周日 0 点执行
- `*/30 * * * *` - 每 30 分钟执行一次

## 验证 crontab 配置

```bash
# 查看当前用户的 crontab
crontab -l

# 查看 crontab 日志（macOS）
log show --predicate 'process == "cron"' --last 1h
```

## 测试脚本

在添加到 crontab 之前，可以先手动测试脚本：

```bash
/Users/l/Documents/work/code/demo/aitest/testflow/scripts/clean-backend-logs.sh
```

## 注意事项

1. 确保脚本有执行权限：`chmod +x scripts/clean-backend-logs.sh`
2. 使用绝对路径，避免路径问题
3. 如果脚本输出不需要记录，可以重定向到 `/dev/null`
4. macOS 系统需要授予 Terminal/iTerm 完全磁盘访问权限才能执行文件操作
