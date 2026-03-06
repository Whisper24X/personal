# Backend 目录结构与技术栈

## 技术栈

- Node.js >= 18, TypeScript
- 框架：Express 或 Fastify
- ES Module, async/await
- 禁止 callback 风格 API

## 目录结构

```
backend/src/
├── actions/            # Action 层
│   ├── WritePRD.ts
│   ├── WriteCode.ts
│   ├── WriteTest.ts
│   └── index.ts
├── api/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   └── helpers/
├── core/
│   ├── base/
│   ├── message/
│   ├── context/
│   └── memory/
├── database/
│   ├── repositories/
│   ├── migrations/
│   └── client.ts
├── orchestration/
│   ├── ProjectManager.ts
│   ├── InteractiveSession.ts
│   └── StateManager.ts
├── providers/llm/
├── prompts/
├── roles/
│   ├── Engineer.ts
│   ├── QAEngineer.ts
│   └── ProductManager.ts
├── services/
├── utils/
├── types/
├── cli/
└── server.ts
```
