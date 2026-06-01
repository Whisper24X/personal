# Mind2Build Frontend

Vue 3 + Vite frontend for Mind2Build AI project generator.

## Tech Stack

- **Vue 3** - Progressive JavaScript framework
- **Vite** - Next generation frontend tooling
- **TypeScript** - Typed JavaScript
- **Vue Router** - Official router for Vue.js
- **Pinia** - State management
- **Axios** - HTTP client

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Project Structure

```
src/
├── api/           # API client and services
├── assets/        # Static assets
├── components/    # Reusable components (InteractiveConfirmation, WorkflowKanban, etc.)
│   └── common/    # Common components (CardHeader, EmptyState, PageHeader, StatCard)
├── router/        # Vue Router configuration
├── stores/        # Pinia stores (project, workflow, knowledge, config)
├── views/         # Page components
│   ├── businessLine/  # Business line management views
│   ├── platform/      # Platform management views
│   ├── knowledge/     # Knowledge base views
│   ├── config/        # Configuration views
│   ├── dashboard/    # Dashboard views
│   └── project/       # Project management views
├── utils/         # Utility functions (errorHandler, polling)
├── config/        # Configuration files
├── App.vue        # Root component
├── main.ts        # Application entry point
└── style.css      # Global styles
```

## Features

- ✅ Project dashboard with statistics
- ✅ Business line and platform management
- ✅ Create new projects with interactive mode support
- ✅ View project details and progress
- ✅ Real-time status updates via WebSocket
- ✅ View generated documents (MRD, PRD, Design, Code)
- ✅ Message flow visualization
- ✅ Cost tracking and budget management
- ✅ Workflow kanban view
- ✅ Knowledge base management UI
- ✅ System configuration panel (LLM, Roles, Prompts)
- ✅ Interactive confirmation component for workflow steps

## Environment Variables

Create `.env.local`:

```env
VITE_API_URL=http://localhost:3000/api
```

## Development Server

The dev server runs on `http://localhost:5173` and proxies API requests to the backend at `http://localhost:3000`.

## Building for Production

```bash
pnpm build
```

Output will be in the `dist/` directory.

## Browser Support

- Chrome >= 87
- Firefox >= 78
- Safari >= 14
- Edge >= 88

