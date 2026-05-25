/**
 * Cross-database column type helpers.
 *
 * SQLite lacks native JSON and timestamp types, so we use `simple-json`
 * (JSON.stringify stored as TEXT) and `text` with DateTransformer.
 *
 * PostgreSQL has native `jsonb` and `timestamp` types with better
 * indexing and query performance.
 */

const isPostgres = (): boolean => process.env.DATABASE_TYPE === 'postgres';

/**
 * Returns 'jsonb' for PostgreSQL, 'simple-json' for SQLite.
 */
export const jsonColumnType = (): 'jsonb' | 'simple-json' => (isPostgres() ? 'jsonb' : 'simple-json');

/**
 * Returns 'timestamp' for PostgreSQL, 'datetime' for SQLite.
 * Both are handled natively by TypeORM — no transformer needed.
 */
export const dateColumnType = (): 'timestamp' | 'datetime' => (isPostgres() ? 'timestamp' : 'datetime');
