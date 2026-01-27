# mind2build 开发指南

**文档版本**: v1.3  
**创建日期**: 2025-12-24  
**最后更新**: 2026-01-26（更新Actions数量为30个）

## 1. 开发环境搭建

### 1.1 克隆仓库
```bash
git clone https://github.com/geekan/mind2build.git
cd mind2build
```

### 1.2 Git仓库管理

**重要说明**: 系统使用Git来管理每个生成的项目，所有文档和代码都存储在Git仓库中。

**项目初始化流程**:
1. 创建项目时，可以提供Git仓库地址（GitHub、GitLab、Gitee等）
2. 如果提供仓库地址，系统会自动执行 `git clone` 拉取仓库
3. 如果仓库中已有文档或代码，系统会根据版本号创建新分支（如 `v2`, `v3`）
4. 所有生成的文档和代码会自动提交到对应版本分支

**版本分支管理**:
- 每个版本对应一个Git分支：`v1`, `v2`, `v3`...
- 主分支（`main`）存储最新稳定版本
- 系统自动检测已有版本并创建新分支

**Git操作示例**:
```bash
# 项目初始化时
git clone https://github.com/user/project.git
cd project

# 检查是否存在已有版本
git branch -a | grep "v[0-9]"

# 如果存在v1分支，创建v2分支
git checkout -b v2

# 生成文档和代码后，提交到版本分支
git add .
git commit -m "feat: 生成v2版本文档和代码"
git push origin v2
```

### 1.2 安装 Node.js 和 pnpm

```bash
# macOS
brew install node pnpm

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm

# 验证安装
node --version  # v18+
pnpm --version  # v8+
```

### 1.3 安装依赖

```bash
# 安装所有依赖（monorepo）
pnpm install

# 或单独安装后端依赖
cd backend
pnpm install
```

### 1.4 配置数据库

参考 [21_数据库配置指南_DBSETUP.md](./21_数据库配置指南_DBSETUP.md) 配置 PostgreSQL 数据库。

## 2. 代码规范

### 2.1 格式化

**Prettier**:
```bash
pnpm --filter backend format
```

### 2.2 Lint 检查

**ESLint**:
```bash
pnpm --filter backend lint
```

### 2.3 类型检查

**TypeScript**:
```bash
pnpm --filter backend type-check
```

## 3. 测试

### 3.1 运行测试
```bash
# 所有测试
pnpm --filter backend test

# 特定文件
pnpm --filter backend test tests/roles/Role.test.ts

# 特定测试
pnpm --filter backend test -- -t "test role init"

# 带覆盖率
pnpm --filter backend test -- --coverage
```

### 3.2 编写测试
```typescript
import { describe, it, expect } from '@jest/globals';
import { Role } from '@/roles/Role';

describe('Role', () => {
  it('should initialize correctly', () => {
    const role = new Role({ name: 'Test' });
    expect(role.name).toBe('Test');
  });

  it('should run successfully', async () => {
    const role = new Role();
    const result = await role.run();
    expect(result).not.toBeNull();
  });
});
```

## 4. 目录结构

```
testflow/
├── backend/              # 后端服务（Node.js/TypeScript）
│   ├── src/
│   │   ├── actions/      # 行动实现（30个Actions）
│   │   ├── roles/        # 角色实现
│   │   ├── providers/    # LLM 提供商
│   │   ├── core/         # 核心基础设施
│   │   ├── orchestration/# 编排层
│   │   └── api/          # API层
│   └── tests/            # 测试代码
├── frontend/             # 前端应用（Vue 3）
├── shared/               # 共享代码
├── doc/                  # 文档
└── workspace/            # 生成项目的工作区
```

## 5. 开发工作流

### 5.1 创建分支
```bash
git checkout -b feature/my-feature
```

### 5.2 开发和提交
```bash
# 开发...
git add .
git commit -m "feat: add new feature"
```

### 5.3 推送和 PR
```bash
git push origin feature/my-feature
# 在 GitHub 创建 Pull Request
```

## 6. 调试技巧

### 6.1 日志调试
```typescript
import logger from '@/utils/logger';

logger.debug('Debug message');
logger.info('Info message');
logger.error('Error message');
```

### 6.2 断点调试
```typescript
// 使用 debugger 语句
debugger;

// 或使用 console
console.log('Debug info:', variable);
```

