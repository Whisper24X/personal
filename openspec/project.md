# Project Context

## Purpose

AINative Workspace is a monorepo containing a complete full-stack application suite:
- **ainative-app**: WeChat Mini Program application
- **ainative-shadow**: Admin dashboard web application for system management
- **ainative-backend**: Go backend service providing APIs for all frontend applications

The project serves as a business application platform with user authentication, role-based access control, department management, and extensible business modules.

## Tech Stack

### ainative-app (Mobile/Cross-Platform)
- **Framework**: uni-app (based on unibest template v4.3.0)
- **Core**: Vue 3.4 + TypeScript 5.8 + Vite 5.2
- **State Management**: Pinia 2.0 with persisted state
- **HTTP Client**: Alova 3.x with uni-app adapter
- **Styling**: UnoCSS + SCSS
- **UI Components**: wot-design-uni
- **Package Manager**: pnpm 10.x
- **Build Targets**: WeChat Mini Program
- **Code Quality**: ESLint (uni-helper config), Husky, lint-staged

### ainative-shadow (Admin Dashboard)
- **Framework**: Vue 3.5 + TypeScript 5.6 + Vite 7.x
- **UI Library**: Element Plus 2.x
- **Styling**: Tailwind CSS 4.x + SCSS
- **State Management**: Pinia 3.x with persisted state
- **HTTP Client**: Axios 1.x
- **Charts**: ECharts 6.x
- **Rich Text**: WangEditor 5.x
- **Internationalization**: vue-i18n 9.x
- **Code Quality**: ESLint + Prettier + Stylelint
- **Git Workflow**: Husky + Commitizen (cz-git)

### ainative-backend (Go Backend)
- **Language**: Go 1.19
- **Framework**: Kratos v2.7 (go-kratos)
- **ORM**: GORM 1.25 with gen code generation
- **Database**: PostgreSQL (via gorm driver)
- **Cache**: Redis (go-redis v8) + RocksCache for weak consistency caching
- **Dependency Injection**: Google Wire
- **API Protocol**: Protobuf + gRPC + HTTP (grpc-gateway)
- **Authentication**: JWT
- **Message Queue**: RabbitMQ (amqp091-go)
- **Service Discovery**: Nacos
- **Observability**: OpenTelemetry (tracing), Prometheus (metrics)
- **Validation**: protoc-gen-validate
- **Configuration**: Viper (YAML configs)

## Project Conventions

### Code Style

#### TypeScript/Vue (Frontend)
- Use ESLint with project-specific configs (`@uni-helper/eslint-config` for app, standard Vue/TS for shadow)
- Vue SFC block order: `<script>` or `<template>` first, then `<style>`
- Prefer Composition API with `<script setup>` syntax
- Use TypeScript strict mode
- Format with Prettier (shadow) or ESLint formatters (app)
- SCSS for component styles with scoped attribute

#### Go (Backend)
- Follow standard Go conventions (gofmt, goimports)
- Use gci for import grouping
- Use golangci-lint for code quality checks
- Use gosec for security scanning
- Generated code files have `Code generated` or `DO NOT EDIT` headers - never modify directly

### Naming Conventions

#### Files
- **Vue components**: PascalCase (e.g., `TabbarItem.vue`)
- **TypeScript utilities**: camelCase (e.g., `useRequest.ts`)
- **Go files**: snake_case (e.g., `app_v1_auth.go`)
- **Proto files**: snake_case (e.g., `sys_admin.proto`)

#### Code
- **Vue components**: PascalCase
- **TypeScript functions/variables**: camelCase
- **Go exported symbols**: PascalCase
- **Go unexported symbols**: camelCase
- **Database tables**: snake_case with prefix (e.g., `sys_admin`)
- **Proto messages**: PascalCase
- **Proto fields**: snake_case

### Architecture Patterns

#### Backend (Onion Architecture)
```
Server → Service → Biz → Data → Database/Cache
```

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Server | `internal/server/` | HTTP/gRPC server, middleware, routing |
| Service | `internal/service/` | Protocol translation, calls Biz layer |
| Biz | `internal/biz/` | Business logic, UseCase, defines Repository interfaces |
| Data | `internal/data/` | Implements Repository, database/cache/RPC access |

**Key principles**:
- Dependency flows inward (outer layers depend on inner)
- Biz layer defines interfaces, Data layer implements them (dependency inversion)
- Business logic stays in Biz layer, not in Service or Data
- Use Wire for dependency injection

