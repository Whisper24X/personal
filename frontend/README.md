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
├── components/    # Reusable components
├── router/        # Vue Router configuration
├── stores/        # Pinia stores
├── views/         # Page components
├── App.vue        # Root component
├── main.ts        # Application entry point
└── style.css      # Global styles
```

## Features

- ✅ Project dashboard
- ✅ Create new projects
- ✅ View project details and progress
- ✅ Real-time status updates
- ✅ View generated documents
- ✅ Message flow visualization
- ✅ Cost tracking

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

