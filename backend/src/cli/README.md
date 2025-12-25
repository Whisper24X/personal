# Mind2Build CLI

Command-line interface for Mind2Build AI multi-agent project generator.

## Installation

```bash
# From backend directory
pnpm cli <command>

# Or install globally (future)
npm install -g mind2build
mind2build <command>
```

## Commands

### generate

Generate a complete project from an idea:

```bash
pnpm cli generate "Create a TODO app with React and Node.js"
```

Options:
- `-o, --output <directory>` - Output directory for generated files
- `-b, --budget <amount>` - Maximum budget in USD (default: 10.0)
- `-r, --rounds <number>` - Maximum execution rounds (default: 5)

Examples:

```bash
# Basic generation (output to console)
pnpm cli generate "Create a 2048 game"

# Save to directory
pnpm cli generate "Create a blog platform" --output my-blog

# With custom budget and rounds
pnpm cli generate "Create an e-commerce site" -o shop -b 20 -r 10
```

### status

Check project generation status (requires API server):

```bash
pnpm cli status <project-id>
```

### list

List all projects (requires API server):

```bash
pnpm cli list
```

## Examples

### Example 1: Simple TODO App

```bash
pnpm cli generate "Create a TODO app with user authentication" \
  --output todo-app \
  --budget 5
```

This will:
1. Create PRD with user stories and requirements
2. Design system architecture and database schema
3. Generate complete source code
4. Save all files to `workspace/todo-app/`

### Example 2: Complex Project

```bash
pnpm cli generate "Create a real-time chat application with WebSocket support, user presence, and message history" \
  --output chat-app \
  --budget 15 \
  --rounds 8
```

## Output

The CLI generates the following files:
- `PRD.md` - Product Requirements Document
- `DESIGN.md` - System Design Document
- Source code files in appropriate directories

## Environment Variables

Create a `.env` file:

```env
LLM_PROVIDER=zhipuai
ZHIPUAI_API_KEY=your-api-key
MAX_BUDGET=10.0
MAX_RETRY=3
```

## Troubleshooting

### Budget Exhausted

If you see "Budget exhausted", increase the budget:

```bash
pnpm cli generate "your idea" --budget 20
```

### Connection Errors

Check your LLM API key in `.env`:

```env
ZHIPUAI_API_KEY=your-valid-api-key
```

### Generation Quality

For better results:
- Be specific in your idea description
- Increase rounds for complex projects
- Provide more budget for detailed generation

