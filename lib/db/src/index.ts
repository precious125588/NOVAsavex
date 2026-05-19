import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Lazy initialization — do NOT throw at import time, otherwise the API server
// (and its /api/healthz endpoint) can never start when DATABASE_URL is
// temporarily missing. Throw only when something actually tries to use the db.
let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

function init() {
  if (_pool && _db) return;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  _db = drizzle(_pool, { schema });
}

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_t, prop) {
    init();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_pool as any)[prop];
  },
});

export const db: NodePgDatabase<typeof schema> = new Proxy(
  {} as NodePgDatabase<typeof schema>,
  {
    get(_t, prop) {
      init();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (_db as any)[prop];
    },
  },
);

export * from "./schema";
