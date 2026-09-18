import { toInt } from "@/common/utils/parse-env";
import type { DataSourceOptions } from 'typeorm';

export function getDbConfig(): DataSourceOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const isCompiled = __filename.endsWith('.js');
  return {
    type: "postgres" as const,
    host: process.env.DB_HOST,
    port: toInt(process.env.DB_PORT, 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: false,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    // entities: [
    //   isProduction
    //     ? 'dist/modules/**/entities/*.entity.js'
    //     : 'src/modules/**/entities/*.entity.ts',
    // ],
    // migrations: [
    //   isProduction
    //     ? 'dist/database/migrations/*.js'
    //     : 'src/database/migrations/*.ts',
    // ],
    entities: [
      isCompiled
        ? __dirname + "/../modules/**/entities/*.entity.js"
        : __dirname + "/../modules/**/entities/*.entity.ts",
    ],
    migrations: [
      isCompiled
        ? __dirname + "/migrations/*.js"
        : __dirname + "/migrations/*.ts",
    ],
  };
}


