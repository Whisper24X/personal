# Mind2Build (即思即成)

**Slogan**: 让所思，即所得 (Let Your Thoughts Become Reality)

Mind2Build is a multi-agent AI collaboration framework that simulates a software company team to automatically generate complete software projects from simple ideas.

## 🌟 Features

- **Multi-Agent Collaboration**: AI agents (ProductManager, Architect, Engineer) work together like a real team
- **Complete Project Generation**: From idea to PRD, design documents, and working code
- **Interactive Mode** ✨: Manual review and confirmation at each SOP step for better control
  - **CLI Interactive Mode**: Terminal-based with editor integration
  - **Web Interactive Mode**: Beautiful browser interface with real-time updates
- **Multiple LLM Support**: OpenAI, Anthropic Claude, Zhipu AI, and more
- **Cost Management**: Budget tracking and limits to control LLM usage
- **Web Interface**: Vue 3-based dashboard with WebSocket support
- **CLI Tool**: Command-line interface for quick project generation
- **Database Persistence**: PostgreSQL storage for all projects and messages

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
ax/
├── backend/          # Node.js/TypeScript backend
│   ├── src/
│   │   ├── core/            # Message, Memory, Context, Base classes
│   │   ├── roles/           # AI agent roles
│   │   ├── actions/         # Agent actions
│   │   ├── providers/       # LLM providers
│   │   ├── orchestration/   # Team & Environment
│   │   ├── database/        # Data layer
│   │   ├── api/             # REST API
│   │   └── cli/             # CLI commands
│   └── tests/
├── frontend/         # Vue 3 + Vite frontend
│   └── src/
├── database/         # Prisma schema and migrations
├── shared/           # Shared TypeScript types
└── workspace/        # Generated projects
```

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

```javascript
// Create a project
const response = await fetch('http://localhost:3000/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    idea: 'Create a blog platform with user authentication'
  })
});

const project = await response.json();
console.log('Project ID:', project.id);
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

