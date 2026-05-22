// Loads .env files into process.env as side effects.
// MUST be the first import in main.ts so that process.env is populated before
// any other module is evaluated (e.g. app.module.ts reads QUEUE_ENABLED at load time).
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const generatedEnvPath = path.resolve(process.cwd(), 'data', '.env.generated');
const userEnvPath = path.resolve(process.cwd(), '.env');

const dataDir = path.dirname(generatedEnvPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 2. User-managed .env (does not override real process env)
if (fs.existsSync(userEnvPath)) {
  console.log('[Bootstrap] Loading .env from:', userEnvPath);
  dotenv.config({ path: userEnvPath, override: false });
}

// 3. Dashboard-saved config (does not override .env or process env)
if (fs.existsSync(generatedEnvPath)) {
  console.log('[Bootstrap] Loading saved configuration from:', generatedEnvPath);
  dotenv.config({ path: generatedEnvPath, override: false });
} else {
  console.log('[Bootstrap] First run detected, creating default configuration...');
  const minimalConfig = `# OpenWA Configuration
# Generated automatically on first run
# Edit via Dashboard > Infrastructure or modify this file directly.
# Note: values in process env or project .env take precedence over this file.

# Database (SQLite - no external service required)
DATABASE_TYPE=sqlite
POSTGRES_BUILTIN=false

# Redis & Queue (disabled by default)
REDIS_ENABLED=false
REDIS_BUILTIN=false
QUEUE_ENABLED=false

# Storage (Local filesystem)
STORAGE_TYPE=local
MINIO_BUILTIN=false
STORAGE_PATH=./data/media

# Docker Profiles: none (minimal setup)
`;
  fs.writeFileSync(generatedEnvPath, minimalConfig);
  console.log('[Bootstrap] Created default configuration at:', generatedEnvPath);
  dotenv.config({ path: generatedEnvPath, override: false });
}
