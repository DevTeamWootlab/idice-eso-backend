import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeStaleRefreshTokens() {
    const result = await this.refreshTokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });

    const revokedCleanup = await this.refreshTokenRepo
      .createQueryBuilder()
      .delete()
      .where('revoked = true AND "updatedAt" < :cutoff', {
        cutoff: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // keep revoked rows 30 days for audit trail
      })
      .execute();

    this.logger.log(
      `Cleaned up ${result.affected ?? 0} expired and ${revokedCleanup.affected ?? 0} old revoked refresh tokens`,
    );
  }
}
