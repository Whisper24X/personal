# Changelog

All notable changes to Mind2Build will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

#### v1.2.0 (Planned)
- [ ] State persistence and recovery for interactive mode
- [ ] Custom interaction checkpoints
- [ ] Diff display for content changes
- [ ] API support for interactive mode

#### v1.3.0 (Planned)
- [ ] Web UI for interactive mode
- [ ] Real-time collaboration
- [ ] Review comments and annotations

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

