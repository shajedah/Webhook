/**
 * Database layer using Node.js built-in sqlite (node:sqlite)
 * Available since Node 22.5 — zero native compilation needed
 */

import { DatabaseSync } from 'node:sqlite';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// Ensure data directory exists
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, 'webhooks.db');

let db;

export function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      webhook_id  TEXT    NOT NULL UNIQUE,
      label       TEXT    NOT NULL DEFAULT 'default',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      trigger_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_webhooks_webhook_id ON webhooks(webhook_id);
    CREATE INDEX IF NOT EXISTS idx_webhooks_user_id    ON webhooks(user_id);
  `);
}

// ── Users ──────────────────────────────────────────────────────────────────

export function createUser(username) {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO users (username) VALUES (?) RETURNING id, username, created_at'
  );
  return stmt.get(username);
}

export function getUserByUsername(username) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function listUsers() {
  const db = getDb();
  return db.prepare('SELECT id, username, created_at FROM users ORDER BY created_at DESC').all();
}

// ── Webhooks ───────────────────────────────────────────────────────────────

export function createWebhook(userId, webhookId, label = 'default') {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO webhooks (user_id, webhook_id, label) VALUES (?, ?, ?) RETURNING *'
  );
  return stmt.get(userId, webhookId, label);
}

export function getWebhookById(webhookId) {
  const db = getDb();
  return db.prepare(`
    SELECT w.*, u.username
    FROM webhooks w
    JOIN users u ON u.id = w.user_id
    WHERE w.webhook_id = ?
  `).get(webhookId);
}

export function getWebhooksByUser(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT w.*, u.username
    FROM webhooks w
    JOIN users u ON u.id = w.user_id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `).all(userId);
}

export function incrementTriggerCount(webhookId) {
  const db = getDb();
  db.prepare(
    'UPDATE webhooks SET trigger_count = trigger_count + 1 WHERE webhook_id = ?'
  ).run(webhookId);
}
