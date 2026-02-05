#!/bin/bash

##############################################################
# 验证日志清理任务是否运行
##############################################################

echo "=========================================="
echo "检查日志清理任务状态"
echo "=========================================="
echo ""

# 检查 PM2 进程
echo "1. 检查 PM2 进程列表:"
if command -v pm2 &> /dev/null; then
    pm2 list | grep -E "log-cleanup|mind2build"
    echo ""
    
    # 检查日志清理任务详细信息
    if pm2 list | grep -q "log-cleanup"; then
        echo "✅ 日志清理任务已启动"
        echo ""
        echo "2. 查看日志清理任务详情:"
        pm2 info log-cleanup
        echo ""
        echo "3. 查看最近的清理日志:"
        pm2 logs log-cleanup --lines 20 --nostream
    else
        echo "⚠️  日志清理任务未运行"
        echo ""
        echo "启动方式："
        echo "  pm2 start ecosystem.config.js"
        echo "  或"
        echo "  pm2 start ecosystem.config.js --only log-cleanup"
    fi
else
    echo "⚠️  PM2 未安装或未在 PATH 中"
    echo ""
    echo "检查 Cron 任务:"
    if crontab -l 2>/dev/null | grep -q "log-manager.js"; then
        echo "✅ 发现 Cron 定时任务"
        crontab -l | grep "log-manager.js"
    else
        echo "❌ 未发现 Cron 定时任务"
        echo ""
        echo "设置方式："
        echo "  ./scripts/setup-log-cleanup-cron.sh"
    fi
fi

echo ""
echo "=========================================="
echo "检查完成"
echo "=========================================="
