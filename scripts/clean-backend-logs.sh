#!/bin/bash

# Backend 日志清理脚本
# 功能：清除 backend/logs 目录下的所有文件
# 使用方法：
#   - 手动运行：./scripts/clean-backend-logs.sh
#   - 配合 crontab 定时任务使用（每小时运行一次）

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_LOGS_DIR="$PROJECT_ROOT/backend/logs"

# 格式化字节数函数
format_bytes() {
    local bytes=$1
    if [ "$bytes" -eq 0 ]; then
        echo "0 Bytes"
        return
    fi
    
    local k=1024
    local sizes=("Bytes" "KB" "MB" "GB" "TB")
    local i=0
    local size=$bytes
    
    while [ "$size" -ge "$k" ] && [ "$i" -lt 4 ]; do
        size=$((size / k))
        i=$((i + 1))
    done
    
    echo "${size} ${sizes[$i]}"
}

# 主函数
main() {
    echo "============================================================"
    echo "Backend 日志清理脚本"
    echo "项目根目录: $PROJECT_ROOT"
    echo "目标目录: $BACKEND_LOGS_DIR"
    echo "运行时间: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo "============================================================"
    
    if [ ! -d "$BACKEND_LOGS_DIR" ]; then
        echo "目录不存在: $BACKEND_LOGS_DIR"
        echo "============================================================"
        exit 0
    fi
    
    # 统计删除前的文件数量和大小
    local deleted_count=0
    local deleted_size=0
    
    # 删除所有文件和子目录
    while IFS= read -r -d '' file; do
        if [ -f "$file" ]; then
            local file_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
            rm -f "$file"
            if [ $? -eq 0 ]; then
                echo "已删除: $(basename "$file") ($(format_bytes $file_size))"
                deleted_count=$((deleted_count + 1))
                deleted_size=$((deleted_size + file_size))
            fi
        elif [ -d "$file" ]; then
            local dir_size=$(du -sb "$file" 2>/dev/null | cut -f1 || echo 0)
            rm -rf "$file"
            if [ $? -eq 0 ]; then
                echo "已删除目录: $(basename "$file")"
                deleted_count=$((deleted_count + 1))
                deleted_size=$((deleted_size + dir_size))
            fi
        fi
    done < <(find "$BACKEND_LOGS_DIR" -mindepth 1 -print0 2>/dev/null)
    
    # 如果没有找到文件，使用简单的 ls + rm 方式
    if [ $deleted_count -eq 0 ]; then
        local files=$(ls -A "$BACKEND_LOGS_DIR" 2>/dev/null)
        if [ -n "$files" ]; then
            cd "$BACKEND_LOGS_DIR" || exit 1
            for item in *; do
                if [ -e "$item" ]; then
                    if [ -f "$item" ]; then
                        local file_size=$(stat -f%z "$item" 2>/dev/null || stat -c%s "$item" 2>/dev/null || echo 0)
                        rm -f "$item"
                        echo "已删除: $item ($(format_bytes $file_size))"
                        deleted_count=$((deleted_count + 1))
                        deleted_size=$((deleted_size + file_size))
                    elif [ -d "$item" ]; then
                        local dir_size=$(du -sb "$item" 2>/dev/null | cut -f1 || echo 0)
                        rm -rf "$item"
                        echo "已删除目录: $item"
                        deleted_count=$((deleted_count + 1))
                        deleted_size=$((deleted_size + dir_size))
                    fi
                fi
            done
        fi
    fi
    
    echo ""
    echo "清理完成:"
    echo "- 删除文件/目录数: $deleted_count"
    echo "- 释放空间: $(format_bytes $deleted_size)"
    echo "============================================================"
}

# 运行主函数
main
