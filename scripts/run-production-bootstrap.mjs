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

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(`${command} failed (exit=${code}, signal=${signal})`));
    });
  });
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
} finally {
  try {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
  } finally {
    await client.end();
  }
}
