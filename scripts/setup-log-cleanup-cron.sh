#!/bin/bash

##############################################################
# 日志清理定时任务设置脚本
# 功能：设置定时任务，每小时检查一次日志大小并清理
##############################################################

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "设置日志清理定时任务"
echo "========================================"

# 获取项目根目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_MANAGER_SCRIPT="$PROJECT_DIR/scripts/log-manager.js"
NODE_BIN="$(which node)"

echo -e "${GREEN}项目目录:${NC} $PROJECT_DIR"
echo -e "${GREEN}日志管理脚本:${NC} $LOG_MANAGER_SCRIPT"
echo -e "${GREEN}Node 路径:${NC} $NODE_BIN"

# 检查 log-manager.js 是否存在
if [ ! -f "$LOG_MANAGER_SCRIPT" ]; then
    echo -e "${RED}错误: 找不到日志管理脚本${NC}"
    exit 1
fi

# 检查 node 是否存在
if [ -z "$NODE_BIN" ]; then
    echo -e "${RED}错误: 未找到 Node.js，请先安装${NC}"
    exit 1
fi

# 创建 cron 任务（每小时执行一次）
CRON_JOB="0 * * * * cd $PROJECT_DIR && $NODE_BIN $LOG_MANAGER_SCRIPT >> $PROJECT_DIR/logs/log-cleanup.log 2>&1"

echo ""
echo "将添加以下 cron 任务："
echo -e "${YELLOW}$CRON_JOB${NC}"
echo ""
echo "这将每小时检查一次日志大小，并在需要时清理旧日志"
echo ""

read -p "是否继续？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 检查 cron 任务是否已存在
if crontab -l 2>/dev/null | grep -F "$LOG_MANAGER_SCRIPT" >/dev/null; then
    echo -e "${YELLOW}警告: 已存在类似的 cron 任务${NC}"
    read -p "是否覆盖？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        exit 0
    fi
    
    # 删除旧任务
    crontab -l 2>/dev/null | grep -vF "$LOG_MANAGER_SCRIPT" | crontab -
fi

# 添加新任务
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo -e "${GREEN}✅ Cron 任务设置成功！${NC}"
echo ""
echo "当前 crontab 列表:"
crontab -l

echo ""
echo "========================================"
echo "设置完成"
echo "========================================"
echo ""
echo "提示："
echo "1. 日志清理将每小时自动运行"
echo "2. 清理日志保存在: $PROJECT_DIR/logs/log-cleanup.log"
echo "3. 如需手动运行: node $LOG_MANAGER_SCRIPT"
echo "4. 如需删除定时任务: crontab -e"
echo ""