### 6.3 VS Code 调试
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug Backend",
            "type": "node",
            "request": "launch",
            "runtimeExecutable": "pnpm",
            "runtimeArgs": ["--filter", "backend", "dev"],
            "console": "integratedTerminal",
            "sourceMaps": true
        }
    ]
}
```

## 7. 扩展开发 - 创建新角色和 Action

系统采用配置驱动的动态加载架构，添加新角色或 Action 只需修改少量文件，无需改动核心业务代码。

### 7.1 创建新角色

**步骤 1**: 创建角色类文件 `backend/src/roles/NewRole.ts`

```typescript
import { IRoleConfig, ACTION_SOME_WATCH } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { SomeAction } from '../actions/SomeAction';

export class NewRole extends Role {
  constructor(context: Context, name: string = 'NewRole') {
    const config: IRoleConfig = {
      name,
      profile: 'NewRole',
      goal: '角色目标描述',
      constraints: '角色约束条件',
      description: '角色详细描述',
    };
    super(config, context);
    
    // 设置监听的 action（触发条件）
    this.watch([ACTION_SOME_WATCH]);
    
    // 设置角色执行的 actions
    this.setActions([
      new SomeAction(),
    ]);
  }
}

export default NewRole;
```

**步骤 2**: 注册到 `backend/src/roles/index.ts`

```typescript
// 添加 export
export { NewRole } from './NewRole';

// 在 ROLE_REGISTRY 中添加
export const ROLE_REGISTRY = {
  // ... 现有角色
  NewRole,  // 添加这行
};
```

**步骤 3**: 运行数据库迁移

```bash
cd backend
npx ts-node --transpile-only src/database/migrations/init_role_action_definitions.ts
```

### 7.2 创建新 Action

**步骤 1**: 创建 Action 类文件 `backend/src/actions/NewAction.ts`

```typescript
import { BaseAction } from '../core/base/BaseAction';
import { Message } from '../core/message/Message';

export class NewAction extends BaseAction {
  name = 'NewAction';
  description = 'Action 描述';

  async run(context: string, options?: any): Promise<Message> {
    // 实现 Action 逻辑
    const result = await this.aask(context, [
      { role: 'system', content: 'System prompt here' }
    ]);
    
    return new Message({
      content: result,
      role: this.role?.profile || 'Assistant',
      causeBy: this.name,
    });
  }
}
```

**步骤 2**: 注册到 `backend/src/actions/index.ts`

```typescript
// 添加 export
export { NewAction } from './NewAction';

// 在 ACTION_REGISTRY 中添加
export const ACTION_REGISTRY = {
  // ... 现有 actions
  NewAction,  // 添加这行
};
```

**步骤 3**: 运行数据库迁移

```bash
cd backend
npx ts-node --transpile-only src/database/migrations/init_role_action_definitions.ts
```

### 7.3 更新默认工作流

如需将新角色添加到默认工作流，修改 `backend/src/database/migrations/init_role_action_definitions.ts` 中的 `getDefaultWorkflowConfig()` 函数。

### 7.4 架构优势

```
┌─────────────────────────────────────────┐
│  index.ts (ROLE_REGISTRY/ACTION_REGISTRY)│  ← 唯一需要修改的代码文件
├─────────────────────────────────────────┤
│  RoleActionFactory                       │  ← 自动从 REGISTRY 读取
├─────────────────────────────────────────┤
│  Database (role/action_definitions)      │  ← 元数据存储
├─────────────────────────────────────────┤
│  Controllers / Services                  │  ← 无需修改
└─────────────────────────────────────────┘
```

**核心优势**：
- 无需修改 RoleActionController、ProjectController、WorkflowService 等核心业务文件
- 角色和 Action 的类映射集中在 `index.ts`
- 元数据（显示名称、描述等）从数据库读取
- 工作流配置从 `system_default_workflow_templates` 表读取

---

## 8. 贡献指南

### 8.1 提交规范

遵循 Conventional Commits:
```
feat: 新功能
fix: Bug 修复
docs: 文档更新
test: 测试相关
refactor: 重构
style: 代码风格
chore: 其他改动
perf: 性能优化
```

示例：
```bash
git commit -m "feat: add DeepSeek LLM provider support"
git commit -m "fix: correct QA workflow action execution order"
git commit -m "docs: update Actions documentation with QA workflow"
```

### 8.2 代码审查清单
- [ ] 代码通过所有测试
- [ ] 代码符合规范（black/ruff）
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] Commit 信息清晰

## 9. 常用命令

```bash
# 开发模式（后端）
pnpm --filter backend dev

# 开发模式（前端）
pnpm --filter frontend dev

# 格式化代码
pnpm --filter backend format

# 运行测试
pnpm --filter backend test

# 检查代码
pnpm --filter backend lint

# 类型检查
pnpm --filter backend type-check

# 构建
pnpm --filter backend build

# CLI命令
pnpm --filter backend cli generate "Create a todo app"
```

---

**参考**: CONTRIBUTING.md
