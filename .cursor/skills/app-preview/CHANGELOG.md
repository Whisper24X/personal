# app-preview 技能更新日志

所有关于 app-preview 技能的重要变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [1.0.0] - 2025-02-05

### 新增

#### 核心功能
- ✨ 创建 app-preview 技能，用于生成 ainative-app 小程序体验版
- 🎯 支持多环境部署（test、stage、production）
- 🔧 自动验证 CI 配置和私钥文件
- 📦 集成 Taro CI 插件和 miniprogram-ci

#### 文档
- 📝 SKILL.md - 核心技能指南（230 行，符合最佳实践）
- 📖 README.md - 完整使用说明和环境配置
- 🚀 QUICKSTART.md - 5 分钟快速入门指南
- 📚 references/ci-config.md - CI 配置详解
- 🔍 references/troubleshooting.md - 故障排查指南
- 💡 references/examples.md - 13 个实际使用场景示例

#### 工具
- 🧪 test.sh - 环境检查脚本
  - 检查配置文件
  - 验证私钥文件
  - 检查依赖安装
  - 验证 Node 环境

### 技术细节

#### 支持的环境
- test: 测试环境（ci.test.config.js）
- stage: 预发环境（ci.config.js）
- production: 生产环境（ci.config.js）

#### 配置文件
- ci.config.js - 生产/预发环境配置
- ci.test.config.js - 测试环境配置
- key/*.key - 小程序上传私钥

#### 依赖要求
- Node.js >= 16.x
- npm >= 8.x
- @tarojs/plugin-mini-ci ^4.0.12
- miniprogram-ci 1.9.17

### 设计原则

1. **简洁优先**
   - SKILL.md 保持在 500 行以内（实际 230 行）
   - 核心流程清晰明了
   - 使用渐进式文档披露

2. **安全第一**
   - 私钥文件不提交到仓库
   - 配置文件安全管理
   - 环境隔离建议

3. **易于使用**
   - 提供 AI 对话示例
   - 提供手动命令参考
   - 包含环境检查工具

4. **完善文档**
   - 快速入门指南
   - 详细配置说明
   - 故障排查方案
   - 实际使用案例

### 使用场景

本技能适用于以下场景：

1. **日常开发测试**
   - 开发完成后生成体验版
   - 真机验证功能
   - 快速迭代测试

2. **团队协作**
   - 提测前验证
   - 团队成员体验
   - 产品经理验收

3. **版本发布**
   - 预发环境验证
   - 生产环境体验版
   - 紧急修复发布

4. **CI/CD 集成**
   - 自动化构建上传
   - 版本管理
   - 发布流程

### 触发条件

AI Agent 会在以下情况自动应用此技能：

- 用户提到"体验版"
- 用户提到"预览版"
- 用户说"上传小程序"
- 用户说"生成体验版"
- 用户说"发布测试版本"

### 技能关系

| 技能 | 关系 | 说明 |
|------|------|------|
| create-ainative-app-page | 前置 | 页面开发完成后生成体验版验证 |
| app-dev | 前置 | 开发完成后生成体验版 |
| code-review-ainative | 前置 | 代码审查通过后生成体验版 |
| debug-ainative-projects | 并行 | 体验版中发现问题时调试 |

### 文件结构

```
.cursor/skills/app-preview/
├── SKILL.md                      # 主技能文档（230 行）
├── README.md                      # 完整使用说明
├── QUICKSTART.md                  # 快速入门指南
├── CHANGELOG.md                   # 本文件
├── test.sh                        # 环境检查脚本
└── references/
    ├── ci-config.md              # CI 配置详解
    ├── troubleshooting.md        # 故障排查
    └── examples.md               # 使用示例
```

### 质量指标

- ✅ SKILL.md 230 行（远低于 500 行建议）
- ✅ 描述清晰，包含 WHAT 和 WHEN
- ✅ 采用第三人称描述
- ✅ 参考文档分层清晰
- ✅ 包含可执行的验证脚本
- ✅ 提供 13 个实际使用场景
- ✅ 故障排查覆盖全面

### 参考资料

- [Taro 官方文档](https://taro-docs.jd.com/)
- [Taro CI 插件文档](https://taro-docs.jd.com/docs/plugin-mini-ci)
- [微信小程序 CI 文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)
- [miniprogram-ci NPM](https://www.npmjs.com/package/miniprogram-ci)
- [Create Skill 指南](~/.cursor/skills-cursor/create-skill/SKILL.md)

### 贡献者

- AI Agent - 技能创建和文档编写
- 基于 create-skill 最佳实践

---

## 待办事项

### 计划中的功能

- [ ] 支持多平台（支付宝小程序、H5）
- [ ] 集成二维码自动生成和保存
- [ ] 版本发布记录自动化
- [ ] 支持自定义构建参数
- [ ] 集成钉钉/企微通知

### 文档改进

- [ ] 添加视频教程
- [ ] 添加常见问题 FAQ
- [ ] 添加性能优化建议
- [ ] 添加版本回滚指南

### 工具增强

- [ ] 创建交互式配置向导
- [ ] 添加版本号自动递增工具
- [ ] 集成 Git hooks
- [ ] 创建 VSCode 插件

---

## 反馈和建议

如果你在使用过程中有任何问题或建议，欢迎：

1. 在项目中提出 Issue
2. 直接修改技能文档
3. 与团队成员讨论改进方案

---

**感谢使用 app-preview 技能！** 🎉
