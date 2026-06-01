# Mind2Build Backend

Node.js/TypeScript backend for the Mind2Build multi-agent collaboration framework.

## Structure

```
src/
├── core/              # Core infrastructure (Message, Memory, Context)
├── roles/             # 9 AI agent role implementations
├── actions/            # 30 Action implementations
├── providers/          # LLM provider integrations (OpenAI, ZhipuAI, Ark, DeepSeek, Cursor)
├── orchestration/      # Team, Environment, StateManager
├── executors/          # LLMExecutor, CLIExecutor (Aider, Cursor)
├── database/           # Data layer (repositories, migrations)
│   ├── repositories/   # 18+ repositories (Project, Document, SectionConversation, etc.)
│   └── migrations/     # Database schema migrations
├── api/                # REST API routes and controllers
│   ├── controllers/    # 15 API controllers
│   └── routes/         # API route definitions
├── services/           # 10 Services (WorkflowService, RAGService, GitService, etc.)
├── workflow/           # Workflow execution engine
├── cli/                # Command-line interface
├── utils/              # Utility functions (sectionConversationHistory, etc.)
├── types/              # TypeScript type definitions
├── prompts/            # Prompt templates
├── index.ts            # Main exports (programmatic API)
└── server.ts           # Express server entry point
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
pnpm lint:fix

# Database
pnpm db:generate   # Generate Prisma client
pnpm db:migrate    # Run migrations
pnpm db:studio     # Open Prisma Studio
```

## CLI Usage

```bash
# Generate a project
pnpm cli generate "Create a TODO app"

# Check status
pnpm cli status --project-id <id>

# List projects
pnpm cli list
```

## API Usage

Start the server:
```bash
pnpm dev
```

Access at: `http://localhost:3000`

### Endpoints

- `GET /health` - Health check
- `GET /` - API information
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `POST /api/projects/:id/start` - Start project execution
- `GET /api/projects/:id/sections/:sectionNumber/conversation` - Get section conversation history
- See [API Reference](../doc/12_API参考文档_API.md) for complete API documentation

## Configuration

Edit `.env` file:
```env
LLM_PROVIDER=zhipuai
ZHIPUAI_API_KEY=your-api-key
DATABASE_URL=postgresql://...
```

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Architecture

The backend follows a layered architecture:

1. **Infrastructure Layer** - Message, Memory, Context
2. **Provider Layer** - LLM integrations
3. **Action Layer** - 30 concrete actions
4. **Role Layer** - 9 AI agent roles
5. **Orchestration Layer** - Team, Environment, StateManager
6. **Service Layer** - 10 services (WorkflowService, RAGService, GitService, etc.)
7. **Interface Layer** - 15 API controllers and CLI

## Services

The backend includes 10 core services:

1. **WorkflowService** - Workflow configuration and management
2. **RAGService** - RAG with Qdrant vector search, rerank, and hybrid search
3. **EmbeddingService** - Vector embedding generation
4. **QdrantService** - Qdrant vector database integration
5. **RerankService** - Result reranking for improved relevance
6. **RoleActionService** - Role and action management
7. **SectionAdjustService** - PRD/MRD section adjustment with conversation history
8. **StagehandService** - Stagehand integration
9. **DocumentArchiveService** - Document archiving
10. **GitService** - Git repository management with branch and version control

## Features

### Section Conversation History

The backend supports section conversation history for PRD/MRD documents:

- **Database Table**: `section_conversations` - Stores conversation history for document sections
- **API Endpoint**: `GET /api/projects/:id/sections/:sectionNumber/conversation`
- **Utility Functions**: `sectionConversationHistory.ts` - Load, save, and manage conversation history
- **Service Integration**: `SectionAdjustService` uses conversation history for iterative refinement
- **Repository**: `SectionConversationRepository` - Data access layer

**Use Cases**:
- Track section modification history
- Provide context for subsequent adjustments
- Support multi-round iterative optimization
- Track user feedback and AI response correspondence

## Implementation Status

- [x] Phase 1: Project Foundation
- [ ] Phase 2: Core Infrastructure
- [ ] Phase 3: LLM Integration
- [ ] Phase 4: Role System
- [ ] Phase 5: Action System
- [ ] Phase 6: Memory & State
- [ ] Phase 7: Orchestration
- [ ] Phase 8: Database
- [ ] Phase 9: API & CLI

## License

MIT

