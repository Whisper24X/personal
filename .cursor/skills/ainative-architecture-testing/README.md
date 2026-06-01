# ainative-architecture-testing

合并技能：**功能模块图** + **无 PRD 核心用例 / 测试策略** + **XMind Zen 导出**，面向 AINative 仓库及同构 monorepo。

## 内容

| 文件 | 说明 |
|------|------|
| `SKILL.md` | 代理主规范（YAML frontmatter + 三部分工作流） |
| `reference.md` | 路径索引、框架速查、与子技能关系 |

## 使用方式

- **在本仓库**：可与 `.agents/skills/project-functional-map`、`xmind-zen-export` 并存；需要「一条技能覆盖架构+测试+脑图」时优先加载本目录。
- **复制到其他项目**：将整个 `ainative-architecture-testing/` 拷入目标仓库根目录或 `.cursor/skills/`，按需改 `reference.md` 中的路径。
- **skills.sh**：可将本目录作为独立 Git 仓库根发布（以 `SKILL.md` 为入口）。

## 许可证

沿用父仓库许可证。
