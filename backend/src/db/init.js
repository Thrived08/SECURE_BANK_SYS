import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DB_PATH || './data/bank.db';
const dbDir = path.dirname(path.resolve(dbPath));

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

// Enforce foreign key constraints (SQLite disables this by default)
db.exec('PRAGMA foreign_keys = ON');

// node:sqlite doesn't ship a db.transaction() helper like better-sqlite3 did,
// so we wrap BEGIN/COMMIT/ROLLBACK ourselves. Any route that needs multiple
// writes to succeed-or-fail together (like a money transfer) should run
// through this instead of calling db.prepare(...).run() directly in a row.
export function runInTransaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// IMPORTANT: balances are stored as INTEGER CENTS, never floats.
// Floating point (e.g. JS numbers, FLOAT/REAL columns) cannot represent
// money exactly - 0.1 + 0.2 !== 0.3 in floating point math. A banking
// system that stores $10.00 as 10.00 will eventually drift and lose money.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    account_number TEXT NOT NULL UNIQUE,
    balance_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    from_account_id TEXT REFERENCES accounts(id),
    to_account_id TEXT REFERENCES accounts(id),
    amount_cents INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer')),
    status TEXT NOT NULL DEFAULT 'completed',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions(from_account_id);
  CREATE INDEX IF NOT EXISTS idx_tx_to ON transactions(to_account_id);
  CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
`);

console.log('Database initialized at', path.resolve(dbPath));
