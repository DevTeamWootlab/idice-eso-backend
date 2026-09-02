import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource, DataSourceOptions } from "typeorm";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env" });

const isDocker = process.env.IS_DOCKER_DB === "true";

const DB_CONFIG = {
  type: "postgres",
  autoLoadEntities: true,
  synchronize: false,
  logging: false,
  entities: ["dist/**/*.entity{.tsz,.js}"],
  migrations: ["dist/database/migrations/*{.tsz,.js}"],
  ...(!isDocker && {
    ssl: {
      rejectUnauthorized: false,
    },
  }),
};

const config = () => {
  const typeORMConfig: any = DB_CONFIG;
  typeORMConfig.url = process.env.PG_URL;
  if (process.env.NODE_ENV !== "DEVELOPMENT") {
    typeORMConfig.synchronize = false;
    typeORMConfig.logging = false;
  }
  return typeORMConfig;
};

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: config,
    }),
  ],
})
export class DatabaseModule {}

const dataSourceOption = config();

const connectionSource = {
  ...dataSourceOption,
  type: "postgres", // Specify the appropriate database type
  seeds: ["dist/**/*.seeder{.ts,.js}"],
};

export const dataSource: DataSource = new DataSource(
  connectionSource as DataSourceOptions,
);
