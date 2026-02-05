#!/bin/bash
# 小程序 CI 环境检查脚本
# 用于诊断小程序 CI 配置问题

set -e

# 颜色定义
C_RESET="\033[0m"
C_RED="\033[31m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_BLUE="\033[34m"
C_CYAN="\033[36m"
C_BOLD="\033[1m"

# 图标
ICON_OK="✓"
ICON_FAIL="✗"
ICON_WARN="⚠"
ICON_INFO="ℹ"

echo ""
echo -e "${C_CYAN}${C_BOLD}========================================${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}   小程序 CI 环境检查工具${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}========================================${C_RESET}"
echo ""

# 统计
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# 检查函数
check_item() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    local status=$1
    local message=$2
    local detail=$3
    
    if [ "$status" = "ok" ]; then
        echo -e "${C_GREEN}${ICON_OK} ${message}${C_RESET}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    elif [ "$status" = "fail" ]; then
        echo -e "${C_RED}${ICON_FAIL} ${message}${C_RESET}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    elif [ "$status" = "warn" ]; then
        echo -e "${C_YELLOW}${ICON_WARN} ${message}${C_RESET}"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
    else
        echo -e "${C_BLUE}${ICON_INFO} ${message}${C_RESET}"
    fi
    
    if [ -n "$detail" ]; then
        echo -e "  ${C_RESET}${detail}${C_RESET}"
    fi
}

# 1. 检查工作目录
echo -e "${C_YELLOW}[1/8] 检查工作目录${C_RESET}"
if [ -d "ainative-app" ]; then
    check_item "ok" "当前在正确的工作目录（yanxue-main）"
else
    check_item "fail" "不在项目根目录" "请在 yanxue-main/ 目录下运行此脚本"
    exit 1
fi
echo ""

# 2. 检查 ainative-app 目录
echo -e "${C_YELLOW}[2/8] 检查小程序目录${C_RESET}"
if [ -d "ainative-app/src" ]; then
    check_item "ok" "小程序源代码目录存在"
else
    check_item "fail" "小程序源代码目录不存在" "请先执行: make subtree-pull-app"
fi
echo ""

# 3. 检查配置文件
echo -e "${C_YELLOW}[3/8] 检查配置文件${C_RESET}"

# 测试环境配置
if [ -f "ainative-app/ci.test.config.js" ]; then
    check_item "ok" "测试环境配置存在 (ci.test.config.js)"
    
    # 读取配置
    APPID_TEST=$(grep WEAPP_APPID ainative-app/ci.test.config.js | cut -d'"' -f2 2>/dev/null || echo "")
    KEY_PATH_TEST=$(grep WEAPP_PRIVATE_KEY_PATH ainative-app/ci.test.config.js | cut -d'"' -f2 2>/dev/null || echo "")
    
    if [ -n "$APPID_TEST" ]; then
        check_item "info" "  测试环境 AppID: $APPID_TEST"
    fi
else
    check_item "fail" "测试环境配置不存在" "缺少: ainative-app/ci.test.config.js"
fi

# 生产环境配置
if [ -f "ainative-app/ci.config.js" ]; then
    check_item "ok" "生产环境配置存在 (ci.config.js)"
    
    # 读取配置
    APPID_PROD=$(grep WEAPP_APPID ainative-app/ci.config.js | cut -d'"' -f2 2>/dev/null || echo "")
    KEY_PATH_PROD=$(grep WEAPP_PRIVATE_KEY_PATH ainative-app/ci.config.js | cut -d'"' -f2 2>/dev/null || echo "")
    
    if [ -n "$APPID_PROD" ]; then
        check_item "info" "  生产环境 AppID: $APPID_PROD"
    fi
else
    check_item "fail" "生产环境配置不存在" "缺少: ainative-app/ci.config.js"
fi
echo ""

# 4. 检查私钥文件
echo -e "${C_YELLOW}[4/8] 检查私钥文件${C_RESET}"

