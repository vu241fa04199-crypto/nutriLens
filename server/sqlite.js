import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function tryRequire(id) {
  try {
    return require(id);
  } catch {
    return null;
  }
}

/**
 * Minimal better-sqlite3-compatible wrapper around Node's built-in SQLite.
 * Node 22.5+ ships `node:sqlite`, which needs no compiler and no native build —
 * so the app runs on a plain Node install, Windows included.
 */
class NodeSqliteStatement {
  constructor(stmt) {
    this.stmt = stmt;
  }

  static args(params) {
    return params.map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v === undefined ? null : v));
  }

  get(...params) {
    return this.stmt.get(...NodeSqliteStatement.args(params));
  }

  all(...params) {
    return this.stmt.all(...NodeSqliteStatement.args(params));
  }

  run(...params) {
    const res = this.stmt.run(...NodeSqliteStatement.args(params));
    return { changes: Number(res.changes ?? 0), lastInsertRowid: Number(res.lastInsertRowid ?? 0) };
  }
}

class NodeSqliteAdapter {
  driver = 'node:sqlite';

  constructor(DatabaseSync, file) {
    this.db = new DatabaseSync(file);
  }

  prepare(sql) {
    return new NodeSqliteStatement(this.db.prepare(sql));
  }

  exec(sql) {
    this.db.exec(sql);
    return this;
  }

  /** better-sqlite3 has db.pragma('journal_mode = WAL'); node:sqlite only has exec. */
  pragma(statement) {
    this.db.exec(`PRAGMA ${statement}`);
    return [];
  }

  /** better-sqlite3 has db.transaction(fn); this mirrors it with BEGIN/COMMIT/ROLLBACK. */
  transaction(fn) {
    const adapter = this;
    return (...args) => {
      adapter.db.exec('BEGIN');
      try {
        const result = fn(...args);
        adapter.db.exec('COMMIT');
        return result;
      } catch (err) {
        try {
          adapter.db.exec('ROLLBACK');
        } catch {
          /* the transaction may already be gone */
        }
        throw err;
      }
    };
  }

  close() {
    this.db.close();
  }
}

/**
 * Open the database with whatever SQLite is available:
 *   1. better-sqlite3 (optional dependency — fastest, works on Node < 22.5)
 *   2. node:sqlite (built into Node 22.5+, always available, nothing to compile)
 */
export function openDatabase(file) {
  const BetterSqlite = tryRequire('better-sqlite3');
  if (BetterSqlite) {
    return { db: new (BetterSqlite.default || BetterSqlite)(file), driver: 'better-sqlite3' };
  }

  const nodeSqlite = tryRequire('node:sqlite');
  if (nodeSqlite?.DatabaseSync) {
    return { db: new NodeSqliteAdapter(nodeSqlite.DatabaseSync, file), driver: 'node:sqlite' };
  }

  throw new Error(
    [
      'No SQLite driver available.',
      'Use Node.js 22.5 or newer (it includes node:sqlite), or install the optional native driver:',
      '  npm install better-sqlite3',
      'On Windows the native driver needs "Desktop development with C++" from Visual Studio Build Tools.',
    ].join('\n')
  );
}
