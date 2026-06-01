#!/bin/bash

# PM2 启动脚本 - 确保 shared 包已构建
# 使用方法: ./scripts/pm2-start.sh

set -e

echo "🔨 Building shared package..."
pnpm build:shared

if [ $? -eq 0 ]; then
    echo "✅ Shared package built successfully"
    echo "🚀 Starting PM2 processes..."
    pm2 start ecosystem.config.js "$@"
else
    echo "❌ Failed to build shared package"
    exit 1
fi

