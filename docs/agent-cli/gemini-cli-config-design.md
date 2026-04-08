# Gemini CLI Configuration Design

This document describes the **actual** Gemini CLI configuration design used in this project.

Scope:

- business-line Gemini CLI configurations
- backend argument compilation in `AgentRunnerService`
- frontend defaults and interactions in the Gemini configuration modal

Out of scope:

- Codex / Claude / Cursor / OpenCode configuration design
- workflow prompt template design
- Gemini interactive TUI workflows

## 1. Goals

The Gemini CLI refactor follows the same rules as the other headless CLI adapters:

1. frontend fields must match backend-effective fields
2. the project continues to use Gemini in headless mode
3. free-form passthrough fields are removed

Because of that, Gemini configuration is now modeled around real flags from `gemini --help`, instead of legacy fields such as `base_command_override` or `additional_params`.

## 2. Current Configuration Model

The persisted Gemini `configJson` now uses this shape:

```ts
type GeminiCliConfig = {
  model?: string | null
  sandbox?: boolean | null
  yolo?: boolean | null
  approval_mode?: 'default' | 'auto_edit' | 'yolo' | 'plan' | null
  policy?: string[] | null
  allowed_mcp_server_names?: string[] | null
  extensions?: string[] | null
  env?: Record<string, string> | null
}
```

These fields fall into three groups.

### 2.1 Direct CLI flags

- `model`
- `sandbox`
- `yolo`
- `approval_mode`
- `policy`
- `allowed_mcp_server_names`
- `extensions`

### 2.2 Environment variables

- `env`

This is used to inject extra environment variables into the Gemini child process.

### 2.3 Runtime continuation

Session continuation is not part of static business-line config anymore.

That means:

- when a task node already has `agentCliSessionId`, the platform appends `--resume`
- business-line config no longer owns `resume`

## 3. Defaults

When the frontend creates a new Gemini configuration, it defaults to:

```text
yolo = true
```

This is the highest-permission execution mode exposed by the Gemini CLI and maps to:

```text
--yolo
```

`approval_mode` is hidden and cleared when `yolo=true`.

## 4. CLI Compilation

The backend compiles Gemini config into a fixed headless command shape:

```text
gemini --output-format stream-json
```

Why this base is fixed:

- `--output-format stream-json` is required by the platform log parser
- prompt content is still written through stdin by the runner

### 4.1 Field-to-flag mapping

| Config field | CLI flag |
| --- | --- |
| `model` | `--model <value>` |
| `sandbox=true` | `--sandbox` |
| `yolo=true` | `--yolo` |
| `approval_mode` | `--approval-mode <value>` |
| `policy` | `--policy <item>` per item |
| `allowed_mcp_server_names` | `--allowed-mcp-server-names <item>` per item |
| `extensions` | `--extensions <item>` per item |

### 4.2 Priority rule for permissions

When:

```text
yolo = true
```

the backend emits:

```text
--yolo
```

and ignores `approval_mode`.

This keeps one clear highest-permission mode instead of mixing two approval expressions.

### 4.3 Example

Configuration:

```json
{
  "model": "gemini-2.5-pro",
  "sandbox": true,
  "yolo": false,
  "approval_mode": "plan",
  "policy": ["/tmp/policy-a", "/tmp/policy-b"],
  "allowed_mcp_server_names": ["figma", "filesystem"],
  "extensions": ["git", "web"],
  "env": {
    "HTTP_PROXY": "http://127.0.0.1:7890"
  }
}
```

Compiled command:

```text
gemini \
  --output-format stream-json \
  --model gemini-2.5-pro \
  --sandbox \
  --approval-mode plan \
  --policy /tmp/policy-a \
  --policy /tmp/policy-b \
  --allowed-mcp-server-names figma \
  --allowed-mcp-server-names filesystem \
  --extensions git \
  --extensions web
```

And `HTTP_PROXY=http://127.0.0.1:7890` is injected into the child process environment.

## 5. Removed Legacy Fields

These fields are intentionally no longer part of Gemini business-line config:

- `append_prompt`
- `resume`
- `base_command_override`
- `additional_params`

Reasons:

### 5.1 They do not belong to static startup config

- `append_prompt`
- `resume`

Prompt composition and session continuation are runtime concerns, not stable business-line defaults.

### 5.2 They break platform control boundaries

- `base_command_override`
- `additional_params`

Those fields effectively turn structured config back into unrestricted command construction, which makes defaults, safety rules, and future upgrades harder to maintain.

## 6. Frontend Behavior

The Gemini config modal enforces these rules:

- `yolo` defaults to enabled
- `approval_mode` is hidden when `yolo` is enabled
- saving with `yolo=true` clears `approval_mode`
- high-permission mode shows a warning message

## 7. Implementation

The current implementation lives in:

- `backend/src/agent-execution/runner-agent-execution.service.ts`
- `backend/src/tasks/agent-runner.service.spec.ts`
- `frontend/src/components/business/settings/modals/AgentToolConfigModal.vue`
- `frontend/src/components/business/settings/__tests__/AgentToolConfigModal.spec.ts`

## 8. Extension Rules

If Gemini configuration is extended later, use this order:

1. confirm that `gemini --help` exposes a real flag first
2. prefer one-to-one CLI fields over platform-only fields
3. only re-introduce higher-level prompt/session abstractions if the project later adds a separate Gemini protocol layer
