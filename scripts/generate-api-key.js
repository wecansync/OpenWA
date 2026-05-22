#!/usr/bin/env node
/**
 * Generates a new admin API key and inserts it directly into the SQLite database.
 * Run: node scripts/generate-api-key.js [--name "My Key"] [--role admin|operator|viewer] [--db ./data/main.sqlite]
 */

const { createHash, randomBytes } = require('crypto');
const { existsSync } = require('fs');
const path = require('path');

// Parse CLI args
const args = process.argv.slice(2);
const get = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};

const dbPath = path.resolve(get('--db', './data/main.sqlite'));
const name   = get('--name', 'Generated Admin Key');
const role   = get('--role', 'admin');

if (!existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  console.error('Make sure the app has been started at least once, or pass --db <path>');
  process.exit(1);
}

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  console.error('better-sqlite3 not installed. Run: npm install better-sqlite3');
  process.exit(1);
}

const rawKey   = `owa_k1_${randomBytes(32).toString('hex')}`;
const keyHash  = createHash('sha256').update(rawKey).digest('hex');
const keyPrefix = rawKey.substring(0, 8);
const id       = require('crypto').randomUUID();
const now      = new Date().toISOString();

const db = new Database(dbPath);

db.prepare(`
  INSERT INTO api_keys (id, name, "keyHash", "keyPrefix", role, "allowedIps", "allowedSessions", "isActive", "expiresAt", "lastUsedAt", "usageCount", "createdAt", "updatedAt")
  VALUES (?, ?, ?, ?, ?, NULL, NULL, 1, NULL, NULL, 0, ?, ?)
`).run(id, name, keyHash, keyPrefix, role, now, now);

db.close();

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  ✅ API Key created successfully');
console.log('');
console.log(`  Name : ${name}`);
console.log(`  Role : ${role}`);
console.log(`  Key  : ${rawKey}`);
console.log('');
console.log('  ⚠️  Copy this key now — it cannot be retrieved later.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
