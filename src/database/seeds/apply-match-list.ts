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
import { ApplicationStatus } from '../../common/enums/application.enum';
import { Role } from '../../common/enums/role.enum';
import { SELECTED_ESOS, SELECTED_ESOS_SOURCE, type SelectedEsoRow } from './data/selected-esos';
import { argValue, normaliseName, parseEsoOverrides, resolveEso, type EsoRecord, type NameMatchKind } from './match-list';

let applying = false;

const PAIRABLE = [ApplicationStatus.VALIDATED_SHORTLISTED, ApplicationStatus.MATCHED];
const THRESHOLD = 70;

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
    ].join('\n'),
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }
  const apply = args.includes('--apply');
  const adminEmail = argValue(args, 'admin');
  const overrides = parseEsoOverrides(args);
  if (!adminEmail) {
    usage();
    throw new Error('--admin=EMAIL is required.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    const matching = app.get(MatchingService);
    const audit = app.get(AuditLogService);

    const admin = await dataSource.getRepository(User).findOne({ where: { email: adminEmail.trim().toLowerCase() } });
    if (!admin || admin.role !== Role.SYSADMIN || !admin.isActive) {
      throw new Error(`${adminEmail} is not an active system administrator.`);
    }

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
    for (const sheet of SELECTED_ESOS) {
      const institution = institutions.find((i) => i.id === sheet.institutionId);
      if (!institution) {
        blockers.push(`Row ${sheet.row}: ${sheet.institutionName} (${sheet.institutionId}) is not in the database. Run the seed first.`);
        continue;
      }
      if (normaliseName(institution.name) !== normaliseName(sheet.institutionName)) {
        blockers.push(
          `Row ${sheet.row}: centre ${sheet.institutionId} is called "${institution.name}" in the database, not "${sheet.institutionName}".`,
        );
        continue;
      }
      if (!institution.isActive) {
        blockers.push(`Row ${sheet.row}: ${institution.name} is inactive.`);
        continue;
      }

      const overrideKey = normaliseName(sheet.esoName);
      const reference = overrides.get(overrideKey);
      if (reference) usedOverrides.add(overrideKey);
      const resolved = resolveEso(sheet.esoName, records, PAIRABLE, reference);
      if (!resolved.ok) {
        const near = resolved.candidates.map((c) => `      - ${c.organisationLegalName} (${c.applicationRef}, ${c.status})`);
        blockers.push([`Row ${sheet.row} (${institution.name}): ${resolved.reason}`, ...near].join('\n'));
        continue;
      }
      const eso = resolved.record;
      if (!PAIRABLE.includes(eso.status as ApplicationStatus)) {
        blockers.push(
          `Row ${sheet.row}: ${eso.organisationLegalName} (${eso.applicationRef}) is ${eso.status}. Only validated or already matched ESOs can be paired.`,
        );
        continue;
      }
      if ((eso.finalScorePercent ?? 0) < THRESHOLD) {
        blockers.push(
          `Row ${sheet.row}: ${eso.organisationLegalName} (${eso.applicationRef}) has a final score of ${eso.finalScorePercent ?? 'none'}%, below ${THRESHOLD}%.`,
        );
        continue;
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

    console.log(`\n${apply ? 'APPLYING' : 'PREVIEW (nothing will be changed)'}: ${SELECTED_ESOS_SOURCE}, ${SELECTED_ESOS.length} centres`);
    console.log(`Recorded as: ${admin.fullName ?? admin.email} <${admin.email}>\n`);
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

    if (blockers.length) {
      console.log(`\nCannot apply until these are fixed (${blockers.length}):`);
      for (const b of blockers) console.log(`  - ${b}`);
      process.exitCode = 1;
      return;
    }
    if (!apply) {
      console.log('\nNothing was changed. Check every line above, then run again with --apply.');
      return;
    }

    const reasonFor = (p: PlanRow) =>
      `Applied from ${SELECTED_ESOS_SOURCE} (row ${p.sheet.row}, "${p.sheet.esoName}") by ${admin.email}.`;
    let changes = 0;
    const step = (line: string) => {
      changes += 1;
      console.log(`  - ${line}`);
    };

    const approve = async (p: PlanRow) => {
      let matchId: string;
      if (p.action === 'APPROVE_EXISTING') {
        matchId = p.current!.match!.id;
      } else {
        const staged = await matching.manualAssign(admin.id, p.institution.id, p.eso.id, reasonFor(p), true);
        matchId = staged.id;
      }
      const result = await matching.commitMatches(admin.id, [matchId]);
      if (result.committed !== 1) {
        const why = result.skipped.map((s) => s.reason).join('; ') || 'unknown reason';
        throw new Error(`Row ${p.sheet.row}: ${p.institution.name} was not approved: ${why}`);
      }
      step(`Approved ${p.eso.organisationLegalName} at ${p.institution.name}`);
    };

    const returnIfUnpaired = async (applicationId: string, why: string) => {
      if (await matching.returnToPoolIfUnpaired(admin.id, applicationId, why)) {
        step(`${nameOf.get(applicationId)} has no centre now and is back to "validated, not paired"`);
      }
    };

    applying = true;
    console.log('\nChanges:');
    for (const p of plan) {
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
    }

    for (const p of plan.filter((x) => x.action === 'RELEASE_THEN_ASSIGN')) {
      if (!p.current!.legacy) {
        await matching.releaseAcceptedMatch(admin.id, p.current!.match!.id, reasonFor(p));
        step(`Released ${p.current!.holderName} from ${p.institution.name}`);
      }
      await returnIfUnpaired(
        p.current!.holderId,
        `Left with no Centre of Excellence after ${SELECTED_ESOS_SOURCE} was applied by ${admin.email}.`,
      );
      await approve(p);
    }

    if (changes === 0) console.log('  - Nothing needed changing.');
    console.log('\nDone.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(`\nStopped: ${error instanceof Error ? error.message : String(error)}`);
  if (applying) {
    console.error('Changes listed above were saved. Run the preview again: it starts from the current state.');
  }
  process.exitCode = 1;
});
