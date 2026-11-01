import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './sqlite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'nutrilens.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const opened = openDatabase(DB_PATH);
export const db = opened.db;
export const dbDriver = opened.driver;
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  age           INTEGER,
  sex           TEXT,
  height_cm     REAL,
  weight_kg     REAL,
  activity      TEXT,
  conditions    TEXT NOT NULL DEFAULT '[]',
  allergies     TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  brand         TEXT,
  category      TEXT NOT NULL DEFAULT 'snack',
  serving_g     REAL NOT NULL DEFAULT 100,
  serving_label TEXT,
  nutrition     TEXT NOT NULL DEFAULT '{}',
  ingredients   TEXT NOT NULL DEFAULT '',
  additives     TEXT NOT NULL DEFAULT '[]',
  nova          INTEGER NOT NULL DEFAULT 4,
  emoji         TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_name  TEXT NOT NULL,
  brand         TEXT,
  category      TEXT NOT NULL DEFAULT 'snack',
  portion_g     REAL NOT NULL,
  serving_g     REAL NOT NULL DEFAULT 100,
  nutrition     TEXT NOT NULL DEFAULT '{}',
  ingredients   TEXT NOT NULL DEFAULT '',
  additives     TEXT NOT NULL DEFAULT '[]',
  nova          INTEGER NOT NULL DEFAULT 4,
  score         INTEGER NOT NULL,
  verdict_key   TEXT NOT NULL,
  verdict_label TEXT NOT NULL,
  result        TEXT NOT NULL DEFAULT '{}',
  notes         TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS intake_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date      TEXT NOT NULL,
  meal          TEXT NOT NULL DEFAULT 'snack',
  name          TEXT NOT NULL,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  portion_g     REAL NOT NULL,
  nutrition     TEXT NOT NULL DEFAULT '{}',
  score         INTEGER,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alternatives (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  brand         TEXT,
  category      TEXT NOT NULL,
  description   TEXT NOT NULL,
  swap_reason   TEXT NOT NULL,
  nutrition     TEXT NOT NULL DEFAULT '{}',
  nova          INTEGER NOT NULL DEFAULT 2,
  tags          TEXT NOT NULL DEFAULT '[]',
  emoji         TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dev_outbox (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  link       TEXT,
  kind       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_user ON intake_logs(user_id, log_date);
`);

// --- lightweight migrations (safe to run on an existing database) -----------
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

ensureColumn('users', 'role', "role TEXT NOT NULL DEFAULT 'user'");
ensureColumn('users', 'email_verified', 'email_verified INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'provider', "provider TEXT NOT NULL DEFAULT 'password'");
ensureColumn('users', 'avatar_url', 'avatar_url TEXT');
ensureColumn('users', 'last_login_at', 'last_login_at TEXT');
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`);

export const nowISO = () => new Date().toISOString();

export const J = {
  parse(value, fallback) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  stringify: (value) => JSON.stringify(value ?? null),
};

export function rowToProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    brand: row.brand || '',
    category: row.category,
    servingG: row.serving_g,
    servingLabel: row.serving_label || `${row.serving_g} g`,
    nutrition: J.parse(row.nutrition, {}),
    ingredients: row.ingredients || '',
    additives: J.parse(row.additives, []),
    nova: row.nova,
    emoji: row.emoji || '🍽️',
    notes: row.notes || '',
    isCatalogue: row.user_id == null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToScan(row, { full = true } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    productName: row.product_name,
    brand: row.brand || '',
    category: row.category,
    portionG: row.portion_g,
    servingG: row.serving_g,
    nutrition: J.parse(row.nutrition, {}),
    ingredients: row.ingredients || '',
    additives: J.parse(row.additives, []),
    nova: row.nova,
    score: row.score,
    verdictKey: row.verdict_key,
    verdictLabel: row.verdict_label,
    notes: row.notes || '',
    createdAt: row.created_at,
    ...(full ? { result: J.parse(row.result, {}) } : {}),
  };
}

export function rowToLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.log_date,
    meal: row.meal,
    name: row.name,
    productId: row.product_id,
    portionG: row.portion_g,
    nutrition: J.parse(row.nutrition, {}),
    score: row.score,
    createdAt: row.created_at,
  };
}

export function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    age: row.age,
    sex: row.sex,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activity: row.activity,
    conditions: J.parse(row.conditions, []),
    allergies: J.parse(row.allergies, []),
    role: row.role || 'user',
    emailVerified: Boolean(row.email_verified),
    provider: row.provider || 'password',
    avatarUrl: row.avatar_url || null,
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at,
  };
}

export function rowToAlternative(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    brand: row.brand || '',
    category: row.category,
    description: row.description,
    swapReason: row.swap_reason,
    nutrition: J.parse(row.nutrition, {}),
    nova: row.nova,
    tags: J.parse(row.tags, []),
    emoji: row.emoji || '🥗',
  };
}
