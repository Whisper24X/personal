# Mind2Build (即思即成)

**Slogan**: 让所思，即所得 (Let Your Thoughts Become Reality)

Mind2Build is a multi-agent AI collaboration framework that simulates a software company team to automatically generate complete software projects from simple ideas.

## 🌟 Features

- **Multi-Agent Collaboration**: 9 AI agents (Salesperson, ProductManager, Architect, ProjectManager, Engineer, QAEngineer, AutomationEngineer, TeamLeader, DataAnalyst) work together like a real team
- **Complete Project Generation**: From idea to MRD, PRD, design documents, and working code
- **30 Actions**: Comprehensive action system covering document writing, review, improvement, code execution, QA workflows, and more
- **Interactive Mode** ✨: Manual review and confirmation at each SOP step for better control
  - **CLI Interactive Mode**: Terminal-based with editor integration
  - **Web Interactive Mode**: Beautiful browser interface with real-time updates
- **Business Line & Platform Management**: Organize projects by business lines and platforms
- **Knowledge Base System**: RAG-enhanced retrieval with Qdrant vector database support
- **Section Conversation History**: Track and manage conversation history for document sections (PRD/MRD) to enable iterative refinement
- **Workflow Management**: Customizable workflows with visual designer
- **Git Repository Integration**: Automatic Git repository management with version branch support
- **Multiple LLM Support**: OpenAI, Zhipu AI, Ark (Doubao), DeepSeek, Cursor Agent, and more
- **Cost Management**: Budget tracking and limits to control LLM usage
- **Web Interface**: Vue 3-based dashboard with WebSocket support
- **CLI Tool**: Command-line interface for quick project generation
- **Database Persistence**: PostgreSQL storage for all projects, messages, and configurations

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│        User Interface Layer             │  CLI, Web UI, API
├─────────────────────────────────────────┤
│        Orchestration Layer              │  Team, Environment
├─────────────────────────────────────────┤
│        Role Layer                       │  ProductManager, Architect, Engineer
├─────────────────────────────────────────┤
│        Action Layer                     │  WritePRD, WriteDesign, WriteCode
├─────────────────────────────────────────┤
│        Infrastructure Layer             │  Message, Memory, Context
├─────────────────────────────────────────┤
│        Provider Layer                   │  LLM, Tools
└─────────────────────────────────────────┘
```

## 🚀 Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup guide.

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 14
- LLM API Key (Zhipu AI or OpenAI)

### 5-Minute Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API key

# 3. Setup database
createdb mind2build
pnpm db:migrate

# 4. Try it out!
pnpm --filter backend cli generate "Create a TODO app" --output my-todo-app
```

### Web Interface

```bash
# Terminal 1 - Start backend
pnpm dev:backend

# Terminal 2 - Start frontend
pnpm dev:frontend

# Open http://localhost:5173
```

## 📦 Project Structure

```
mind2build/
├── backend/          # Node.js/TypeScript backend
│   ├── src/
│   │   ├── core/            # Message, Memory, Context, Base classes
│   │   ├── roles/           # 9 AI agent roles
│   │   ├── actions/         # 30 agent actions
│   │   ├── providers/       # LLM providers (OpenAI, ZhipuAI, Ark, Cursor, DeepSeek)
│   │   ├── orchestration/   # Team, Environment, StateManager
│   │   ├── executors/       # LLMExecutor, CLIExecutor (Aider, Cursor)
│   │   ├── database/        # PostgreSQL repositories and migrations
│   │   ├── api/             # 15 REST API controllers: ApplicationController, ApplicationWorkflowController, EngineerTestController, KnowledgeBaseController, KnowledgeUploadController, LLMConfigController, MRDController, PRDController, ProjectController, ProjectVersionController, PromptConfigController, RoleActionController, RoleActionExecutionController, RoleLLMConfigController, WorkflowExecutionController
│   │   ├── services/        # 10 Services: WorkflowService, RAGService, GitService, DocumentArchiveService, RoleActionService, EmbeddingService, QdrantService, RerankService, SectionAdjustService, StagehandService
│   │   ├── workflow/        # Workflow execution engine
│   │   └── cli/             # CLI commands
│   └── tests/
├── frontend/         # Vue 3 + Vite frontend
│   └── src/
│       ├── views/           # Dashboard, BusinessLine, Platform, Knowledge, Config
│       ├── components/      # InteractiveConfirmation, WorkflowKanban, etc.
│       ├── stores/          # Pinia state management
│       └── router/          # Vue Router configuration
├── shared/           # Shared TypeScript types and constants
└── workspace/        # Generated projects
```