# 测试环境私钥
if [ -n "$KEY_PATH_TEST" ]; then
    if [ -f "ainative-app/$KEY_PATH_TEST" ]; then
        check_item "ok" "测试环境私钥存在"
        
        # 检查文件权限
        if [ "$(uname)" = "Darwin" ] || [ "$(uname)" = "Linux" ]; then
            PERMS=$(stat -f "%A" "ainative-app/$KEY_PATH_TEST" 2>/dev/null || stat -c "%a" "ainative-app/$KEY_PATH_TEST" 2>/dev/null || echo "")
            if [ -n "$PERMS" ]; then
                check_item "info" "  文件权限: $PERMS"
            fi
        fi
        
        # 检查文件格式
        if grep -q "BEGIN PRIVATE KEY" "ainative-app/$KEY_PATH_TEST" 2>/dev/null; then
            check_item "ok" "  私钥格式正确 (PEM)"
        else
            check_item "warn" "  私钥格式可能有问题" "请确认文件包含 '-----BEGIN PRIVATE KEY-----'"
        fi
    else
        check_item "fail" "测试环境私钥不存在" "路径: ainative-app/$KEY_PATH_TEST"
    fi
fi

# 生产环境私钥
if [ -n "$KEY_PATH_PROD" ]; then
    if [ -f "ainative-app/$KEY_PATH_PROD" ]; then
        check_item "ok" "生产环境私钥存在"
        
        # 检查文件格式
        if grep -q "BEGIN PRIVATE KEY" "ainative-app/$KEY_PATH_PROD" 2>/dev/null; then
            check_item "ok" "  私钥格式正确 (PEM)"
        else
            check_item "warn" "  私钥格式可能有问题" "请确认文件包含 '-----BEGIN PRIVATE KEY-----'"
        fi
    else
        check_item "fail" "生产环境私钥不存在" "路径: ainative-app/$KEY_PATH_PROD"
    fi
fi

# 检查 key 目录
if [ ! -d "ainative-app/key" ]; then
    check_item "warn" "key 目录不存在" "建议创建: mkdir -p ainative-app/key"
fi
echo ""

# 5. 检查 package.json
echo -e "${C_YELLOW}[5/8] 检查 package.json${C_RESET}"
if [ -f "ainative-app/package.json" ]; then
    check_item "ok" "package.json 存在"
    
    # 检查 CI 相关依赖
    if grep -q "@tarojs/plugin-mini-ci" "ainative-app/package.json"; then
        check_item "ok" "  Taro CI 插件已安装"
    else
        check_item "warn" "  Taro CI 插件未安装" "可能需要: pnpm add -D @tarojs/plugin-mini-ci"
    fi
    
    if grep -q "miniprogram-ci" "ainative-app/package.json"; then
        check_item "ok" "  miniprogram-ci 已安装"
    else
        check_item "warn" "  miniprogram-ci 未安装" "可能需要: pnpm add -D miniprogram-ci"
    fi
    
    # 检查 CI 脚本
    if grep -q "ci:weapp:preview" "ainative-app/package.json"; then
        check_item "ok" "  CI 预览脚本已配置"
    else
        check_item "warn" "  CI 预览脚本未配置"
    fi
else
    check_item "fail" "package.json 不存在"
fi
echo ""

# 6. 检查 Taro 配置
echo -e "${C_YELLOW}[6/8] 检查 Taro 配置${C_RESET}"
if [ -f "ainative-app/config/index.ts" ]; then
    check_item "ok" "Taro 配置文件存在"
    
    if grep -q "@tarojs/plugin-mini-ci" "ainative-app/config/index.ts"; then
        check_item "ok" "  CI 插件已配置"
    else
        check_item "warn" "  CI 插件未配置" "请检查 config/index.ts 中的 plugins 配置"
    fi
else
    check_item "fail" "Taro 配置文件不存在" "缺少: ainative-app/config/index.ts"
