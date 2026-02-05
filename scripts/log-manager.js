#!/usr/bin/env node

/**
 * 日志管理脚本
 * 功能：监控日志目录总大小，超过阈值时删除最旧的日志文件
 * 使用方法：
 *   - 定期运行：node scripts/log-manager.js
 *   - 配合 cron 或 pm2 定时任务使用
 */

const fs = require('fs');
const path = require('path');

// 配置参数
const PROJECT_ROOT = process.cwd();
const LOG_DIRS = [
  path.join(PROJECT_ROOT, 'logs'),           // 根目录 logs
  path.join(PROJECT_ROOT, 'backend/logs'),   // backend logs
  path.join(PROJECT_ROOT, 'frontend/logs'),  // frontend logs（如果存在）
];
const MAX_SIZE_GB = 20; // 最大容量 20GB
const MAX_SIZE_BYTES = MAX_SIZE_GB * 1024 * 1024 * 1024;
const SAFETY_MARGIN = 0.9; // 达到90%时开始清理，留有余地

/**
 * 递归获取目录下所有文件
 */
function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.log(`目录不存在: ${dir}`);
    return fileList;
  }

  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (stat.isFile() && file.endsWith('.log')) {
      fileList.push({
        path: filePath,
        size: stat.size,
        mtime: stat.mtime.getTime(), // 修改时间（毫秒时间戳）
      });
    }
  });
  
  return fileList;
}

/**
 * 计算目录总大小
 */
function calculateTotalSize(files) {
  return files.reduce((total, file) => total + file.size, 0);
}

/**
 * 格式化字节数
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 删除最旧的日志文件，直到总大小低于目标值
 */
function cleanupOldLogs(files, targetSize) {
  // 按修改时间排序（最旧的在前）
  files.sort((a, b) => a.mtime - b.mtime);
  
  let currentSize = calculateTotalSize(files);
  let deletedCount = 0;
  let deletedSize = 0;
  
  console.log(`\n开始清理日志文件...`);
  console.log(`当前总大小: ${formatBytes(currentSize)}`);
  console.log(`目标大小: ${formatBytes(targetSize)}`);
  
  for (const file of files) {
    if (currentSize <= targetSize) {
      break;
    }
    
    try {
      const fileSize = file.size;
      fs.unlinkSync(file.path);
      console.log(`已删除: ${file.path} (${formatBytes(fileSize)})`);
      
      currentSize -= fileSize;
      deletedSize += fileSize;
      deletedCount++;
    } catch (error) {
      console.error(`删除文件失败: ${file.path}`, error.message);
    }
  }
  
  console.log(`\n清理完成:`);
  console.log(`- 删除文件数: ${deletedCount}`);
  console.log(`- 释放空间: ${formatBytes(deletedSize)}`);
  console.log(`- 当前总大小: ${formatBytes(currentSize)}`);
  
  return { deletedCount, deletedSize, currentSize };
}

/**
 * 主函数
 */
function main() {
  console.log('='.repeat(60));
  console.log('日志管理脚本');
  console.log(`项目根目录: ${PROJECT_ROOT}`);
  console.log(`监控目录:`);
  LOG_DIRS.forEach(dir => {
    const exists = fs.existsSync(dir) ? '✓' : '✗';
    console.log(`  ${exists} ${dir}`);
  });
  console.log(`最大容量: ${MAX_SIZE_GB} GB`);
  console.log(`运行时间: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  // 获取所有日志文件（从所有配置的目录）
  let allFiles = [];
  const dirStats = {};
  
  LOG_DIRS.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = getAllFiles(dir);
      allFiles = allFiles.concat(files);
      
      if (files.length > 0) {
        const dirSize = calculateTotalSize(files);
        dirStats[dir] = {
          count: files.length,
          size: dirSize,
        };
      }
    }
  });
  
  if (allFiles.length === 0) {
    console.log('\n未找到任何日志文件');
    return;
  }
  
  // 计算总大小
  const totalSize = calculateTotalSize(allFiles);
  const usagePercent = ((totalSize / MAX_SIZE_BYTES) * 100).toFixed(2);
  
  console.log(`\n当前状态:`);
  console.log(`- 总日志文件数: ${allFiles.length}`);
  console.log(`- 总大小: ${formatBytes(totalSize)}`);
  console.log(`- 使用率: ${usagePercent}%`);
  
  // 显示各目录详情
  console.log(`\n各目录详情:`);
  Object.entries(dirStats).forEach(([dir, stats]) => {
    const relativePath = path.relative(PROJECT_ROOT, dir);
    console.log(`  ${relativePath}/`);
    console.log(`    - 文件数: ${stats.count}`);
    console.log(`    - 大小: ${formatBytes(stats.size)}`);
  });
  
  // 检查是否需要清理
  const threshold = MAX_SIZE_BYTES * SAFETY_MARGIN;
  
  if (totalSize > threshold) {
    console.log(`\n⚠️  日志大小超过阈值 (${(SAFETY_MARGIN * 100).toFixed(0)}%)，开始清理...`);
    
    // 清理到目标大小（保持在70%以下）
    const targetSize = MAX_SIZE_BYTES * 0.7;
    cleanupOldLogs(allFiles, targetSize);
  } else {
    console.log(`\n✅ 日志大小在正常范围内，无需清理`);
  }
  
  console.log('\n' + '='.repeat(60));
}

// 运行主函数
try {
  main();
} catch (error) {
  console.error('脚本执行出错:', error);
  process.exit(1);
}