## 🔌 扩展开发 - 创建新角色和 Action

系统采用配置驱动的动态加载架构，添加新角色或 Action 只需修改少量文件，无需改动核心业务代码。

### 创建新角色 (Role)

**步骤 1**: 创建角色类文件 `backend/src/roles/NewRole.ts`

```typescript
import { IRoleConfig, ACTION_SOME_TRIGGER } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { SomeAction } from '../actions/SomeAction';

export class NewRole extends Role {
  constructor(context: Context, name: string = 'NewRole') {
    const config: IRoleConfig = {
      name,
      profile: 'NewRole',           // 角色唯一标识
      goal: '角色目标描述',
      constraints: '角色约束条件',
      description: '角色详细描述',
    };
    super(config, context);
    
    // 设置监听的 action（触发条件）
    this.watch([ACTION_SOME_TRIGGER]);
    
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
  NewRole,  // 添加新角色
};
```

**步骤 3**: 运行数据库迁移添加角色定义

```bash
# 创建迁移脚本或直接运行初始化
cd backend
npx ts-node --transpile-only src/database/migrations/init_role_action_definitions.ts
```

### 创建新 Action

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
  NewAction,  // 添加新 action
};
```

**步骤 3**: 运行数据库迁移添加 Action 定义

```bash
cd backend
npx ts-node --transpile-only src/database/migrations/init_role_action_definitions.ts
```

### 更新默认工作流

修改 `backend/src/database/migrations/init_role_action_definitions.ts` 中的 `getDefaultWorkflowConfig()` 函数，将新角色添加到默认工作流中。

### 架构优势

- **核心文件零修改**: Controller、Service 等核心业务文件无需改动
- **集中注册**: 角色和 Action 的类映射集中在 `index.ts`
- **数据库驱动**: 元数据（显示名称、描述等）从数据库读取
- **动态加载**: 工作流配置从 `system_default_workflow_templates` 表读取

## 🛠️ Development

```bash
# Run backend only
pnpm dev:backend

# Run frontend only
pnpm dev:frontend

# Run tests
pnpm test

# Lint and fix
pnpm lint:fix

# Build for production
pnpm build

# Database commands
pnpm db:generate   # Generate Prisma client
pnpm db:migrate    # Run migrations
pnpm db:studio     # Open Prisma Studio
```

### Production Deployment with PM2

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Build the project first
pnpm build

# Start all services in production mode
pnpm pm2:start

# Or start with specific environment
pm2 start ecosystem.config.js --env production
pm2 start ecosystem.config.js --env development

# Start only backend or frontend
pm2 start ecosystem.config.js --only mind2build-backend
pm2 start ecosystem.config.js --only mind2build-frontend

# Management commands
pnpm pm2:stop      # Stop all services
pnpm pm2:restart   # Restart all services
pnpm pm2:reload    # Zero-downtime reload
pnpm pm2:delete    # Delete all services
pnpm pm2:logs      # View logs
pnpm pm2:monit     # Monitor resources
pnpm pm2:status    # Check status

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
pm2 save
```

**PM2 Configuration Features:**
- ✅ Automatic restart on crash
- ✅ Memory limit monitoring (1GB backend, 500MB frontend)
- ✅ Log rotation and management
- ✅ Environment-specific configurations
- ✅ Graceful shutdown support
- ✅ Zero-downtime reload for backend

## 📚 Documentation

### Getting Started
- [Quick Start Guide](./QUICKSTART.md)
- [CLI Interactive Mode Guide](./doc/22_交互模式使用指南_INTERACTIVE.md) ✨
- [Web Interactive Mode Guide](./doc/23_前端交互模式实现指南_FRONTEND_INTERACTIVE.md) ✨

### Implementation Summaries
- [Backend Interactive Implementation](./INTERACTIVE_MODE_IMPLEMENTATION.md)
- [Frontend Interactive Implementation](./FRONTEND_INTERACTIVE_IMPLEMENTATION.md)

