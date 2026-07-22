import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "./database";

describe("SQLite database adapter", () => {
  let workspaceDir: string;

  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), "diting-sqlite-adapter-"));
  });

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true });
  });

  it("binds Postgres-style indexed placeholders through node:sqlite", async () => {
    const { pool } = withDatabaseFile(join(workspaceDir, "adapter.sqlite"), () => createDatabase());
    try {
      await pool.query("create table items (id text primary key, name text not null)");
      await pool.query("insert into items (id, name) values ($2, $1)", ["first", "item-1"]);

      const byId = await pool.query("select id, name from items where id = $1", ["item-1"]);
      const repeated = await pool.query(
        "select id, name from items where id = $1 or name = $1",
        ["item-1"]
      );

      expect(byId.rows).toEqual([{ id: "item-1", name: "first" }]);
      expect(repeated.rows).toEqual([{ id: "item-1", name: "first" }]);
    } finally {
      await pool.end();
    }
  });
});

function withDatabaseFile<T>(databaseFile: string, factory: () => T): T {
  const previous = process.env.DATABASE_FILE;
  process.env.DATABASE_FILE = databaseFile;
  try {
    return factory();
  } finally {
    if (previous === undefined) {
      delete process.env.DATABASE_FILE;
    } else {
      process.env.DATABASE_FILE = previous;
    }
  }
}
