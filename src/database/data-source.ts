// database/data-source.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getDbConfig } from './db-config.util';

export const AppDataSource = new DataSource(getDbConfig());
