# Database

## Table of Contents <!-- omit in toc -->

- [About databases](#about-databases)
- [Working with database schema (TypeORM)](#working-with-database-schema-typeorm)
  - [Generate migration](#generate-migration)
  - [Run migration](#run-migration)
  - [Revert migration](#revert-migration)
  - [Drop all tables in database](#drop-all-tables-in-database)
- [Performance optimization (PostgreSQL + TypeORM)](#performance-optimization-postgresql--typeorm)
  - [Indexes and Foreign Keys](#indexes-and-foreign-keys)
  - [Max connections](#max-connections)
- [Switch PostgreSQL to MySQL](#switch-postgresql-to-mysql)

---

## About databases

This project currently uses PostgreSQL with TypeORM as the default database stack.

The database layer follows [Hexagonal Architecture](architecture.md#hexagonal-architecture).

## Working with database schema (TypeORM)

### Generate migration

1. Create entity file with extension `.entity.ts`. For example `post.entity.ts`:

   ```ts
   // /src/posts/infrastructure/persistence/relational/entities/post.entity.ts

   import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
   import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

   @Entity()
   export class Post extends EntityRelationalHelper {
     @PrimaryGeneratedColumn()
     id: number;

     @Column()
     title: string;

     @Column()
     body: string;

     // Here any fields that you need
   }
   ```

1. Next, generate migration file:

   ```bash
   npm run migration:generate -- src/database/migrations/CreatePostTable
   ```

1. Apply this migration to database via [npm run migration:run](#run-migration).

### Run migration

```bash
npm run migration:run
```

### Revert migration

```bash
npm run migration:revert
```

### Drop all tables in database

```bash
npm run schema:drop
```

---

## Performance optimization (PostgreSQL + TypeORM)

### Indexes and Foreign Keys

Don't forget to create `indexes` on the Foreign Keys (FK) columns (if needed), because by default PostgreSQL [does not automatically add indexes to FK](https://stackoverflow.com/a/970605/18140714).

### Max connections

Set the optimal number of [max connections](https://node-postgres.com/apis/pool) in your active env file (for example `/.env.development`):

```txt
DATABASE_MAX_CONNECTIONS=100
```

You can think of this parameter as how many concurrent database connections your application can handle.

## Switch PostgreSQL to MySQL

If you want to use `MySQL` instead of `PostgreSQL`, you can make the changes after following the complete guide given [here](installing-and-running.md).

Once you have completed all the steps, you should have a running app.
![image](https://github.com/user-attachments/assets/ec60b61a-65e6-43e2-9bcf-72dad4c8a9fa)

If you've made it this far, it only requires a few changes to switch from `PostgreSQL` to `MySQL`.

**Change your active env file (for example `.env.development`) to the following:**

```env
DATABASE_TYPE=mysql
# set "localhost" if you are running app on local machine
# set "mysql" if you are running app on docker
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USERNAME=root
DATABASE_PASSWORD=secret
DATABASE_NAME=app
```

**Change the `docker-compose.yml` to the following:**

```yml
services:
  mysql:
    image: mysql:9.2.0
    ports:
      - ${DATABASE_PORT}:3306
    volumes:
      - mysql-boilerplate-db:/var/lib/mysql
    environment:
      MYSQL_USER: ${DATABASE_USERNAME}
      MYSQL_PASSWORD: ${DATABASE_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DATABASE_PASSWORD}
      MYSQL_DATABASE: ${DATABASE_NAME}

  # other services here...

volumes:
  # other volumes here...
  mysql-boilerplate-db:
```

After completing the above setup, run Docker with the following command:

```bash
docker compose up -d mysql adminer
```

All services should be running as shown below:

![image](https://github.com/user-attachments/assets/73e10325-66ed-46ca-a0c5-45791ef0750f)

Once your services are up and running, you're almost halfway through.

Now install the MySQL client:

```bash
npm i mysql2 --save
```

**Delete the existing migration file and generate a new one with the following script:**

```bash
npm run migration:generate -- src/database/migrations/newMigration --pretty=true
```

Run migrations:

```bash
npm run migration:run
```

Run the app in dev mode:

```bash
npm run start:dev
```

Open <http://localhost:3000>

To set up Adminer:

Open the running port in your browser.
Open <http://localhost:8080>

![image](https://github.com/user-attachments/assets/f4b86daa-d93f-4ae9-a9e3-3c29bb3bba9d)

Running App:
![image](https://github.com/user-attachments/assets/5dc0609d-5f6d-4176-918d-1744906f4f88)
![image](https://github.com/user-attachments/assets/ff2201a6-d834-4c8b-9ab7-b9413a0a95c1)

---

Previous: [Command Line Interface](cli.md)

Next: [Auth](auth.md)
