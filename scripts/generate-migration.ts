import { spawnSync } from 'node:child_process';
import path from 'node:path';

const nameArgument = process.argv.find(
  (argument) => argument === '--name' || argument.startsWith('--name='),
);
const name = nameArgument
  ? nameArgument.includes('=')
    ? nameArgument.split('=').slice(1).join('=')
    : process.argv[process.argv.indexOf('--name') + 1]
  : undefined;

if (!name) {
  console.error('Usage: npm run db:migration:generate --name=MigrationName');
  process.exit(1);
}

if (!/^[A-Za-z0-9_-]+$/.test(name)) {
  console.error('Migration name may contain only letters, numbers, underscores, and hyphens.');
  process.exit(1);
}

const isProduction = process.argv.includes('--prod');
const migrationPath = path.join(
  isProduction ? 'dist' : 'src',
  'database',
  'migrations',
  name,
);
const dataSource = isProduction
  ? 'dist/database/data-source.js'
  : 'src/database/data-source.ts';

const result = spawnSync(
  process.execPath,
  [
    './node_modules/typeorm/cli.js',
    'migration:generate',
    migrationPath,
    '-d',
    dataSource,
  ],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);