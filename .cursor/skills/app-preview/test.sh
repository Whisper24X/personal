#!/bin/bash

# app-preview 技能测试脚本
# 用于验证配置和环境是否正确

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../../../ainative-app"

echo "🔍 ainative-app 小程序体验版生成环境检查"
echo "=============================================="
echo ""

# 检查项目目录
echo "📁 检查项目目录..."
if [ ! -d "$PROJECT_DIR" ]; then
  echo "❌ ainative-app 目录不存在: $PROJECT_DIR"
  exit 1
fi
echo "✅ 项目目录存在"
echo ""

# 检查 package.json
echo "📦 检查 package.json..."
if [ ! -f "$PROJECT_DIR/package.json" ]; then
  echo "❌ package.json 不存在"
  exit 1
fi
echo "✅ package.json 存在"
echo ""

# 检查必要的 npm 脚本
echo "🔧 检查 npm 脚本..."
SCRIPTS=(
  "ci:weapp:upload:test"
  "ci:weapp:upload:stage"
  "ci:weapp:upload:production"
)

for script in "${SCRIPTS[@]}"; do
  if grep -q "\"$script\"" "$PROJECT_DIR/package.json"; then
    echo "✅ 脚本存在: $script"
  else
    echo "⚠️  脚本不存在: $script"
  fi
done
echo ""

# 检查配置文件
echo "⚙️  检查 CI 配置文件..."

if [ -f "$PROJECT_DIR/ci.config.js" ]; then
  echo "✅ ci.config.js 存在"
  
  # 读取配置信息
  APPID=$(node -p "try { require('$PROJECT_DIR/ci.config.js').WEAPP_APPID } catch(e) { 'ERROR' }" 2>/dev/null)
  VERSION=$(node -p "try { require('$PROJECT_DIR/ci.config.js').WEAPP_VERSION } catch(e) { 'ERROR' }" 2>/dev/null)
  KEY_PATH=$(node -p "try { require('$PROJECT_DIR/ci.config.js').WEAPP_PRIVATE_KEY_PATH } catch(e) { 'ERROR' }" 2>/dev/null)
  
  if [ "$APPID" != "ERROR" ]; then
    echo "  - AppID: $APPID"
    echo "  - 版本: $VERSION"
    echo "  - 私钥路径: $KEY_PATH"
  else
    echo "⚠️  配置文件格式错误"
  fi
else
  echo "⚠️  ci.config.js 不存在（生产/预发环境）"
fi
echo ""

if [ -f "$PROJECT_DIR/ci.test.config.js" ]; then
  echo "✅ ci.test.config.js 存在"
  
  TEST_APPID=$(node -p "try { require('$PROJECT_DIR/ci.test.config.js').WEAPP_APPID } catch(e) { 'ERROR' }" 2>/dev/null)
  TEST_VERSION=$(node -p "try { require('$PROJECT_DIR/ci.test.config.js').WEAPP_VERSION } catch(e) { 'ERROR' }" 2>/dev/null)
  TEST_KEY_PATH=$(node -p "try { require('$PROJECT_DIR/ci.test.config.js').WEAPP_PRIVATE_KEY_PATH } catch(e) { 'ERROR' }" 2>/dev/null)
  
  if [ "$TEST_APPID" != "ERROR" ]; then
    echo "  - AppID: $TEST_APPID"
    echo "  - 版本: $TEST_VERSION"
    echo "  - 私钥路径: $TEST_KEY_PATH"
  else
    echo "⚠️  配置文件格式错误"
  fi
else
  echo "⚠️  ci.test.config.js 不存在（测试环境）"
  echo "  提示: 测试环境可以使用 ci.config.js 作为后备"
fi
echo ""

# 检查私钥文件
echo "🔑 检查私钥文件..."
if [ -d "$PROJECT_DIR/key" ]; then
  KEY_COUNT=$(find "$PROJECT_DIR/key" -name "*.key" | wc -l | tr -d ' ')
  if [ "$KEY_COUNT" -gt 0 ]; then
    echo "✅ 找到 $KEY_COUNT 个私钥文件:"
    find "$PROJECT_DIR/key" -name "*.key" -exec basename {} \;
  else
    echo "❌ key/ 目录存在，但未找到私钥文件（*.key）"
  fi
else
  echo "❌ key/ 目录不存在"
fi
echo ""

# 检查依赖
echo "📚 检查关键依赖..."
if [ -d "$PROJECT_DIR/node_modules" ]; then
  echo "✅ node_modules 存在"
  
  # 检查关键包
  PACKAGES=(
    "@tarojs/plugin-mini-ci"
    "miniprogram-ci"
    "@tarojs/cli"
  )
  
  for pkg in "${PACKAGES[@]}"; do
    if [ -d "$PROJECT_DIR/node_modules/$pkg" ]; then
      VERSION=$(node -p "require('$PROJECT_DIR/node_modules/$pkg/package.json').version" 2>/dev/null)
      echo "  ✅ $pkg@$VERSION"
    else
      echo "  ⚠️  $pkg 未安装"
    fi
  done
else
  echo "⚠️  node_modules 不存在，请先运行 npm install"
fi
echo ""

# 检查 Node 和 npm 版本
echo "🔧 检查运行环境..."
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo "  - Node.js: $NODE_VERSION"
echo "  - npm: $NPM_VERSION"
echo ""

# 总结
echo "=============================================="
echo "📋 检查总结"
echo "=============================================="

WARNINGS=0
ERRORS=0

if [ ! -f "$PROJECT_DIR/ci.config.js" ] && [ ! -f "$PROJECT_DIR/ci.test.config.js" ]; then
  echo "❌ 错误: 缺少 CI 配置文件"
  ERRORS=$((ERRORS + 1))
fi

if [ ! -d "$PROJECT_DIR/key" ] || [ "$KEY_COUNT" -eq 0 ]; then
  echo "❌ 错误: 缺少私钥文件"
  ERRORS=$((ERRORS + 1))
fi

if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "⚠️  警告: 需要安装依赖 (npm install)"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo "✅ 所有检查通过！可以使用 app-preview 技能生成体验版"
elif [ $ERRORS -eq 0 ]; then
  echo "⚠️  发现 $WARNINGS 个警告，但可以继续"
else
  echo "❌ 发现 $ERRORS 个错误，请先解决这些问题"
  exit 1
fi

echo ""
echo "💡 提示:"
echo "  - 使用 AI 对话: '@app-preview 生成测试环境体验版'"
echo "  - 或手动执行: cd ainative-app && npm run ci:weapp:upload:test"
echo ""
