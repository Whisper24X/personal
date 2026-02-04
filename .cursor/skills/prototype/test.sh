#!/bin/bash

# Prototype Skill 测试脚本

echo "🧪 Prototype Skill 优化测试"
echo "================================"
echo ""

# 检查测试原型是否存在
TEST_FILE="/Users/moyan/myWorkPlace/ainative-workspace/docs/prototype/_test-optimized/index.html"

if [ ! -f "$TEST_FILE" ]; then
    echo "❌ 测试文件不存在: $TEST_FILE"
    exit 1
fi

echo "✅ 测试文件存在"
echo ""

# 检查关键配置
echo "📋 检查关键配置..."
echo ""

# 1. 检查 Vue 版本是否固定
if grep -q "vue@3.4.21" "$TEST_FILE"; then
    echo "✅ Vue 版本已固定: 3.4.21"
else
    echo "⚠️ Vue 版本未固定"
fi

# 2. 检查 Element Plus 版本是否固定
if grep -q "element-plus@2.5.6" "$TEST_FILE"; then
    echo "✅ Element Plus 版本已固定: 2.5.6"
else
    echo "⚠️ Element Plus 版本未固定"
fi

# 3. 检查中文语言包配置
if grep -q "ElementPlus.lang?.zhCn" "$TEST_FILE"; then
    echo "✅ 已配置中文语言包"
else
    echo "⚠️ 未配置中文语言包"
fi

# 4. 检查资源诊断脚本
if grep -q "资源加载诊断" "$TEST_FILE"; then
    echo "✅ 已添加资源诊断"
else
    echo "⚠️ 未添加资源诊断"
fi

# 5. 检查错误处理
if grep -q "errorHandler" "$TEST_FILE"; then
    echo "✅ 已配置错误处理"
else
    echo "⚠️ 未配置错误处理"
fi

echo ""
echo "================================"
echo ""
echo "🌐 启动本地服务器测试..."
echo ""
echo "1. 在浏览器访问:"
echo "   http://localhost:8000/docs/prototype/_test-optimized/"
echo ""
echo "2. 检查清单:"
echo "   - [ ] 资源加载状态全部 ✅"
echo "   - [ ] 日期选择器显示中文"
echo "   - [ ] 分页显示 '共 50 条'"
echo "   - [ ] 输入框可正常输入"
echo "   - [ ] 按钮点击有提示"
echo "   - [ ] 控制台无红色错误"
echo ""
echo "3. 按 Ctrl+C 停止服务器"
echo ""
echo "================================"

# 启动服务器
cd /Users/moyan/myWorkPlace/ainative-workspace
python3 -m http.server 8000
