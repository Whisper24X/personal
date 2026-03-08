# Installation

This project currently uses [TypeORM](https://www.npmjs.com/package/typeorm) with [PostgreSQL](https://www.postgresql.org/) as the default database stack.

The database layer follows [Hexagonal Architecture](architecture.md#hexagonal-architecture).

---

## Table of Contents <!-- omit in toc -->

- [Comfortable development (PostgreSQL + TypeORM)](#comfortable-development-postgresql--typeorm)
  - [Video guideline (PostgreSQL + TypeORM)](#video-guideline-postgresql--typeorm)
- [Quick run (PostgreSQL + TypeORM)](#quick-run-postgresql--typeorm)
- [Links](#links)

---

## Comfortable development (PostgreSQL + TypeORM)

1. Clone repository

   ```bash
   git clone --depth 1 https://github.com/brocoders/nestjs-boilerplate.git my-app
   ```

1. Go to folder, and copy `env-example.development` as `.env.development`.

   ```bash
   cd my-app/
   cp env-example.development .env.development
   ```

   For other environments, copy `env-example.test` -> `.env.test` or
   `env-example.production` -> `.env.production`.

1. Change `DATABASE_HOST=postgres` to `DATABASE_HOST=localhost`
1. Run additional container:

   ```bash
   docker compose --env-file .env.development up -d postgres adminer
   ```

1. Install dependency

   ```bash
   npm install
   ```

1. Run migrations

   ```bash
   npm run migration:run
   ```

1. Run seeds

   ```bash
   npm run seed:run:relational
   ```

1. Run app in dev mode

   **需要同时启动 API 和 Worker**（任务执行由 Worker 负责）：

   ```bash
   # 终端 1 - API 服务
   npm run start:dev

   # 终端 2 - Worker 进程（执行任务节点）
   npm run start:worker:dev
   ```

1. Open <http://localhost:3000>

### Video guideline (PostgreSQL + TypeORM)

<https://github.com/user-attachments/assets/136a16aa-f94a-4b20-8eaf-6b4262964315>

---

## Quick run (PostgreSQL + TypeORM)

If you want quick run your app, you can use following commands:

1. Clone repository

   ```bash
   git clone --depth 1 https://github.com/brocoders/nestjs-boilerplate.git my-app
   ```

1. Go to folder, and copy `env-example.development` as `.env.development`.

   ```bash
   cd my-app/
   cp env-example.development .env.development
   ```

1. Run containers

   ```bash
   docker compose --env-file .env.development up -d
   ```

1. For check status run

   ```bash
   docker compose --env-file .env.development logs
   ```

1. Open <http://localhost:3000>

---

## Links

- Swagger (API docs): <http://localhost:3000/docs>
- Adminer (client for DB): <http://localhost:8080>

---

Previous: [Introduction](introduction.md)

Next: [Architecture](architecture.md)