### Technical Documentation
- [Implementation Plan](./mind2build-implementation.plan.md)
- [Architecture](./doc/04_系统架构文档_ARCHITECTURE.md)
- [Database Design](./doc/18_数据库设计_DATABASE.md)
- [API Reference](./doc/12_API参考文档_API.md)
- [Development Guide](./doc/14_开发指南_DEVELOPMENT.md)

## 🎯 Usage Example

### CLI

```bash
# Generate a project (automatic mode)
mind2build generate "Create a 2048 game with React" --output ./game-2048

# Generate with interactive mode (manual confirmation at each step) ✨
mind2build generate "Create a blog API" --interactive --output ./blog-api

# Short form with all options
mind2build generate "Create a TODO app" -i -o ./todo-app -b 10.0 -r 5

# Check project status
mind2build status --project-id <id>

# List all projects
mind2build list
```

### Interactive Mode Example ✨

```bash
$ mind2build generate "Create a calculator" -i -o ./calculator

🎯 [ProductManager] 完成 WritePRD

📋 内容预览:
# Calculator - 产品需求文档
...

🛑 等待确认 (c=继续, e=编辑, r=重新生成, v=查看全文, s=跳过, q=退出): c
✅ 继续下一步

🎯 [Architect] 完成 WriteDesign

📋 内容预览:
# Calculator - 系统设计文档
...

🛑 等待确认: e
📝 正在打开编辑器...
✅ 已保存修改，继续下一步

🎯 [Engineer] 完成 WriteCode

📋 内容预览:
Generated files:
- src/calculator.js
- src/index.html
...

🛑 等待确认: c
✅ 继续下一步

✅ Project generation completed!
```

**Interactive Mode Commands:**
- `c` / `continue` - Accept and continue
- `e` / `edit` - Open editor to modify
- `r` / `regenerate` - Regenerate current output
- `v` / `view` - View full content
- `s` / `skip` - Skip current step
- `q` / `quit` - Save and exit

See [Interactive Mode Guide](./doc/22_交互模式使用指南_INTERACTIVE.md) for CLI details.

### Web Interactive Mode ✨

Access the web interface at `http://localhost:5173`:

1. **Create Project**
   - Click "Create New Project"
   - Fill in project details
   - Select "Interactive Mode"
   - Click "Create and Start Project"

2. **Interactive Generation**
   - View real-time progress timeline
   - When a role completes, review the output
   - Choose your action:
     - **Continue** (C) - Accept and proceed
     - **Edit** (E) - Modify content inline
     - **Regenerate** (R) - Request new output
     - **View** (V) - See full content
     - **Skip** (S) - Skip this step
     - **Quit** (Q) - Save and exit

3. **Completion**
   - View execution summary with statistics
   - Download generated files
   - Review project details

**Features**:
- 🎨 Beautiful visual interface
- ⚡ Real-time WebSocket updates
- ⌨️ Keyboard shortcuts
- 📊 Live statistics and progress tracking
- 💾 Auto-save on interruption

See [Frontend Interactive Guide](./doc/23_前端交互模式实现指南_FRONTEND_INTERACTIVE.md) for technical details.

### API

#### Application & Workflow Management API

Manage business lines (applications) and their workflows:

```bash
# Create application
POST /api/applications
{
  "name": "E-commerce Platform",
  "description": "Online shopping platform"
}

# Get application workflows
GET /api/applications/:applicationId/workflows

# Create custom workflow
POST /api/applications/:applicationId/workflows
{
  "name": "Custom Workflow",
  "workflowConfig": { ... }
}
```

#### Workflow Execution API

Control workflow execution lifecycle:

```bash
# Start workflow
POST /api/workflow/:projectId/start

# Get workflow state
GET /api/workflow/:projectId/state

# Confirm and proceed (interactive mode)
POST /api/workflow/:projectId/confirm

# Reset to specific role
POST /api/workflow/:projectId/reset

# Pause/Resume workflow
POST /api/workflow/:projectId/pause
POST /api/workflow/:projectId/resume
```

#### Role Action Execution API ✨

Independently execute specific role actions without running the full workflow:

```bash
# Execute a specific action for a role
curl -X POST http://localhost:3000/api/projects/PROJECT_ID/roles/ProductManager/actions/WritePRD/execute \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Create a task management app with team collaboration features"
  }'

# Auto-load context from project history
curl -X POST http://localhost:3000/api/projects/PROJECT_ID/roles/Engineer/actions/WriteCode/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceOptions": {
      "applicationId": "my-app",
      "version": 1
    }
  }'
```