fi
echo ""

# 7. 检查 pnpm
echo -e "${C_YELLOW}[7/8] 检查环境依赖${C_RESET}"
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    check_item "ok" "pnpm 已安装 (版本: $PNPM_VERSION)"
else
    check_item "warn" "pnpm 未安装" "小程序项目使用 pnpm 管理依赖"
fi

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_item "ok" "Node.js 已安装 (版本: $NODE_VERSION)"
else
    check_item "fail" "Node.js 未安装" "请先安装 Node.js"
fi
echo ""

# 8. 检查微信开发者工具
echo -e "${C_YELLOW}[8/8] 检查微信开发者工具${C_RESET}"

# macOS
if [ "$(uname)" = "Darwin" ]; then
    if [ -d "/Applications/wechatwebdevtools.app" ]; then
        check_item "ok" "微信开发者工具已安装"
        
        # 检查 CLI 工具
        if [ -f "/Applications/wechatwebdevtools.app/Contents/MacOS/cli" ]; then
            check_item "ok" "  CLI 工具可用"
        fi
    else
        check_item "warn" "未检测到微信开发者工具" "部分功能可能无法使用"
    fi
else
    check_item "info" "无法自动检测微信开发者工具（非 macOS 系统）"
fi

# 检查服务端口（通过尝试连接）
if nc -z 127.0.0.1 27183 2>/dev/null; then
    check_item "ok" "  微信开发者工具服务端口已开启"
elif nc -z 127.0.0.1 27184 2>/dev/null; then
    check_item "ok" "  微信开发者工具服务端口已开启"
else
    check_item "warn" "  微信开发者工具服务端口未开启或工具未运行" "请在开发者工具中开启"设置 → 安全 → 服务端口""
fi
echo ""

# 总结
echo -e "${C_CYAN}${C_BOLD}========================================${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}   检查结果总结${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}========================================${C_RESET}"
echo ""
echo -e "总共检查项: ${C_BOLD}$TOTAL_CHECKS${C_RESET}"
echo -e "通过: ${C_GREEN}${C_BOLD}$PASSED_CHECKS${C_RESET}"
echo -e "警告: ${C_YELLOW}${C_BOLD}$WARNING_CHECKS${C_RESET}"
echo -e "失败: ${C_RED}${C_BOLD}$FAILED_CHECKS${C_RESET}"
echo ""

# 给出建议
if [ $FAILED_CHECKS -gt 0 ]; then
    echo -e "${C_RED}${ICON_FAIL} 存在关键问题，请先解决失败项${C_RESET}"
    echo ""
    echo -e "${C_YELLOW}常见解决方案：${C_RESET}"
    echo "  1. 配置私钥: 从微信公众平台下载私钥文件"
    echo "  2. 创建 key 目录: mkdir -p ainative-app/key"
    echo "  3. 拉取代码: make subtree-pull-app"
    echo ""
    echo -e "📖 详细文档: ${C_CYAN}docs/小程序CI验证指南.md${C_RESET}"
    echo ""
    exit 1
elif [ $WARNING_CHECKS -gt 0 ]; then
    echo -e "${C_YELLOW}${ICON_WARN} 存在一些警告，建议处理后使用${C_RESET}"
    echo ""
    echo -e "📖 详细文档: ${C_CYAN}docs/小程序CI验证指南.md${C_RESET}"
    echo ""
    exit 0
else
    echo -e "${C_GREEN}${ICON_OK} 所有检查通过！可以开始使用小程序 CI${C_RESET}"
    echo ""
    echo -e "${C_CYAN}快速开始：${C_RESET}"
    echo -e "  ${C_GREEN}make app-preview${C_RESET}      生成预览二维码"
    echo -e "  ${C_GREEN}make app-upload-test${C_RESET}  上传测试环境"
    echo ""
    echo -e "📖 查看更多命令: ${C_CYAN}make help${C_RESET}"
    echo ""
    exit 0
fi
