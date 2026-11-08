import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, In, Not } from 'typeorm';
import { AppModule } from '../../app.module';
import { MatchingService } from '../../modules/matching/matching.service';
import { Match, MatchSource, MatchStatus } from '../../modules/matching/entities/match.entity';
import { Application } from '../../modules/applications/entities/application.entity';
import { Institution } from '../../modules/institutions/entities/institution.entity';
import { User } from '../../modules/users/entities/user.entity';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import * as argon2 from 'argon2';
import { ApplicationStatus } from '../../common/enums/application.enum';
import { Role } from '../../common/enums/role.enum';
import { SELECTED_ESOS, SELECTED_ESOS_SOURCE, type SelectedEsoRow } from './data/selected-esos';
import { argValue, normaliseName, parseEsoOverrides, resolveEso, type EsoRecord, type NameMatchKind } from './match-list';

let applying = false;

const PAIRABLE = [ApplicationStatus.VALIDATED_SHORTLISTED, ApplicationStatus.MATCHED];
const THRESHOLD = 70;
const ROW_DONE = 'SELECTED_ESOS_ROW_APPLIED';
const WELCOME_SENT = 'SELECTED_ESOS_WELCOME_SENT';
const TEMPORARY_PASSWORD = 'ChangeMe@123';
const TEMPORARY_PASSWORD_DAYS = 14;
const DEFAULT_ADMIN_EMAIL = 'admin@idice.eso.wootlab.ng';

type Action = 'NO_CHANGE' | 'APPROVE_EXISTING' | 'ASSIGN_AND_APPROVE' | 'RELEASE_THEN_ASSIGN' | 'RECORD_LEGACY';

interface PlanRow {
  sheet: SelectedEsoRow;
  institution: Institution;
  eso: EsoRecord;
  nameMatch: NameMatchKind | 'reference';
  otherApplications: EsoRecord[];
  crossState: boolean;
  current: { match: Match | null; holderId: string; holderName: string; status: string; legacy: boolean } | null;
  action: Action;
  overrides: string[];
}

const sameState = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toUpperCase() === b.trim().toUpperCase();

