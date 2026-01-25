# Changelog

All notable changes to Mind2Build will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added ✨

#### Frontend Features
- **Business Line Management** - Organize projects by business lines (applications)
- **Platform Management** - Manage platforms within business lines
- **Workflow Kanban View** - Visual workflow execution with kanban board
- **Knowledge Base UI** - Manage and search knowledge base documents
- **System Configuration Panel** - Unified configuration interface for LLM, Roles, and Prompts
- **Dashboard Statistics** - Overview of business lines, platforms, and completion status

#### Backend Services
- **WorkflowService** - Workflow configuration and management service
- **RAGService** - Enhanced RAG with Qdrant vector search, rerank, and hybrid search
- **EmbeddingService** - Vector embedding generation service
- **QdrantService** - Qdrant vector database integration
- **RerankService** - Result reranking for improved relevance
- **RoleActionFactory** - Dynamic role and action factory from database
- **RoleActionService** - Role and action management service
- **SectionAdjustService** - PRD/MRD section adjustment with conversation history
- **StagehandService** - Stagehand integration service
- **DocumentArchiveService** - Document archiving service
- **GitService** - Git repository management service

#### Executors
- **LLMExecutor** - LLM-based action execution
- **CLIExecutor** - CLI-based execution with support for Aider and Cursor providers

#### API Enhancements
- **Application Management API** - Full CRUD for applications (business lines)
- **Application Workflow API** - Workflow management per application
- **Workflow Execution API** - Complete workflow lifecycle management (start, pause, resume, reset, recover)
- **Knowledge Base API** - Document management and search
- **Knowledge Upload API** - File upload for knowledge base
- **Configuration API** - LLM, Role LLM, and Prompt configuration management
- **Role Action Management API** - Role and action metadata management

#### Database Schema V2
- **Unified LLM Configs** - Single table for all LLM configurations (provider and role-specific)
- **Application Workflows** - Workflow configuration per application
- **Workflow Executions** - Workflow execution state management
- **Knowledge Base Table** - Database-backed knowledge base
- **Section Conversations** - Conversation history for section adjustments

### Changed

- **Database Schema** - Migrated to Schema V2 with simplified structure
- **State Management** - Unified state management through StateManager
- **Workflow Execution** - New workflow execution engine with state persistence
- **Frontend Architecture** - Reorganized views by business domain (businessLine, platform, knowledge, config)

### Technical Details

- **9 Roles**: Salesperson, ProductManager, Architect, ProjectManager, Engineer, QAEngineer, AutomationEngineer, TeamLeader, DataAnalyst
- **30 Actions**: Complete action set covering document writing, review, improvement, code execution, QA workflows
- **Multiple LLM Providers**: OpenAI, ZhipuAI, Ark (Doubao), DeepSeek, Cursor Agent
- **Vector Search**: Qdrant integration with embedding and rerank support
- **Workflow Engine**: Stateful workflow execution with recovery and rollback support

## [1.4.0] - 2026-01-15

### Added ✨

#### State Management System Refactoring
- **Unified State Manager** - Complete refactoring of state management system
  - **StateManager as single entry point** - All state read/write operations must go through StateManager
  - **Database as single source of truth** - Removed all in-memory state, unified database management
  - **RoleContext state unification** - state and todo stored in database `interactive_session_running_state` table
  - **State synchronization mechanism** - Executor syncs state and todo from database to RoleContext memory
  - **StepwiseDocumentGenerator integration** - Integrated StateManager for step state management with reset() support
  - **Enhanced rollback mechanism** - Complete rollback flow including task stopping, state reset, message clearing, and step state reset
  - **Sequential execution guarantee** - Based on database `role_order` and `action_order` fields
  - **Database migrations** - Added `step_state` table and `role_context_state` field migrations

- **New Backend Files**:
  - `backend/src/orchestration/StateManager.ts` - Unified state manager (core component)
  - `backend/src/orchestration/StepStateTracker.ts` - Step state tracker (internal implementation)

### Changed