#### Frontend (Component-Based)
- **Pages**: `src/pages/` (app) or `src/views/` (shadow)
- **Components**: Global in `src/components/`, local in page directories
- **State**: Pinia stores in `src/store/` (shadow) or `src/stores/` (app)
- **API**: HTTP layer in `src/http/` or `src/utils/http/`, API definitions in `src/api/`
- **Routing**: Convention-based (app) or file-based modules (shadow)

### Testing Strategy

#### Backend
- Unit tests alongside implementation files (`*_test.go`)
- `make lint` for static analysis (golangci-lint)
- `make gosec` for security scanning
- API testing via Apifox integration

#### Frontend
- Type checking: `pnpm type-check`
- Lint checking: `pnpm lint`
- Manual testing on WeChat Mini Program

### Git Workflow

#### Commit Conventions
Uses Conventional Commits with the following types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no logic change)
- `refactor`: Code refactoring (no feature/fix)
- `perf`: Performance improvement
- `test`: Test changes
- `build`: Build system changes
- `ci`: CI configuration changes
- `revert`: Revert previous commit
- `chore`: Maintenance tasks
- `wip`: Work in progress

Use `pnpm commit` (shadow) for interactive commit or standard git with proper message format.

#### Branch Strategy
- `master`: Production-ready code
- `pre/v*.*.*`: Pre-release branches (created via `make new-pre-branch` in backend)
- Feature branches: `feat/description` or `feature/description`
- Fix branches: `fix/description`

## Domain Context

### User Management
- **SysAdmin**: System administrators with role-based permissions
- **User**: End users of the mobile application
- **UserWx**: WeChat-linked user accounts

### Permission System
- Role-based access control (RBAC)
- Hierarchical department structure (SysDept)
- Permission assignments via SysRolePermission
- Two access modes in shadow: frontend (local routes) or backend (API-driven menus)

### Data Logging
- Operation logs (SysOperationLog) for audit trails
- Data change logs (SysDataLog) for tracking modifications

## Important Constraints

### Technical Constraints
- Backend requires Go 1.19+
- Frontend projects require Node.js 20+
- ainative-app requires pnpm 9+; ainative-shadow requires pnpm 8.8.0+
- Proto files must be formatted with `buf format`
- Generated code must not be manually modified
- Wire must be regenerated after adding new dependencies (`make wire`)

### Build Constraints
- App uses `@dcloudio/uni-app` for cross-platform compilation
- Backend builds static binary with musl libc support
- Private GitLab packages require `GOPRIVATE=gitlab.yc345.tv/*`

### Code Generation Workflow (Backend)
1. Design database tables → `make gorm TABLES=xxx`
2. Generate proto from SQL → `make sqltopb {shadow|app} table1,table2`
3. Modify proto as needed → `make api`
4. Generate skeleton code → `make protocode`
5. Implement business logic
6. Update DI → `make wire`

## External Dependencies

### Services
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage
- **RabbitMQ**: Message queue for async processing
- **Nacos**: Service discovery and configuration center

### APIs & Tools
- **Apifox**: API documentation and testing
- **Yapi**: Alternative API documentation
- **yc_turbo_kit**: Internal code generation and tooling

### Internal Libraries (GitLab)
- `gitlab.yc345.tv/backend/go-logger`: Structured logging
- `gitlab.yc345.tv/backend/orm-gen/v2`: GORM code generation
- `gitlab.yc345.tv/backend/utils/v2`: Common utilities
- `gitlab.yc345.tv/backend/yccrypt/go`: Encryption utilities
- `gitlab.yc345.tv/security-and-payment/tracing`: Distributed tracing

## Development Commands Quick Reference

### ainative-app
```bash
pnpm dev:weapp     # WeChat Mini Program development
pnpm build:weapp   # Build WeChat Mini Program
pnpm lint:fix      # Fix lint issues
pnpm type-check    # TypeScript type checking
```

### ainative-shadow
```bash
pnpm dev           # Development server
pnpm build         # Production build
pnpm fix           # Fix lint issues
pnpm commit        # Interactive commit
pnpm lint:stylelint # Lint styles
```

### ainative-backend
```bash
make init          # Install Go tools
make api           # Generate API code from proto
make wire          # Generate dependency injection
make gorm TABLES=x # Generate GORM code for table
make protocode     # Generate data/biz/service from proto
make sqltopb       # Convert SQL to proto
make build         # Build binary
make lint          # Run linter
make gosec         # Security scanning
make help          # Show all commands
```