const ACTION_TEXT: Record<Action, string> = {
  NO_CHANGE: 'Already approved. No change.',
  APPROVE_EXISTING: 'Approve the existing pairing.',
  ASSIGN_AND_APPROVE: 'Assign and approve.',
  RELEASE_THEN_ASSIGN: 'Release the current approved ESO, then assign and approve.',
  RECORD_LEGACY: 'Add the missing approval record for this existing match.',
};

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
  const apply = auto || args.includes('--apply');
  const managementDecision = auto || args.includes('--management-decision');
  const notify = !args.includes('--no-email');
  const adminEmail = argValue(args, 'admin');
  const overrides = parseEsoOverrides(args);
  if (!adminEmail && !auto) {
    usage();
    throw new Error('--admin=EMAIL is required.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    const matching = app.get(MatchingService);
    const audit = app.get(AuditLogService);
    const notifications = app.get(NotificationsService);

    const users = dataSource.getRepository(User);
    const isAdmin = (u: User | null): u is User => !!u && u.role === Role.SYSADMIN && u.isActive;
    let found: User | null;
    if (adminEmail) {
      found = await users.findOne({ where: { email: adminEmail.trim().toLowerCase() } });
      if (!isAdmin(found)) throw new Error(`${adminEmail} is not an active system administrator.`);
    } else {
      const seeded = (process.env.SYSADMIN_SEED_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
      found = await users.findOne({ where: { email: seeded } });
      if (!isAdmin(found)) {
        found = await users.findOne({ where: { role: Role.SYSADMIN, isActive: true }, order: { createdAt: 'ASC' } });
      }
      if (!isAdmin(found)) {
        console.log('Selected ESOs list: skipped, no active system administrator to record the change against.');
        return;
      }
    }
    const admin: User = found;

    const doneRows = new Set<number>(
      auto
        ? (
            (await dataSource.query(
              `SELECT DISTINCT (metadata->>'row')::int AS row FROM audit_logs WHERE action = $1 AND metadata->>'source' = $2`,
              [ROW_DONE, SELECTED_ESOS_SOURCE],
            )) as { row: number }[]
          ).map((r) => Number(r.row))
        : [],
    );
    const pending = SELECTED_ESOS.filter((r) => !doneRows.has(r.row));
    if (auto && pending.length === 0) {
      console.log(`Selected ESOs list: already applied (${SELECTED_ESOS.length} of ${SELECTED_ESOS.length} rows).`);
      if (notify) await sendWelcomes(dataSource, notifications, audit, admin);
      return;
    }
    const rowBlockers = new Map<number, string>();

    const blockers: string[] = [];
    const usedOverrides = new Set<string>();

    const institutions = await dataSource
      .getRepository(Institution)
      .find({ where: { id: In(SELECTED_ESOS.map((r) => r.institutionId)) } });
    const applications = await dataSource.getRepository(Application).find({
      where: { status: Not(ApplicationStatus.DRAFT) },
      relations: { preferredInstitution: true },
    });
    const records: EsoRecord[] = applications.map((a) => ({
      id: a.id,
      applicationRef: a.applicationRef,
      organisationLegalName: a.organisationLegalName ?? null,
      status: a.status,
      finalScorePercent: a.finalScorePercent === null || a.finalScorePercent === undefined ? null : Number(a.finalScorePercent),
      state: a.preferredInstitution?.state ?? null,
    }));
    const nameOf = new Map(records.map((r) => [r.id, r.organisationLegalName ?? r.applicationRef]));

    const liveMatches = await dataSource.getRepository(Match).find({
      where: { status: In([MatchStatus.GENERATED, MatchStatus.AWAITING_APPROVAL, MatchStatus.ACCEPTED]) },
    });
    const accepted = liveMatches.filter((m) => m.status === MatchStatus.ACCEPTED);
    const withAccepted = new Set(accepted.map((m) => m.applicationId));
    const legacyByInstitution = new Map(
      applications
        .filter((a) => a.status === ApplicationStatus.MATCHED && !withAccepted.has(a.id) && a.preferredInstitutionId)
        .map((a) => [a.preferredInstitutionId, a]),
    );

    const plan: PlanRow[] = [];
    const block = (row: number, message: string) => {
      blockers.push(message);
      rowBlockers.set(row, message);
    };
    for (const sheet of pending) {
      const institution = institutions.find((i) => i.id === sheet.institutionId);
      if (!institution) {
        block(sheet.row, `Row ${sheet.row}: ${sheet.institutionName} (${sheet.institutionId}) is not in the database. Run the seed first.`);
        continue;
      }
      if (normaliseName(institution.name) !== normaliseName(sheet.institutionName)) {
        block(
          sheet.row,
          `Row ${sheet.row}: centre ${sheet.institutionId} is called "${institution.name}" in the database, not "${sheet.institutionName}".`,
        );
        continue;
      }
      if (!institution.isActive) {
        block(sheet.row, `Row ${sheet.row}: ${institution.name} is inactive.`);
        continue;
      }

      const overrideKey = normaliseName(sheet.esoName);
      const reference = overrides.get(overrideKey);
      if (reference) usedOverrides.add(overrideKey);
      const resolved = resolveEso(sheet.esoName, records, PAIRABLE, reference);
      if (!resolved.ok) {
        const near = resolved.candidates.map((c) => `      - ${c.organisationLegalName} (${c.applicationRef}, ${c.status})`);
        block(sheet.row, [`Row ${sheet.row} (${institution.name}): ${resolved.reason}`, ...near].join('\n'));
        continue;
      }
      const eso = resolved.record;
      const rowOverrides: string[] = [];
      if (!PAIRABLE.includes(eso.status as ApplicationStatus)) {
        if (!managementDecision) {
          block(
            sheet.row,
            `Row ${sheet.row}: ${eso.organisationLegalName} (${eso.applicationRef}) is ${eso.status}. Only validated or already matched ESOs can be paired.`,
          );
          continue;
        }
        rowOverrides.push(`status is ${eso.status}, not validated`);
      }
      if ((eso.finalScorePercent ?? 0) < THRESHOLD) {
        if (!managementDecision) {
          block(
            sheet.row,
            `Row ${sheet.row}: ${eso.organisationLegalName} (${eso.applicationRef}) has a final score of ${eso.finalScorePercent ?? 'none'}%, below ${THRESHOLD}%.`,
          );
          continue;
        }
        rowOverrides.push(`final score ${eso.finalScorePercent ?? 'none'}%, below ${THRESHOLD}%`);
      }

      const live = liveMatches.find((m) => m.institutionId === institution.id) ?? null;
      const legacy = !live ? (legacyByInstitution.get(institution.id) ?? null) : null;
      const current = live
        ? { match: live, holderId: live.applicationId, holderName: nameOf.get(live.applicationId) ?? live.applicationId, status: live.status, legacy: false }
        : legacy
          ? { match: null, holderId: legacy.id, holderName: legacy.organisationLegalName ?? legacy.applicationRef, status: 'MATCHED (no match record)', legacy: true }
          : null;

      let action: Action;
      if (!current) action = 'ASSIGN_AND_APPROVE';
      else if (current.legacy) action = current.holderId === eso.id ? 'RECORD_LEGACY' : 'RELEASE_THEN_ASSIGN';
      else if (current.status === MatchStatus.ACCEPTED) action = current.holderId === eso.id ? 'NO_CHANGE' : 'RELEASE_THEN_ASSIGN';
      else action = current.holderId === eso.id ? 'APPROVE_EXISTING' : 'ASSIGN_AND_APPROVE';

      plan.push({
        sheet,
        institution,
        eso,
        nameMatch: resolved.kind,
        otherApplications: resolved.others,
        crossState: !sameState(eso.state, institution.state),
        current,
        action,
        overrides: rowOverrides,
      });
    }

    for (const key of overrides.keys()) {
      if (!usedOverrides.has(key)) blockers.push(`--eso "${key}" does not match any ESO name in the list.`);
    }

    const releasedHolders = new Set(plan.filter((p) => p.action === 'RELEASE_THEN_ASSIGN').map((p) => p.current!.holderId));
    const keepsCentre = (applicationId: string) =>
      plan.some((p) => p.eso.id === applicationId) ||
      accepted.some((m) => m.applicationId === applicationId && !plan.some((p) => p.institution.id === m.institutionId));
    const returnedToPool = [...releasedHolders].filter((id) => !keepsCentre(id));

    console.log(
      `\n${auto ? 'START-UP: APPLYING ONCE' : apply ? 'APPLYING' : 'PREVIEW (nothing will be changed)'}: ${SELECTED_ESOS_SOURCE}, ${SELECTED_ESOS.length} centres`,
    );
    if (doneRows.size) console.log(`Already applied earlier and left alone: rows ${[...doneRows].sort((a, b) => a - b).join(', ')}`);
    console.log(`Recorded as: ${admin.fullName ?? admin.email} <${admin.email}>`);
    console.log(
      `Emails: ${notify ? `one "You have been matched" email per fully matched ESO, with the temporary password ${TEMPORARY_PASSWORD}` : 'not sent'}\n`,
    );
    for (const p of plan) {
      console.log(`${String(p.sheet.row).padStart(2)}. ${p.institution.name} (${p.institution.state})`);
      console.log(`    ESO:     ${p.eso.organisationLegalName} | ${p.eso.applicationRef} | ${p.eso.status} | ${p.eso.finalScorePercent}% | applied in ${p.eso.state ?? 'unknown state'}`);
      if (p.nameMatch !== 'exact') {
        const how = {
          reference: 'chosen with --eso',
          'company-suffix': 'name matched without Ltd/Limited/GTE',
          'longer-registered-name': 'sheet name is the start of the registered name',
        }[p.nameMatch];
        console.log(`    CHECK:   sheet says "${p.sheet.esoName}" (${how})`);
      }
      if (p.otherApplications.length) {
        console.log(`    Note:    other applications with this name: ${p.otherApplications.map((o) => `${o.applicationRef} (${o.status})`).join(', ')}`);
      }
      if (p.crossState) console.log(`    Cross-state pairing: ${p.eso.state ?? 'unknown'} -> ${p.institution.state}`);
      if (p.overrides.length) console.log(`    Management decision: ${p.overrides.join('; ')}`);
      console.log(`    Now:     ${p.current ? `${p.current.holderName} (${p.current.status})` : 'no ESO'}`);
      console.log(`    Action:  ${ACTION_TEXT[p.action]}\n`);
    }

    const count = (a: Action) => plan.filter((p) => p.action === a).length;
    console.log('Summary');
    console.log(`  Approve:                 ${count('ASSIGN_AND_APPROVE') + count('APPROVE_EXISTING') + count('RELEASE_THEN_ASSIGN')}`);
    console.log(`  Already approved:        ${count('NO_CHANGE')}`);
    console.log(`  Approved ESOs replaced:  ${count('RELEASE_THEN_ASSIGN')}`);
    console.log(`  Records added:           ${count('RECORD_LEGACY')}`);
    console.log(
      `  ESOs left with no centre (back to "validated, not paired"): ${returnedToPool.length ? returnedToPool.map((id) => nameOf.get(id)).join(', ') : 'none'}`,
    );

    if (blockers.length && !auto) {
      console.log(`\nCannot apply until these are fixed (${blockers.length}):`);
      for (const b of blockers) console.log(`  - ${b}`);
      process.exitCode = 1;
      return;
    }
    if (blockers.length) {
      console.log(`\nSkipped for now, retried on the next start-up (${blockers.length}):`);
      for (const b of blockers) console.log(`  - ${b}`);
    }
    if (!apply) {
      console.log('\nNothing was changed. Check every line above, then run again with --apply.');
      return;
    }
    if (plan.length === 0) {
      console.log('\nNo rows can be applied yet.');
      if (notify) await sendWelcomes(dataSource, notifications, audit, admin);
      return;
    }

    const reasonFor = (p: PlanRow) =>
      `Applied from ${SELECTED_ESOS_SOURCE} (row ${p.sheet.row}, "${p.sheet.esoName}"), management selection, recorded against ${admin.email}.`;
    const markDone = async (p: PlanRow) => {
      await audit.record({
        actorId: admin.id,
        actorRole: Role.SYSADMIN,
        action: ROW_DONE,
        entityType: 'Institution',
        entityId: p.institution.id,
        metadata: {
          source: SELECTED_ESOS_SOURCE,
          row: p.sheet.row,
          institutionName: p.institution.name,
          applicationId: p.eso.id,
          organisationLegalName: p.eso.organisationLegalName,
          action: p.action,
        },
      });
    };
    const selectedByManagement = new Set<string>();
    const ensurePairable = async (p: PlanRow) => {
      if (PAIRABLE.includes(p.eso.status as ApplicationStatus) || selectedByManagement.has(p.eso.id)) return;
      const repo = dataSource.getRepository(Application);
      const fresh = await repo.findOne({ where: { id: p.eso.id } });
      if (!fresh) throw new Error(`Row ${p.sheet.row}: ${p.eso.organisationLegalName} no longer exists.`);
      if (!PAIRABLE.includes(fresh.status)) {
        await repo.update(fresh.id, { status: ApplicationStatus.VALIDATED_SHORTLISTED });
        await audit.record({
          actorId: admin.id,
          actorRole: Role.SYSADMIN,
          action: 'APPLICATION_SELECTED_BY_MANAGEMENT',
          entityType: 'Application',
          entityId: fresh.id,
          metadata: {
            source: SELECTED_ESOS_SOURCE,
            row: p.sheet.row,
            fromStatus: fresh.status,
            toStatus: ApplicationStatus.VALIDATED_SHORTLISTED,
            finalScorePercent: fresh.finalScorePercent ?? null,
            reason: reasonFor(p),
          },
        });
        step(`${p.eso.organisationLegalName}: ${fresh.status} -> selected by management (validation skipped)`);
      }
      selectedByManagement.add(p.eso.id);
    };
    let changes = 0;
    const step = (line: string) => {
      changes += 1;
      console.log(`  - ${line}`);
    };

    const approve = async (p: PlanRow) => {
      await ensurePairable(p);
      let matchId: string;
      if (p.action === 'APPROVE_EXISTING') {
        matchId = p.current!.match!.id;
      } else {
        const staged = await matching.manualAssign(admin.id, p.institution.id, p.eso.id, reasonFor(p), true, managementDecision);
        matchId = staged.id;
      }
      const result = await matching.commitMatches(admin.id, [matchId], { notify: false });
      if (result.committed !== 1) {
        const why = result.skipped.map((s) => s.reason).join('; ') || 'unknown reason';
        throw new Error(`Row ${p.sheet.row}: ${p.institution.name} was not approved: ${why}`);
      }
      step(`Approved ${p.eso.organisationLegalName} at ${p.institution.name}`);
      await markDone(p);
    };

    const returnIfUnpaired = async (applicationId: string, why: string) => {
      if (await matching.returnToPoolIfUnpaired(admin.id, applicationId, why)) {
        step(`${nameOf.get(applicationId)} has no centre now and is back to "validated, not paired"`);
      }
    };

    applying = true;
    console.log('\nChanges:');
    for (const p of plan) {
      if (p.action === 'NO_CHANGE') await markDone(p);
      if (p.action === 'APPROVE_EXISTING' || p.action === 'ASSIGN_AND_APPROVE') await approve(p);
      if (p.action !== 'RECORD_LEGACY') continue;
      const repo = dataSource.getRepository(Match);
      const holder = applications.find((a) => a.id === p.eso.id)!;
      const saved = await repo.save(
        repo.create({
          applicationId: p.eso.id,
          institutionId: p.institution.id,
          matchCompatibilityIndex: 0,
          breakdown: null,
          state: p.institution.state,
          status: MatchStatus.ACCEPTED,
          source: MatchSource.MANUAL,
          overrideReason: reasonFor(p),
          assignedByUserId: admin.id,
          matchedAt: holder.matchedAt ?? new Date(),
        }),
      );
      await audit.record({
        actorId: admin.id,
        actorRole: Role.SYSADMIN,
        action: 'PARTNER_MATCH_RECORD_ADDED',
        entityType: 'Application',
        entityId: p.eso.id,
        metadata: { matchId: saved.id, institutionId: p.institution.id, institutionName: p.institution.name, reason: reasonFor(p) },
      });
      step(`Added the approval record for ${p.eso.organisationLegalName} at ${p.institution.name}`);
      await markDone(p);
    }

    for (const p of plan.filter((x) => x.action === 'RELEASE_THEN_ASSIGN')) {
      if (!p.current!.legacy) {
        await matching.releaseAcceptedMatch(admin.id, p.current!.match!.id, reasonFor(p));
        step(`Released ${p.current!.holderName} from ${p.institution.name}`);
      }
      await returnIfUnpaired(
        p.current!.holderId,
        `Left with no Centre of Excellence after ${SELECTED_ESOS_SOURCE} was applied (management selection).`,
      );
      await approve(p);
    }

    if (changes === 0) console.log('  - Nothing needed changing.');
    const stillPending = auto ? pending.filter((r) => rowBlockers.has(r.row)).length : 0;
    if (notify) await sendWelcomes(dataSource, notifications, audit, admin);
    console.log(stillPending ? `\nDone, with ${stillPending} row(s) still to apply on a later start-up.` : '\nDone.');
  } finally {
    await app.close();
  }
}

async function sendWelcomes(dataSource: DataSource, notifications: NotificationsService, audit: AuditLogService, admin: User) {
  const done = (await dataSource.query(
    `SELECT (metadata->>'row')::int AS row, metadata->>'applicationId' AS "applicationId" FROM audit_logs WHERE action = $1 AND metadata->>'source' = $2`,
    [ROW_DONE, SELECTED_ESOS_SOURCE],
  )) as { row: number; applicationId: string }[];
  const appOfRow = new Map(done.map((d) => [Number(d.row), d.applicationId]));
  const welcomed = new Set(
    (
      (await dataSource.query(
        `SELECT metadata->>'applicationId' AS "applicationId" FROM audit_logs WHERE action = $1 AND metadata->>'source' = $2`,
        [WELCOME_SENT, SELECTED_ESOS_SOURCE],
      )) as { applicationId: string }[]
    ).map((w) => w.applicationId),
  );

  const groups = new Map<string, SelectedEsoRow[]>();
  for (const row of SELECTED_ESOS) {
    const key = normaliseName(row.esoName);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  console.log('\nEmails:');
  let sent = 0;
  for (const rows of groups.values()) {
    const label = rows[0].esoName;
    if (!rows.every((r) => appOfRow.has(r.row))) {
      console.log(`  - ${label}: not emailed yet, some of its rows are still to be applied.`);
      continue;
    }
    const ids = [...new Set(rows.map((r) => appOfRow.get(r.row) as string))];
    if (ids.length !== 1) {
      console.log(`  - ${label}: not emailed, its rows point to different applications (${ids.join(', ')}).`);
      continue;
    }
    const applicationId = ids[0];
    if (welcomed.has(applicationId)) continue;

    const application = await dataSource.getRepository(Application).findOne({ where: { id: applicationId } });
    if (!application || application.status !== ApplicationStatus.MATCHED) {
      console.log(`  - ${label}: not emailed, the application is not matched (${application?.status ?? 'missing'}).`);
      continue;
    }
    const user = await dataSource.getRepository(User).findOne({ where: { id: application.submittedByOrgId } });
    if (!user || !user.isActive || user.role !== Role.ESO) {
      console.log(`  - ${label}: not emailed, no active ESO account owns this application.`);
      continue;
    }
    const centres = (
      await dataSource.getRepository(Match).find({
        where: { applicationId, status: MatchStatus.ACCEPTED },
        relations: { institution: true },
        order: { matchedAt: 'ASC' },
      })
    )
      .map((m) => m.institution?.name)
      .filter((n): n is string => !!n);
    if (centres.length === 0) {
      console.log(`  - ${label}: not emailed, no approved centre found.`);
      continue;
    }

    const expiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_DAYS * 24 * 60 * 60 * 1000);
    const message = {
      loginEmail: user.email,
      organisationName: application.organisationLegalName ?? label,
      applicationRef: application.applicationRef,
      centres,
      temporaryPassword: TEMPORARY_PASSWORD,
      temporaryPasswordExpiresAt: expiresAt,
    };
    try {
      await notifications.sendSelectedEsoWelcome({ ...message, to: user.email });
    } catch (error) {
      console.log(
        `  - ${label}: email to ${user.email} failed (${error instanceof Error ? error.message : String(error)}). It is retried on the next start-up.`,
      );
      continue;
    }
    const sentTo = [user.email];
    const contact = application.primaryContactEmail?.trim();
    if (contact && contact.toLowerCase() !== user.email.toLowerCase()) {
      try {
        await notifications.sendSelectedEsoWelcome({ ...message, to: contact, createInApp: false });
        sentTo.push(contact);
      } catch (error) {
        console.log(`  - ${label}: copy to ${contact} failed (${error instanceof Error ? error.message : String(error)}).`);
      }
    }
    await dataSource.getRepository(User).update(user.id, {
      temporaryPasswordHash: await argon2.hash(TEMPORARY_PASSWORD),
      temporaryPasswordExpiresAt: expiresAt,
      isEmailVerified: true,
    });
    await audit.record({
      actorId: admin.id,
      actorRole: Role.SYSADMIN,
      action: WELCOME_SENT,
      entityType: 'Application',
      entityId: applicationId,
      metadata: {
        source: SELECTED_ESOS_SOURCE,
        applicationId,
        userId: user.id,
        sentTo,
        centres,
        temporaryPasswordExpiresAt: expiresAt.toISOString(),
      },
    });
    sent += 1;
    console.log(`  - ${label}: emailed ${sentTo.join(' and ')} (${centres.join(', ')}). Temporary password works until ${expiresAt.toISOString().slice(0, 10)}.`);
  }
  if (sent === 0) console.log('  - No new emails to send.');
}

main().catch((error: unknown) => {
  console.error(`\nStopped: ${error instanceof Error ? error.message : String(error)}`);
  if (applying) {
    console.error('Changes listed above were saved. Run the preview again: it starts from the current state.');
  }
  process.exitCode = 1;
});
