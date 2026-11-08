import 'dotenv/config';
process.env.SELECTED_ESOS_CLI = '1';
import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { MatchingService } from '../../modules/matching/matching.service';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { applySelectedEsos } from '../../modules/matching/selected-esos/apply-selected-esos';
import { argValue, parseEsoOverrides } from './match-list';

function usage() {
  console.log(
    [
      'Applies the Selected ESOs list to the Match Engine.',
      '',
      '  Preview (changes nothing):  node dist/database/seeds/apply-match-list.js --admin=you@example.com',
      '  Apply:                      node dist/database/seeds/apply-match-list.js --admin=you@example.com --apply',
      '',
      'Options',
      '  --admin=EMAIL                     Active system administrator recorded as the person who made the change (required).',
      '  --apply                           Make the changes. Without it nothing is written.',
      '  --eso "Name from sheet=APP_REF"   Use this application for a sheet name the preview could not match. Repeatable.',
      '  --management-decision             Pair listed ESOs even if not yet validated or below 70% (recorded in the audit trail).',
      '  --no-email                        Do not send the "You have been matched" email or set the temporary password.',
      '  --auto                            Start-up mode: applies each row once, skipping rows that cannot be matched, then',
      '                                    emails each fully matched ESO once. Implies --apply and --management-decision.',
    ].join('\n'),
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }
  const auto = args.includes('--auto');
  const adminEmail = argValue(args, 'admin');
  const overrides = parseEsoOverrides(args);
  if (!adminEmail && !auto) {
    usage();
    throw new Error('--admin=EMAIL is required.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const result = await applySelectedEsos(
      {
        dataSource: app.get<DataSource>(getDataSourceToken()),
        matching: app.get(MatchingService),
        audit: app.get(AuditLogService),
        notifications: app.get(NotificationsService),
      },
      {
        auto,
        apply: auto || args.includes('--apply'),
        managementDecision: auto || args.includes('--management-decision'),
        notify: !args.includes('--no-email'),
        adminEmail,
        overrides,
      },
    );
    if (!result.ok) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(`\nStopped: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
