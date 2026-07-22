## 1. Types and OpenSpec

- [x] 1.1 Extend `PreparedWorkspace`, `WorkspaceRepo`, preflight/PR types in plugin-api
- [x] 1.2 Delta specs under `changes/multi-repo-spec-workflow/specs/`

## 2. Parse and preflight

- [x] 2.1 `parseMultiRepoDescriptionBlock` and `metadata.repos`
- [x] 2.2 `task-preflight.ts` and `queueTask` integration
- [x] 2.3 Server bootstrap `runPreflight`

## 3. Environment and spec

- [x] 3.1 Multi-repo `environment.ts`
- [x] 3.2 `spec-documents.ts` and `spec-skills.ts`

## 4. Workflow and tooling

- [x] 4.1 Workspace-root `WORKFLOW_PROMPTS` lookup
- [x] 4.2 Execution cwd and variables
- [x] 4.3 `workspace-tooling.ts`

## 5. Quality and PR

- [x] 5.1 Per-repo quality
- [x] 5.2 `pull-request.ts` and `createPullRequests` hook

## 6. Docs

- [x] 6.1 Config, `.env.example`, templates
- [x] 6.2 Archive change and sync narrative docs
