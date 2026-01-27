# ainative 项目 Skills 位置说明

## 📍 Skills 文件位置

Skills 文件现在位于项目根目录的 `.cursor/skills/` 文件夹中:

```
/Users/moyan/myWorkPlace/yanxue-main/.cursor/skills/
├── create-ainative-app-page/
│   └── SKILL.md
├── create-ainative-shadow-page/
│   └── SKILL.md
├── create-ainative-backend-api/
│   └── SKILL.md
├── debug-ainative-projects/
│   └── SKILL.md
└── code-review-ainative/
    └── SKILL.md
```

## 🔍 为什么看不到?

`.cursor` 目录是隐藏文件夹(以 `.` 开头),在 Finder 中默认不显示。

### 查看隐藏文件的方法:

**方法 1: 在 Finder 中显示**
- 按快捷键: `Cmd + Shift + .` (英文句号)
- 然后就可以在项目根目录看到 `.cursor` 文件夹了

**方法 2: 在终端中查看**
```bash
cd /Users/moyan/myWorkPlace/yanxue-main
ls -la .cursor/skills/
```

**方法 3: 在 Cursor/VSCode 中查看**
- 直接在文件浏览器中就可以看到 `.cursor` 文件夹
- 点开后可以看到 `skills` 目录

## 📖 如何使用这些 Skills

### 在 AI 对话中引用:

```
@.cursor/skills/create-ainative-app-page/SKILL.md
@.cursor/skills/create-ainative-shadow-page/SKILL.md
@.cursor/skills/create-ainative-backend-api/SKILL.md
@.cursor/skills/debug-ainative-projects/SKILL.md
@.cursor/skills/code-review-ainative/SKILL.md
```

### 或者使用相对路径:

```
@create-ainative-app-page
@create-ainative-shadow-page
@create-ainative-backend-api
@debug-ainative-projects
@code-review-ainative
```

## 📋 Skills 列表

| Skill 名称 | 路径 | 用途 |
|-----------|------|------|
| 创建小程序页面 | `.cursor/skills/create-ainative-app-page/SKILL.md` | 在 Taro 小程序中创建新页面 |
| 创建管理后台页面 | `.cursor/skills/create-ainative-shadow-page/SKILL.md` | 在管理后台中创建 CRUD 页面 |
| 创建后端 API | `.cursor/skills/create-ainative-backend-api/SKILL.md` | 在 Go 后端创建新接口 |
| 调试项目问题 | `.cursor/skills/debug-ainative-projects/SKILL.md` | 全栈调试指南 |
| 代码规范检查 | `.cursor/skills/code-review-ainative/SKILL.md` | 代码质量检查和修复 |

## 💡 备份位置

Skills 也有一份备份在 Cursor 的全局目录:
```
/Users/moyan/.cursor/skills-yanxue/
```

这样即使在其他项目中也可以使用这些 Skills。

## 🚀 快速开始

现在你可以:

1. **在 Cursor 中打开项目**
2. **在文件浏览器中看到 `.cursor/skills/` 文件夹**
3. **在 AI 对话中使用 `@.cursor/skills/xxx/SKILL.md` 引用 Skills**
4. **或者查看 [AI-GUIDE.md](../AI-GUIDE.md) 了解完整使用方法**

---

如果还有问题,请查看 [AI-GUIDE.md](../AI-GUIDE.md) 或 [AI-WORKFLOW-GUIDE.md](../AI-WORKFLOW-GUIDE.md)
