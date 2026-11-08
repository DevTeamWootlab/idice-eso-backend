import { spawn } from 'node:child_process';
import pg from 'pg';

const lockKey = 'idice-production-database-bootstrap-v1';
const client = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
});

function run(command, args, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    const timer = timeoutMs
      ? setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`${command} timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs)
      : null;
    child.once('error', (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0) return resolve();
      reject(new Error(`${command} failed (exit=${code}, signal=${signal})`));
    });
  });
}

async function applySelectedEsos() {
  if (process.env.APPLY_SELECTED_ESOS === 'false') {
    console.log('Selected ESOs list: skipped (APPLY_SELECTED_ESOS=false).');
    return;
  }
  try {
    await run(process.execPath, ['dist/database/seeds/apply-match-list.js', '--auto'], 180000);
  } catch (error) {
    console.error(`Selected ESOs list was not fully applied: ${error.message}. The API will still start; it retries on the next start-up.`);
  }
}

await client.connect();
try {
  console.log('Waiting for the database bootstrap lock.');
  await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockKey]);
  await run(process.execPath, [
    './node_modules/typeorm/cli.js',
    'migration:run',
    '-d',
    'dist/database/data-source.js',
  ]);
  await run(process.execPath, ['dist/database/seeds/seed.js']);
  await applySelectedEsos();
} finally {
  try {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
  } finally {
    await client.end();
  }
}
