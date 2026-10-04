import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('src/database/migrations');
let files;

try {
  files = (await readdir(directory)).filter((file) => file.endsWith('.ts'));
} catch {
  throw new Error('No TypeORM migration source directory is present in this checkout.');
}

if (files.length === 0) {
  throw new Error('No TypeORM migration source files are present in this checkout.');
}

const migrationSources = await Promise.all(
  files.map((file) => readFile(path.join(directory, file), 'utf8')),
);
const initialSchema = migrationSources.join('\n');
const requiredTables = ['users', 'applications', 'institutions'];
const missingTables = requiredTables.filter(
  (table) => !new RegExp(`CREATE\\s+TABLE\\s+(?:"public"\\.)?"${table}"`, 'i').test(initialSchema),
);

if (missingTables.length > 0) {
  throw new Error(
    `Migration baseline is incomplete; no committed migration creates: ${missingTables.join(', ')}. ` +
      'Restore and review the complete initial schema migration before production deployment.',
  );
}

console.log(`Migration baseline check passed (${files.length} migration sources).`);