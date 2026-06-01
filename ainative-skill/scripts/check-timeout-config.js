#!/usr/bin/env node

/**
 * 超时配置检查脚本
 * 用于验证 REQUEST_TIMEOUT 环境变量是否正确配置
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 检查超时配置...\n');

// 检查 .env 文件
const envPath = path.join(__dirname, '../.env');
const envTemplatePath = path.join(__dirname, '../config/env.template');

let envExists = fs.existsSync(envPath);
let timeoutValue = null;

if (envExists) {
  console.log('✅ 找到 .env 文件');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const timeoutMatch = envContent.match(/REQUEST_TIMEOUT\s*=\s*(\d+)/);
  
  if (timeoutMatch) {
    timeoutValue = parseInt(timeoutMatch[1]);
    console.log(`✅ 找到 REQUEST_TIMEOUT=${timeoutValue} 秒`);
  } else {
    console.log('⚠️  .env 文件中未找到 REQUEST_TIMEOUT 配置');
  }
} else {
  console.log('❌ 未找到 .env 文件');
  console.log(`💡 提示: 可以从模板创建: cp ${envTemplatePath} ${envPath}`);
}

// 检查环境变量模板
if (fs.existsSync(envTemplatePath)) {
  const templateContent = fs.readFileSync(envTemplatePath, 'utf-8');
  const templateTimeoutMatch = templateContent.match(/REQUEST_TIMEOUT\s*=\s*(\d+)/);
  
  if (templateTimeoutMatch) {
    const templateTimeout = parseInt(templateTimeoutMatch[1]);
    console.log(`\n📋 模板文件中的默认值: REQUEST_TIMEOUT=${templateTimeout} 秒`);
    
    if (!timeoutValue || timeoutValue < 300) {
      console.log('\n⚠️  建议:');
      console.log('   - 对于 PRD 生成，建议设置 REQUEST_TIMEOUT=600（10分钟）或更高');
      console.log('   - 小型文档: 300秒（5分钟）');
      console.log('   - 中型文档: 600秒（10分钟）');
      console.log('   - 大型文档: 900秒（15分钟）或更高');
    }
  }
}

// 检查当前进程环境变量
const processTimeout = process.env.REQUEST_TIMEOUT;
if (processTimeout) {
  console.log(`\n🌍 当前进程环境变量: REQUEST_TIMEOUT=${processTimeout} 秒`);
} else {
  console.log('\n🌍 当前进程环境变量: REQUEST_TIMEOUT 未设置');
  console.log('   ⚠️  如果服务正在运行，需要重启才能加载新的配置');
}

// 总结
console.log('\n📝 总结:');
if (timeoutValue) {
  if (timeoutValue >= 600) {
    console.log('✅ 超时配置看起来合理（≥ 600秒）');
  } else if (timeoutValue >= 300) {
    console.log('⚠️  超时配置可能偏短，建议增加到 600 秒或更高');
  } else {
    console.log('❌ 超时配置太短，强烈建议增加到至少 300 秒');
  }
} else {
  console.log('❌ 未找到超时配置，将使用默认值 300 秒');
}

console.log('\n💡 如果遇到超时问题:');
console.log('   1. 确保 .env 文件中设置了 REQUEST_TIMEOUT=600 或更高');
console.log('   2. 重启后端服务');
console.log('   3. 查看日志确认配置已生效');
console.log('   4. 参考 docs/TROUBLESHOOTING_TIMEOUT.md 获取更多帮助\n');

