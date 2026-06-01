#!/bin/bash

# 构建项目
echo "Building project..."
npm run build

# 检查构建是否成功
if [ $? -eq 0 ]; then
    echo "Build successful!"
    
    # 安装最小依赖
    echo "Installing express..."
    npm install express --no-save
    
    # 启动预览服务器
    echo "Starting preview server..."
    node scripts/server.js
else
    echo "Build failed!"
    exit 1
fi 