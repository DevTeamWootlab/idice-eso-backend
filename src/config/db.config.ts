import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { getDbConfig } from '@database/db-config.util';

const runtimeDatabaseConfig = () => ({
  ...getDbConfig(),
  entities: ['dist/modules/**/entities/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
});

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: runtimeDatabaseConfig,
    }),
  ],
})
export class DatabaseModule {}

