import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MatchingService } from '@/modules/matching/matching.service';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { applySelectedEsos } from './apply-selected-esos';

const START_DELAY_MS = 5000;

@Injectable()
export class SelectedEsosStartupService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('SelectedEsosList');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly matching: MatchingService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    if (
      process.env.APPLY_SELECTED_ESOS === 'false' ||
      process.env.SELECTED_ESOS_CLI === '1' ||
      process.env.NODE_ENV === 'test'
    ) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, START_DELAY_MS);
    this.timer.unref?.();
  }

  onApplicationShutdown() {
    if (this.timer) clearTimeout(this.timer);
  }

  private async run() {
    try {
      await applySelectedEsos(
        { dataSource: this.dataSource, matching: this.matching, audit: this.audit, notifications: this.notifications },
        { auto: true, apply: true, managementDecision: true, notify: true, overrides: new Map() },
      );
    } catch (error) {
      this.logger.error(
        `Selected ESOs list was not fully applied: ${error instanceof Error ? error.message : String(error)}. It retries on the next start-up.`,
      );
    }
  }
}