- **Removed WorkflowTracker** - All WorkflowTracker functionality integrated into StateManager
- **BaseAction, BaseRole** - Refactored to use StateManager for all state operations
- **SessionWorkflowExecutor** - Refactored to use StateManager, removed direct database access
- **InteractiveSession** - Refactored to use StateManager for state management
- **StepwiseDocumentGenerator** - Integrated StateManager for step state management
- **RoleContext** - State and todo now stored in database, synced to memory by executor

### Technical Details

- All components (Role, Action, StepwiseDocumentGenerator) now use StateManager for state operations
- Direct Repository or database access is prohibited
- State consistency guaranteed by StateManager
- All state changes logged through StateManager
- Support for interrupt and rollback operations

## [1.3.0] - 2025-12-26

### Added ✨

#### Role Action Execution API
- **Standalone role action execution** - Execute specific role actions independently without running the full workflow
  - POST `/api/projects/:projectId/roles/:roleProfile/actions/:actionName/execute` endpoint
  - Support for all role actions: WritePRD, WriteDesign, WriteCode, WriteTest, and more
  - Flexible input methods: custom input, context messages, or auto-load from project history
  - Automatic context loading based on action requirements
  - Workspace options for document organization
  - Complete error handling and timeout control (default 10 minutes)
  - Results automatically saved to project history

- **New Backend Files**:
  - `backend/src/api/controllers/RoleActionExecutionController.ts` - Role action execution controller
  - `backend/src/services/RoleActionFactory.ts` - Dynamic role and action factory
  - `backend/src/services/RoleActionService.ts` - Role and action management service

- **New API Routes**:
  - `POST /api/projects/:projectId/roles/:roleProfile/actions/:actionName/execute` - Execute role action

#### RAG Service Enhancement
- **Vector search with Qdrant** - Enhanced RAG service with vector database support
  - Qdrant vector database integration for semantic search
  - Rerank service for result relevance improvement
  - Hybrid search (keyword + vector) support
  - Automatic document indexing
  - Knowledge base document management
  - Multiple embedding provider support (OpenAI, ZhipuAI, ARK)
  - Graceful degradation to text similarity when vector search unavailable

- **New Backend Files**:
  - `backend/src/services/EmbeddingService.ts` - Embedding generation service
  - `backend/src/services/QdrantService.ts` - Qdrant vector database service
  - `backend/src/services/RerankService.ts` - Result reranking service

### Changed

- **projects.ts**: Added role action execution route
- **RoleActionFactory**: Dynamic role and action creation from database configuration
- **RAGService**: Enhanced with vector search, rerank, and hybrid query capabilities

### Documentation

- Updated README with Role Action Execution API examples
- Added API documentation for standalone role action execution

## [1.2.0] - 2025-12-25

### Added ✨

#### Web Interactive Mode
- **Web UI interactive confirmation** - Beautiful browser interface for manual review
  - Interactive project generation page with real-time progress
  - Interactive confirmation component with 6 user actions
  - WebSocket-based real-time communication
  - Live statistics and progress tracking
  - Keyboard shortcuts support
  - Responsive design for all devices

- **New Frontend Files**:
  - `frontend/src/components/InteractiveConfirmation.vue` - Confirmation component
  - `frontend/src/views/ProjectInteractive.vue` - Interactive generation page

- **New Backend Files**:
  - `backend/src/orchestration/InteractiveSession.ts` - Session management
  - `backend/src/orchestration/InteractiveSessionManager.ts` - Multi-session manager
  - `backend/src/api/routes/interactive.ts` - REST API endpoints
  - `backend/src/api/websocket.ts` - WebSocket server setup

### Changed

- **ProjectCreate.vue**: Added mode selection (Auto/Interactive)
- **server.ts**: Integrated WebSocket server with HTTP server
- **router/index.ts**: Added interactive project route
- **routes/index.ts**: Integrated interactive routes

### Documentation

- Created comprehensive Web Interactive Mode guide
- Updated README with Web UI usage examples
- Created frontend implementation summary

### Technical Features

- WebSocket full-duplex communication
- Session isolation and management
- Auto-expiration (30 minutes timeout)
- Periodic cleanup (5 minutes interval)
- Graceful shutdown handling
- Real-time progress updates
- In-browser content editing
- Connection state monitoring