**Supported Roles & Actions:**

- **Salesperson**: WriteMRD, MRDReview, ImproveMRD
- **ProductManager**: WritePRD, PRDReview, ImprovePRD, SearchEnhancedQA
- **Architect**: WriteDesign, DesignReview, ImproveDesign
- **ProjectManager**: BreakdownTasks, WriteSubProjectDesign, SubProjectDesignReview
- **Engineer**: WriteCode, ExecuteSubtask, RunCode, FixBug
- **QAEngineer**: TestabilityReview, WriteTestPlan, WriteTest, TestCaseReview, TestReview, ImproveTest
- **AutomationEngineer**: AutomationPlanning, AutomationExecution, CoverageQualityCheck, QAConclusion
- **TeamLeader**: Coordinate
- **DataAnalyst**: DataAnalysis

**Total: 9 Roles, 30 Actions**

**Features:**
- ✅ Execute any role action independently
- ✅ Flexible input methods (custom input, context messages, auto-load from history)
- ✅ Automatic context loading based on action requirements
- ✅ Workspace options for document organization
- ✅ Complete error handling (timeout handled by individual actions)
- ✅ Results automatically saved to project history

#### Standard API

```javascript
// Create a project
const response = await fetch('http://localhost:3000/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Blog Platform',
    idea: 'Create a blog platform with user authentication',
    applicationId: 'app-id',  // Optional: associate with application
    investment: 10.0,
    nRound: 5,
    gitRepositoryUrl: 'https://github.com/user/blog-platform.git'  // Optional: Git repository URL
  })
});

const project = await response.json();
console.log('Project ID:', project.project.id);

// Create a project version (with Git branch)
await fetch(`http://localhost:3000/api/projects/${project.project.id}/versions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'v1.0',
    description: 'Initial version'
  })
});

// Start project execution
await fetch(`http://localhost:3000/api/projects/${project.project.id}/start`, {
  method: 'POST'
});

// Get project status
const status = await fetch(`http://localhost:3000/api/projects/${project.project.id}`);
const data = await status.json();
console.log('Status:', data.project.status);
```

#### Knowledge Base API

```javascript
// Create knowledge base document
POST /api/projects/:projectId/knowledge-base
{
  "title": "API Design Guidelines",
  "content": "...",
  "tags": ["api", "design"]
}

// Search knowledge base
POST /api/projects/:projectId/knowledge-base/search
{
  "query": "payment module design",
  "topK": 5
}
```

#### Configuration API

```javascript
// LLM Configuration
GET /api/config/llm
POST /api/config/llm
POST /api/config/llm/:id/activate

// Role-specific LLM Configuration
GET /api/config/role-llm/:profile
POST /api/config/role-llm/:profile

// Prompt Configuration
GET /api/config/prompts
POST /api/config/prompts

// Role and Action Metadata
GET /api/config/roles
GET /api/config/actions
GET /api/config/roles-actions
```

#### Project Version & Git Management API

```javascript
// Create project version (automatically creates Git branch)
POST /api/projects/:projectId/versions
{
  "name": "v1.0",
  "description": "Initial version"
}

// List project versions
GET /api/projects/:projectId/versions

// Get Git branches
GET /api/projects/:projectId/branches

// Activate a version
POST /api/projects/:projectId/versions/:versionId/activate
```

### Programmatic

```typescript
import { Team, ProductManager, Architect, Engineer, Context } from 'mind2build';

const ctx = new Context();
const team = new Team(ctx);

team.hire([
  new ProductManager(),
  new Architect(),
  new Engineer()
]);

team.invest(10.0); // $10 budget

await team.run('Create a TODO app', 5); // 5 rounds max
```

## 🔧 Configuration

### LLM Providers

Edit `.env` to configure your LLM provider:

```env
# Use Zhipu AI
LLM_PROVIDER=zhipuai
ZHIPUAI_API_KEY=your-api-key

# Or use OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### Database

Configure PostgreSQL connection:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mind2build?schema=public"
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Inspired by [mind2build](https://github.com/geekan/mind2build)
- Built with Node.js, TypeScript, Vue 3, and PostgreSQL

## 📧 Contact

For questions and support, please open an issue on GitHub.