## [1.1.0] - 2025-12-25

### Added ✨

#### Interactive Mode
- **Interactive confirmation mode** - Manual review and confirmation at each SOP step
  - Users can now pause at each role completion to review output
  - Support for 6 user actions: continue, edit, regenerate, view, skip, quit
  - Content preview with full content view option
  - Editor integration (supports $EDITOR environment variable)
  - Interaction history tracking and session summary
  - CLI parameter: `--interactive` / `-i`

- **New Files**:
  - `backend/src/utils/InteractiveHandler.ts` - Core interactive logic
  - `doc/22_交互模式使用指南_INTERACTIVE.md` - Complete usage guide
  - `INTERACTIVE_MODE_IMPLEMENTATION.md` - Implementation summary
  - `backend/tests/interactive.test.ts` - Unit tests
  - `examples/interactive-mode-example.sh` - Demo script

### Changed

- **Team.ts**: Added interactive mode support with `InteractiveHandler` integration
- **Environment.ts**: Split execution into parallel (auto) and sequential (interactive) modes
- **generate.ts**: Enhanced CLI command with interactive mode display
- **CLI index.ts**: Added `--interactive` parameter
- **Types**: Added `InteractiveMode`, `IGenerateOptions`, and workflow config

### Documentation

- Updated PRD with US-2.2.3 (Interactive confirmation requirement)
- Added interactive mode sequence diagrams
- Added user operation reference tables
- Updated README with interactive mode examples
- Created comprehensive interactive mode guide

### Technical Details

- Interactive mode runs roles sequentially for user confirmation
- Automatic mode maintains original parallel execution
- Backward compatible - no impact when interactive mode is not enabled
- Supports content modification via external editor
- Graceful error handling for editor failures and user quit

## [1.0.0] - 2025-12-24

### Added

#### Core Features
- Multi-agent collaboration framework
- Role system (ProductManager, Architect, Engineer)
- Action system (WritePRD, WriteDesign, WriteCode)
- Message routing and communication
- Memory system (short-term, long-term, working memory)
- Cost management and budget tracking

#### LLM Support
- OpenAI integration
- Zhipu AI integration
- LLM provider factory pattern

#### User Interfaces
- CLI tool with generate command
- REST API server
- Vue 3 web dashboard
- PostgreSQL database integration

#### Documentation
- Complete technical specification (19 documents)
- Architecture design
- API reference
- Development guide
- Database design

### Infrastructure
- TypeScript monorepo with pnpm workspaces
- Shared types package
- Logger system
- Configuration management
- Database migrations

---

## Version History

### Version Naming Convention

- **Major.Minor.Patch** (e.g., 1.1.0)
  - **Major**: Breaking changes or major feature releases
  - **Minor**: New features, backward compatible
  - **Patch**: Bug fixes, minor improvements

### Roadmap

#### v1.2.0 (Completed ✅)
- [x] State persistence and recovery for interactive mode
- [x] Custom interaction checkpoints
- [x] Diff display for content changes
- [x] API support for interactive mode
- [x] Web UI for interactive mode

#### v1.3.0 (Completed ✅)
- [x] Role Action Execution API
- [x] Enhanced RAG with vector search (Qdrant)
- [x] Rerank service for result relevance
- [x] Hybrid search support

#### v1.4.0 (Completed ✅)
- [x] Unified State Management System refactoring
- [x] StateManager as single entry point
- [x] Database as single source of truth
- [x] Enhanced rollback mechanism
- [x] StepwiseDocumentGenerator integration

#### v1.5.0 (Planned)
- [ ] Real-time collaboration
- [ ] Review comments and annotations
- [ ] Enhanced RAG with more providers
- [ ] Advanced role action debugging tools

#### v2.0.0 (Future)
- [ ] Plugin marketplace
- [ ] Community role library
- [ ] Multi-modal support
- [ ] Advanced AI-assisted review

---

**Legend**:
- ✨ New feature
- 🐛 Bug fix
- 📝 Documentation
- 🔧 Configuration
- ⚡ Performance improvement
- 🔒 Security fix
- 💥 Breaking change

