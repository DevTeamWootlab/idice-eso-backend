import {
  DOCUMENT_TYPES,
  DocumentType,
} from '@/modules/applications/entities/application-document.entity';
import { ApplicationDocument } from './../../modules/applications/entities/application-document.entity';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as argon2 from 'argon2';

import { AppDataSource } from '../data-source';
import { User } from '@/modules/users/entities/user.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { Application } from '@/modules/applications/entities/application.entity';
import { ApplicationReference } from '@/modules/applications/entities/application-reference.entity';
import { AuditLog } from '@/modules/audit-log/entities/audit-log.entity';
import { Role } from '@/common/enums/role.enum';
import {
  ApplicationStatus,
  RegistrationType,
  OrganisationType,
  SectorFocus,
  OperatingState,
  ProximityToHost,
} from '@/common/enums/application.enum';
import { DataSource } from 'typeorm';
import { toOperatingState } from '@/common/utils/parse-env';

const DEFAULT_PASSWORD = 'ChangeMe@123';
const CSV_DIRECTORY = path.resolve(__dirname, '../../../ESO-tables');



/**
 * Maps state names to their corresponding list of valid host institution UUIDs in Production.
 *
 * Used during application validation to ensure a selected `preferredInstitutionId`
 * belongs to the state where the organization operates.
 */
const VALID_INSTITUTIONS_BY_STATE: Record<string, string[]> = {
  BENUE: ['b1e4938d-24b1-4188-ad1c-cfb8a677ca04'],
  KWARA: ['99706fbd-93da-4dd5-bdd4-f78bf54655f8', 'f6a1ddb3-3fd4-4fdc-82e9-c0cc752677e0'],
  NIGER: ['f54bbae0-1e38-4cad-8002-2d28fa7f2132', '178d3d19-2b8e-4f07-ab4e-18d0763d293c'],
  KOGI: ['4e23500d-e934-463b-889f-e1fdd072bc3f', '126dc2f1-9881-49d4-888c-3d99f0af5e42', 'af4c3ea5-cef6-4ad4-b20e-606c1f24cafa'],
  FCT: ['b1f1db86-c9b3-432d-9c62-e5c26c9bb800'],
  NASARAWA: ['4aec9a58-c323-4b35-9ddc-dabf0796cba6'],
  PLATEAU: ['bdda738c-c1c4-4726-8dbb-99e053ca1fc9'],
};

/**
 * DEVELOPMENT & LOCAL SEEDING ONLY:
 * 
 * Local database migrations/seeds generate different UUIDs for institutions than Production.
 * 
 * NOTE FOR CONTRIBUTORS:
 * If you are seeding data or running tests locally, swap the UUID values in `VALID_INSTITUTIONS_BY_STATE`
 * above with the local IDs as query from your database if calling or use the above if pointing to the production db, or ensure your local `institutions` table contains the Production UUIDs
 * to prevent Foreign Key constraint (`FK_ce400242c0a02af55adebb26723`) errors.
 */
// const VALID_INSTITUTIONS_BY_STATE: Record<string, string[]> = {
//   BENUE: ['bc7259b7-1f7c-4c58-80b6-f60d111f84af'],
//   KWARA: [
//     '92ae87de-7907-42fc-9987-6e125a2a1db6',
//     '9f8d08e3-f252-4811-8a34-9338a68e33d2',
//   ],
//   NIGER: [
//     '1a134753-30b3-41ac-9144-06a441fc13c8',
//     '13dcbafd-ff86-443d-a2a7-d6cc8f0802d5',
//   ],
//   KOGI: [
//     '9aad6d38-7d61-4760-83f6-bf540802ea02',
//     '34577b4f-aa95-498f-b6e2-1ae487e84435',
//     'cff2081e-98be-47d7-b379-bb13a3a02189',
//   ],
//   FCT: ['9ffb3115-9348-4003-a9c2-c48dc5c48602'],
//   NASARAWA: ['d902d0b7-704c-40cf-b9c0-f0ad32c54c3b'],
//   PLATEAU: ['a40e2f03-679a-4968-a50a-3ca0c4b7fdbc'],
// };

function resolveValidInstitutionId(
  rawState: string | undefined,
  preferredInstitutionId: string | undefined,
): string | undefined {
  const stateKey = normalizeText(rawState).toUpperCase();
  const allowedIds = VALID_INSTITUTIONS_BY_STATE[stateKey] ?? [];
  if (!allowedIds.length) {
    return undefined;
  }

  const candidate = normalizeText(preferredInstitutionId);
  if (candidate) {
    const isAllowed = allowedIds.some(
      (id) => id.toLowerCase() === candidate.toLowerCase(),
    );
    if (isAllowed) {
      return candidate;
    }
  }

  return allowedIds[0];
}

const missingFields: Record<string, string[]> = {};
const warnings: string[] = [];

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function readCsv(fileName: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const filePath = path.join(CSV_DIRECTORY, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });

  return { headers, rows };
}

function toBoolean(value: string): boolean {
  const normalized = (value ?? '').toString().trim().toLowerCase();
  if (!normalized) return false;
  return ['true', '1', 'yes', 'y'].includes(normalized);
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeEnum<T extends Record<string, string>>(
  enumObj: T,
  value: string | undefined,
  fallback?: T[keyof T],
): T[keyof T] | undefined {
  if (!value) return fallback;

  const candidate = normalizeText(value).replace(/\s+/g, '_').toUpperCase();
  const values = Object.values(enumObj) as string[];
  const match = values.find((item) => item.toUpperCase() === candidate);
  if (match) {
    return match as T[keyof T];
  }

  const compact = candidate.replace(/_/g, '');
  const compactMatch = values.find(
    (item) => item.toUpperCase().replace(/_/g, '') === compact,
  );
  return (compactMatch as T[keyof T]) ?? fallback;
}

function lowerFirst(value: string): string {
  const trimmed = normalizeText(value);
  if (!trimmed) return '';
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function safeInt(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function safeDate(value: string | undefined): Date | null {
  if (!value || value.trim() === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseJsonArray(value: string | undefined): string[] {
  if (!value || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseOperatingStateArray(value: string | undefined): OperatingState[] {
  const parsed = parseJsonArray(value);
  const normalized = parsed
    .map((entry) => normalizeEnum(OperatingState, entry as string))
    .filter((entry): entry is OperatingState => !!entry);
  return normalized;
}

function ensureHeaders(
  fileName: string,
  headers: string[],
  expected: string[],
) {
  const missing = expected.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    missingFields[fileName] = missing;
  }
}

// INSTITUTION SEED - MUST RUN FIRST
// async function seedInstitutions(dataSource: DataSource) {
//   const institutionsRepo = dataSource.getRepository(Institution);

//   const institutionsData = [
//     {
//       id: '13dcbafd-ff86-443d-a2a7-d6cc8f0802d5',
//       name: 'Abdulkadir Kure University',
//       state: 'Niger',
//       hubType: 'STANDARD',
//     },
//     {
//       id: 'bc7259b7-1f7c-4c58-80b6-f60d111f84af',
//       name: 'Benue State University',
//       state: 'Benue',
//       hubType: 'STANDARD',
//     },
//     {
//       id: 'cff2081e-98be-47d7-b379-bb13a3a02189',
//       name: 'Federal Polytechnic Idah',
//       state: 'Kogi',
//       hubType: 'STANDARD',
//     },
//     {
//       id: 'd902d0b7-704c-40cf-b9c0-f0ad32c54c3b',
//       name: 'Federal Polytechnic Nasarawa',
//       state: 'Nasarawa',
//       hubType: 'STANDARD',
//     },
//     {
//       id: '1a134753-30b3-41ac-9144-06a441fc13c8',
//       name: 'Federal University of Technology, Minna',
//       state: 'Niger',
//       hubType: 'VR',
//     },
//     {
//       id: '9f8d08e3-f252-4811-8a34-9338a68e33d2',
//       name: 'Kwara State Polytechnic',
//       state: 'Kwara',
//       hubType: 'STANDARD',
//     },
//     {
//       id: 'a40e2f03-679a-4968-a50a-3ca0c4b7fdbc',
//       name: 'National Film Institute Jos',
//       state: 'Plateau',
//       hubType: 'CREATIVE',
//     },
//     {
//       id: '9ffb3115-9348-4003-a9c2-c48dc5c48602',
//       name: 'National Open University of Nigeria (NOUN)',
//       state: 'FCT',
//       hubType: 'STANDARD',
//     },
//     {
//       id: '34577b4f-aa95-498f-b6e2-1ae487e84435',
//       name: 'Prince Abubakar Audu University',
//       state: 'Kogi',
//       hubType: 'STANDARD',
//     },
//     {
//       id: '9aad6d38-7d61-4760-83f6-bf540802ea02',
//       name: 'Salem University',
//       state: 'Kogi',
//       hubType: 'STANDARD',
//     },
//     {
//       id: '92ae87de-7907-42fc-9987-6e125a2a1db6',
//       name: 'University of Ilorin',
//       state: 'Kwara',
//       hubType: 'GAMING',
//     },
//   ];

//   for (const data of institutionsData) {
//     const existing = await institutionsRepo.findOne({
//       where: { id: data.id },
//     });
//     if (existing) continue;

//     await institutionsRepo.save(
//       institutionsRepo.create({
//         id: data.id,
//         name: data.name,
//         state: data.state,
//         hubType: data.hubType as any,
//         isActive: true,
//       }),
//     );
//   }

//   console.log(`✓ Seeded ${institutionsData.length} institutions`);
// }
// id,email,passwordHash,role,fullName,isEmailVerified,mfaEnabled,isActive,assignedState,created_at,updated_at
// USER SEED - MUST RUN SECOND
async function seedUsers(dataSource: DataSource) {
  const csv = readCsv('users_rows.csv');
  const emailUpdates = readCsv('updated_user_email.csv');
  const emailByUserId = new Map(
    emailUpdates.rows
      .map((row) => [normalizeText(row.id), normalizeText(row.email)] as const)
      .filter(([id, email]) => !!id && !!email),
  );
  ensureHeaders('users_rows.csv', csv.headers, [
    'id',
    'email',
    'passwordHash',
    'role',
    'fullName',
    'isEmailVerified',
    'mfaEnabled',
    'isActive',
    'assignedState',
    'created_at',
    'updated_at',
  ]);

  const repo = dataSource.getRepository(User);
  let imported = 0;

  for (const row of csv.rows) {
    const userId = normalizeText(row.id);
    const emailValue =
      emailByUserId.get(userId) ||
      normalizeText(row.contact_email ?? row.email ?? '');
    const fullName = normalizeText(row.fullName ?? row.full_name ?? '');
    const assignedState = toOperatingState(
      normalizeText(row.assignedState ?? row.state ?? ''),
    );

    // Generate email from user ID or name if missing
    let finalEmail = emailValue || `user-${userId.substring(0, 8)}@idice.ng`;

    if (!userId) {
      warnings.push(`users_rows.csv row skipped: missing user ID`);
      continue;
    }

    // const existing = await repo.findOne({ where: { id: userId } });
    // if (existing) {
    //   continue;
    // }
    const existingUser = await repo.findOne({ where: { id: userId } });
    const emailOwner = await repo.findOne({ where: { email: finalEmail } });
    if (emailOwner && emailOwner.id !== userId) {
      warnings.push(
        `users_rows.csv user ${userId} cannot use email ${finalEmail}; it is already owned by ${emailOwner.id}. ` +
        `Using a generated unique email while preserving ID-based synchronization.`,
      );
      finalEmail = `user-${userId.substring(0, 8)}@idice.ng`;
    }


    if (existingUser) {
      // Strategy: Update the existing legacy row record inline with fresh CSV data changes instead of crashing
      existingUser.fullName =
        normalizeText(row.fullName || row.name) || existingUser.fullName;
      existingUser.email = finalEmail;
      existingUser.role =
        normalizeEnum(Role, row.role, existingUser.role as any) ??
        existingUser.role;
      existingUser.isEmailVerified = toBoolean(row.isEmailVerified);  
      existingUser.mfaEnabled = toBoolean(row.mfaEnabled);    
      existingUser.isActive =
        row.isActive === undefined ? true : toBoolean(row.isActive);
      existingUser.assignedState = assignedState || existingUser.assignedState;

      await repo.save(existingUser);
      continue; // Cleanly skip execution to prevent unique constraint conflicts
    }

    const passwordHash = await argon2.hash(DEFAULT_PASSWORD);
    const role = Role.ESO;

    await repo.save(
      repo.create({
        id: userId,
        email: finalEmail,
        passwordHash,
        fullName: fullName || `User ${userId.substring(0, 8)}`,
        role, 
        assignedState: assignedState || undefined,
        isEmailVerified: true,
        mfaEnabled: false,
        isActive: true,
      }),
    );

    imported++;
  }

  console.log(`✓ Seeded ${imported} users`);
}

// APPLICATION SEED - MUST RUN THIRD
async function seedApplications(dataSource: DataSource) {
  const csv = readCsv('eso_applications_rows.csv');
  ensureHeaders('eso_applications_rows.csv', csv.headers, [
    'id',
    'submittedByOrgId',
    'preferredInstitutionId',
    'applicationRef',
    'status',
    'stateOfOperation',
    'organisationLegalName',
    'registrationType',
    'yearEstablished',
    'organisationType',
    'websiteOrSocialHandle',
    'primaryContactName',
    'primaryContactRole',
    'primaryContactPhone',
    'primaryContactEmail',
    'statesOfOperation',
    'physicalAddress',
    'proximityToHostInstitution',
    'tin',
    'staffingSummary',
    'governanceStructure',
    'sectorFocus',
    'programmeDeliveryTrackRecord',
    'mentorshipIndustryNetwork',
    'inclusionAccessibilityCapacity',
    'existingInstitutionalRelationships',
    'institutionalCoordinationPlan',
    'staffFacultyEngagementPlan',
    'beneficiaryReferralPlan',
    'hasConductedIncubation',
    'hasConductedAcceleration',
    'monitoringReportingSystems',
    'sustainabilityPlan',
    'employmentPathway',
    'conflictOfInterestDeclared',
    'safeguardingPolicyCommitted',
    'genderInclusionPolicyCommitted',
    'idiceReportingQaCommitted',
    'ndpaComplianceAccepted',
    'declarationOfAccuracyConfirmed',
    'brownfieldRestrictionAccepted',
    'authorisedSignatoryName',
    'authorisedSignatoryTitle',
    'signedAt',
    'submittedAt',
    'created_at',
    'updated_at',
  ]);

  const repo = dataSource.getRepository(Application);
  const userRepo = dataSource.getRepository(User);
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const applicationRefs = new Set<string>();

  for (const row of csv.rows) {
    const rowId = normalizeText(row.id);
    const sourceApplicationRef = normalizeText(row.code || row.applicationRef);
    const submittedByOrgId = normalizeText(
      row.applicant_user_id || row.submittedByOrgId,
    );
    const sourceInstitutionId = normalizeText(
      row.organization_id || row.preferredInstitutionId,
    );

    if (!sourceApplicationRef || !submittedByOrgId) {
      warnings.push(
        `eso_applications row skipped: missing code or applicant_user_id/submittedByOrgId.`,
      );
      skipped++;
      continue;
    }

    // Verify user exists before creating or updating the application
    const userExists = await userRepo.findOne({
      where: { id: submittedByOrgId },
    });
    if (!userExists) {
      warnings.push(
        `eso_applications row skipped: User ${submittedByOrgId} not found in users table. ` +
          `Application ref: ${sourceApplicationRef}`,
      );
      skipped++;
      continue;
    }

    const status =
      normalizeEnum(ApplicationStatus, row.status, ApplicationStatus.DRAFT) ??
      ApplicationStatus.DRAFT;
    const organisationLegalName = normalizeText(
      row.sa_legal_name ||
        row.organisationLegalName ||
        row.organisation_name ||
        row.organization_name ||
        row.name,
    );
    const registrationType = normalizeEnum(
      RegistrationType,
      row.sa_registration_type || row.registrationType,
      undefined,
    );
    const organisationType = normalizeEnum(
      OrganisationType,
      row.sa_organisation_type || row.organisationType,
      undefined,
    );
    const sectorFocus = parseJsonArray(row.sc_sector_focus)
      .map((value) => normalizeEnum(SectorFocus, value, undefined))
      .filter((value): value is SectorFocus => !!value);
    const statesOfOperation = parseOperatingStateArray(
      row.sb_states || row.statesOfOperation,
    );
    const proximityToHostInstitution = normalizeEnum(
      ProximityToHost,
      row.sb_proximity_to_host || row.proximityToHostInstitution,
      undefined,
    );

    const rawFallbackState = row.state || row.sa_state || row.stateOfOperation;
    const fallbackStateEnum = toOperatingState(rawFallbackState);
    const institutionId = resolveValidInstitutionId(
      rawFallbackState,
      sourceInstitutionId,
    );

    if (!institutionId) {
      warnings.push(
        `eso_applications row skipped: no valid institution mapping for state '${rawFallbackState}' and application ref '${sourceApplicationRef}'.`,
      );
      skipped++;
      continue;
    }

    const parsedStatesOfOperation: OperatingState[] =
      statesOfOperation.length > 0
        ? statesOfOperation
            .map((s: string) => toOperatingState(s))
            .filter((s): s is OperatingState => s !== null)
        : fallbackStateEnum
          ? [fallbackStateEnum]
          : [];

    let applicationRef = sourceApplicationRef;
    if (!rowId) {
      warnings.push(
        `eso_applications row skipped: missing CSV application id for ${sourceApplicationRef}.`,
      );
      skipped++;
      continue;
    }

    const duplicateRef = applicationRefs.has(sourceApplicationRef);
    if (duplicateRef) {
      applicationRef = `${sourceApplicationRef}-${rowId.slice(0, 8)}`;
      warnings.push(
        `Duplicate application reference '${sourceApplicationRef}' normalized to '${applicationRef}' for application ${rowId}.`,
      );
    }
    applicationRefs.add(sourceApplicationRef);

    // CSV application IDs are authoritative. Do not merge separate rows by legacy reference.
    const application = await repo.findOne({ where: { id: rowId } });

    const isUpdate = !!application;

    const applicationData = {
      applicationRef,
      submittedByOrgId,
      preferredInstitutionId: institutionId || undefined,
      status,
      stateOfOperation: normalizeText(rawFallbackState) || undefined,
      //   statesOfOperation:
      //     statesOfOperation.length > 0
      //       ? statesOfOperation
      //       : ([normalizeText(row.state || row.sa_state || row.stateOfOperation)].filter(Boolean) as any),
      statesOfOperation: parsedStatesOfOperation,
      organisationLegalName: organisationLegalName || undefined,
      registrationType,
      yearEstablished:
        safeInt(row.sa_year_established || row.yearEstablished) ?? undefined,
      organisationType,
      websiteOrSocialHandle:
        normalizeText(row.sa_website || row.websiteOrSocialHandle) || undefined,
      primaryContactName:
        normalizeText(row.sa_contact_name || row.primaryContactName) ||
        undefined,
      primaryContactRole:
        normalizeText(row.sa_contact_role || row.primaryContactRole) ||
        undefined,
      primaryContactPhone:
        normalizeText(row.sa_contact_phone || row.primaryContactPhone) ||
        undefined,
      primaryContactEmail:
        normalizeText(row.sa_contact_email || row.primaryContactEmail) ||
        undefined,
      physicalAddress:
        normalizeText(row.sb_office_address || row.physicalAddress) ||
        undefined,
      proximityToHostInstitution,
      tin: normalizeText(row.sb_tin || row.tin) || undefined,
      staffingSummary:
        [
          normalizeText(row.sb_staff_full_time),
          normalizeText(row.sb_staff_part_time),
        ]
          .filter(Boolean)
          .join(' | ') ||
        normalizeText(row.staffingSummary) ||
        undefined,
      governanceStructure:
        normalizeText(row.sb_governance_structure || row.governanceStructure) ||
        undefined,
      sectorFocus: sectorFocus.length ? sectorFocus : undefined,
      programmeDeliveryTrackRecord:
        normalizeText(
          row.sc_delivery_track_record || row.programmeDeliveryTrackRecord,
        ) || undefined,
      mentorshipIndustryNetwork:
        normalizeText(
          row.sc_mentorship_network || row.mentorshipIndustryNetwork,
        ) || undefined,
      inclusionAccessibilityCapacity:
        normalizeText(
          row.sc_inclusion_capacity || row.inclusionAccessibilityCapacity,
        ) || undefined,
      existingInstitutionalRelationships:
        normalizeText(
          row.sd_existing_relationships ||
            row.existingInstitutionalRelationships,
        ) || undefined,
      institutionalCoordinationPlan:
        normalizeText(
          row.sd_coordination_plan || row.institutionalCoordinationPlan,
        ) || undefined,
      staffFacultyEngagementPlan:
        normalizeText(
          row.sd_faculty_engagement_plan || row.staffFacultyEngagementPlan,
        ) || undefined,
      beneficiaryReferralPlan:
        normalizeText(
          row.sd_beneficiary_referral_plan || row.beneficiaryReferralPlan,
        ) || undefined,
      hasConductedIncubation: toBoolean(
        row.sf_conducted_incubation || row.hasConductedIncubation,
      ),
      hasConductedAcceleration: toBoolean(
        row.sf_conducted_acceleration || row.hasConductedAcceleration,
      ),
      monitoringReportingSystems:
        normalizeText(
          row.sf_monitoring_systems || row.monitoringReportingSystems,
        ) || undefined,
      sustainabilityPlan:
        normalizeText(row.sf_sustainability_plan || row.sustainabilityPlan) ||
        undefined,
      employmentPathway:
        normalizeText(row.sf_employment_pathway || row.employmentPathway) ||
        undefined,
      conflictOfInterestDeclared: toBoolean(
        row.sg_conflict_of_interest || row.conflictOfInterestDeclared,
      ),
      safeguardingPolicyCommitted: toBoolean(
        row.sg_safeguarding_commitment || row.safeguardingPolicyCommitted,
      ),
      genderInclusionPolicyCommitted: toBoolean(
        row.sg_inclusion_commitment || row.genderInclusionPolicyCommitted,
      ),
      idiceReportingQaCommitted: toBoolean(
        row.sg_reporting_commitment || row.idiceReportingQaCommitted,
      ),
      ndpaComplianceAccepted: toBoolean(
        row.sh_ndpa_consent || row.ndpaComplianceAccepted,
      ),
      declarationOfAccuracyConfirmed: toBoolean(
        row.sh_accuracy_declaration || row.declarationOfAccuracyConfirmed,
      ),
      authorisedSignatoryName:
        normalizeText(row.sh_signatory_name || row.authorisedSignatoryName) ||
        undefined,
      authorisedSignatoryTitle:
        normalizeText(row.sh_signatory_title || row.authorisedSignatoryTitle) ||
        undefined,
      signedAt: safeDate(row.sh_signed_at || row.signedAt) ?? undefined,
      submittedAt: safeDate(row.submitted_at || row.submittedAt) ?? undefined,
      createdAt: safeDate(row.created_at || row.createdAt) ?? undefined,
      updated_at:
        safeDate(row.updated_at || row.updated_at || row.updatedAt) ??
        undefined,
    };

    if (isUpdate) {
      // Perform an inline field modification on the tracking row instance
      Object.assign(application!, applicationData);
      await repo.save(application!);
      updated++;
    } else {
      // Execute a standard native entity record insert
      const newApplication = repo.create({
        ...(rowId ? { id: rowId } : {}),
        ...applicationData,
      });
      await repo.save(newApplication);
      imported++;
    }
  }

  console.log(
    `✓ Data Ingestion Complete: ${imported} created, ${updated} updated, (${skipped} skipped)`,
  );
}

// src/database/seeds/supabase-import.ts
// id,applicationId,fullName,relationship,organisationName,phoneNumber,email,verified,created_at

async function seedApplicationReferences(dataSource: DataSource) {
  const csv = readCsv('eso_references_rows.csv');
  ensureHeaders('eso_references_rows.csv', csv.headers, [
    'id',
    'applicationId',
    'fullName',
    'relationship',
    'phoneNumber',
    'email',
    'created_at',
  ]);

  const repo = dataSource.getRepository(ApplicationReference);
  const applicationRepo = dataSource.getRepository(Application);
  let imported = 0;
  let updated = 0;
  // (id,
  //   applicationId,
  //   fullName,
  //   relationship,
  //   organisationName,
  //   phoneNumber,
  //   email,
  //   verified,
  //   created_at);

  for (const row of csv.rows) {
    const rowId = normalizeText(row.id);
    const applicationId = normalizeText(row.applicationId);
    const fullName = normalizeText(row.fullName);
    const phoneNumber = normalizeText(row.phoneNumber);
    const email = normalizeText(row.email);
    const organisationName = normalizeText(row.organisationName || 'N/A');
    const relationship = normalizeText(row.relationship);

    if (!applicationId || !fullName || !phoneNumber || !email) {
      warnings.push(
        `eso_references_rows.csv row skipped: missing required fields for application_reference import.`,
      );
      continue;
    }

    const applicationExists = await applicationRepo.exists({
      where: { id: applicationId },
    });
    if (!applicationExists) {
      warnings.push(
        `eso_references_rows.csv row ${rowId || '(without id)'} skipped: application ${applicationId} was not imported.`,
      );
      continue;
    }

    // 🔴 IDEMPOTENCY FIX: Look for an existing reference matching the primary key or unique composite criteria
    let reference = await repo.findOne({
      where: [...(rowId ? [{ id: rowId }] : []), { applicationId, email }],
    });

    const isUpdate = !!reference;

    const referenceData = {
      applicationId,
      fullName,
      relationship: relationship,
      organisationName: organisationName,
      phoneNumber,
      email,
      verified: false,
    };

    if (isUpdate) {
      Object.assign(reference!, referenceData);
      await repo.save(reference!);
      updated++;
    } else {
      const newReference = repo.create({
        ...(rowId ? { id: rowId } : {}),
        ...referenceData,
      });
      await repo.save(newReference);
      imported++;
    }
  }

  console.log(
    `✓ Application References Sync Complete: ${imported} created, ${updated} updated`,
  );
}

const DOCUMENT_TYPE_MAP: Record<string, DocumentType> = {
  REGISTRATION_CERTIFICATE: DOCUMENT_TYPES.REGISTRATION_CERTIFICATE,
  TAX_CLEARANCE: DOCUMENT_TYPES.TAX_CLEARANCE,
  ORGANOGRAM: DOCUMENT_TYPES.ORGANOGRAM,
  CV: DOCUMENT_TYPES.CV,
  AUDITED_ACCOUNTS: DOCUMENT_TYPES.AUDITED_ACCOUNTS,
  BANK_REFERENCE_LETTER: DOCUMENT_TYPES.BANK_REFERENCE_LETTER,
  CONCEPT_NOTE: DOCUMENT_TYPES.CONCEPT_NOTE,
  WORKPLAN: DOCUMENT_TYPES.WORKPLAN,
  BUDGET: DOCUMENT_TYPES.BUDGET,
  CONFLICT_OF_INTEREST_EVIDENCE: DOCUMENT_TYPES.CONFLICT_OF_INTEREST_EVIDENCE,
  INSTITUTION_ENDORSEMENT_LETTER: DOCUMENT_TYPES.INSTITUTION_ENDORSEMENT_LETTER,
  OPERATIONAL_PRESENCE_EVIDENCE: DOCUMENT_TYPES.OPERATIONAL_PRESENCE_EVIDENCE,
  PRESENCE_EVIDENCE: DOCUMENT_TYPES.OPERATIONAL_PRESENCE_EVIDENCE,
  EVIDENCE_OF_DELIVERY: DOCUMENT_TYPES.EVIDENCE_OF_DELIVERY,
  DELIVERY_EVIDENCE: DOCUMENT_TYPES.EVIDENCE_OF_DELIVERY,
  INCUBATION_ACCELERATION_EVIDENCE:
    DOCUMENT_TYPES.INCUBATION_ACCELERATION_EVIDENCE,
  INCUBATION_EVIDENCE: DOCUMENT_TYPES.INCUBATION_ACCELERATION_EVIDENCE,
  TAX_COMPLIANCE_EVIDENCE: DOCUMENT_TYPES.TAX_CLEARANCE,
  COI_DOC: DOCUMENT_TYPES.CONFLICT_OF_INTEREST_EVIDENCE,
};

async function seedApplicationDocuments(dataSource: DataSource) {
  const csv = readCsv('application_files_rows.csv');
  ensureHeaders('application_files_rows.csv', csv.headers, [
    'id',
    'applicationId',
    'documentType',
    'storageKey',
    'originalFileName',
    'mimeType',
    'fileSizeBytes',
    'created_at',
  ]);

  const repo = dataSource.getRepository(ApplicationDocument);
  const applicationRepo = dataSource.getRepository(Application);
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of csv.rows) {
    const rowId = normalizeText(row.id);
    const applicationId = normalizeText(row.applicationId);
    const fileType = normalizeText(row.documentType || row.fileType);
    const storageKey = normalizeText(row.storageKey);
    const originalFileName = normalizeText(row.originalFileName);

    if (!applicationId || !fileType || !storageKey) {
      skipped++;
      continue;
    }

    const applicationExists = await applicationRepo.exists({
      where: { id: applicationId },
    });
    if (!applicationExists) {
      warnings.push(
        `application_files_rows.csv row ${rowId || '(without id)'} skipped: application ${applicationId} was not imported.`,
      );
      skipped++;
      continue;
    }

    const normalizedType = fileType.replace(/\s+/g, '_').toUpperCase();
    const documentType = DOCUMENT_TYPE_MAP[normalizedType];

    if (!documentType) {
      warnings.push(
        `Skipped application document type '${fileType}' because it does not map to a current document enum.`,
      );
      skipped++;
      continue;
    }

    // 🔴 IDEMPOTENCY FIX: Look for an existing document by its ID or its unique storage path identifier
    let document = await repo.findOne({
      where: [...(rowId ? [{ id: rowId }] : []), { storageKey }],
    });

    const isUpdate = !!document;

    const documentData = {
      applicationId,
      documentType,
      storageKey,
      originalFileName,
      mimeType: normalizeText(row.mimeType) || 'application/octet-stream',
      fileSizeBytes: safeInt(row.fileSizeBytes) ?? 0,
    };

    if (isUpdate) {
      Object.assign(document!, documentData);
      await repo.save(document!);
      updated++;
    } else {
      const newDocument = repo.create({
        ...(rowId ? { id: rowId } : {}),
        ...documentData,
      });
      await repo.save(newDocument);
      imported++;
    }
  }

  console.log(
    `✓ Application Documents Sync Complete: ${imported} created, ${updated} updated (${skipped} skipped)`,
  );
}

async function seedAuditLogs(dataSource: DataSource) {
  const csv = readCsv('application_status_history_rows.csv');
  ensureHeaders('application_status_history_rows.csv', csv.headers, [
    'id',
    'application_id',
    'previous_status',
    'new_status',
    'changed_by',
    'comments',
    'created_at',
  ]);

  const repo = dataSource.getRepository(AuditLog);
  let imported = 0;
  let updated = 0;

  for (const row of csv.rows) {
    const rowId = normalizeText(row.id);
    const applicationId = normalizeText(row.application_id);
    const previousStatus = normalizeText(row.previous_status);
    const newStatus = normalizeText(row.new_status);

    if (!applicationId || !previousStatus || !newStatus) continue;

    // 🔴 IDEMPOTENCY FIX: Find-or-Create pattern mapped to the unique history row UUID
    let auditLog = rowId ? await repo.findOne({ where: { id: rowId } }) : null;
    const isUpdate = !!auditLog;

    const logData = {
      actorId: normalizeText(row.changed_by) || 'system-import',
      actorRole: 'ROLE_SYSADMIN',
      action: 'STATE_TRANSITION',
      entityType: 'Application',
      entityId: applicationId,
      metadata: {
        previousStatus,
        newStatus,
        comments: normalizeText(row.comments),
      },
      ipAddress: 'Ip Address not found.',
    };

    if (isUpdate) {
      Object.assign(auditLog!, logData);
      await repo.save(auditLog!);
      updated++;
    } else {
      const newLog = repo.create({
        ...(rowId ? { id: rowId } : {}),
        ...logData,
      });
      await repo.save(newLog);
      imported++;
    }
  }

  console.log(
    `✓ Audit Logs Sync Complete: ${imported} created, ${updated} updated`,
  );
}

async function seedSupabaseCsvData() {
  const dataSource = AppDataSource;
  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      console.log('\n=== STARTING CSV IMPORT ===\n');

      // EXECUTION ORDER MATTERS - DO NOT CHANGE
      // console.log('Step 1: Seeding institutions...');
      // await seedInstitutions(manager as any);

      console.log('Step 2: Seeding users...');
      await seedUsers(manager as any);

      console.log('Step 3: Seeding applications...');
      await seedApplications(manager as any);

      console.log('Step 4: Seeding application references...');
      await seedApplicationReferences(manager as any);

      console.log('Step 5: Seeding application documents...');
      await seedApplicationDocuments(manager as any);

      console.log('Step 6: Seeding audit logs...');
      await seedAuditLogs(manager as any);

      console.log('\n=== CSV IMPORT COMPLETE ===\n');
    });

    if (Object.keys(missingFields).length > 0) {
      console.warn('\nMISMATCH REPORT');
      for (const [fileName, fields] of Object.entries(missingFields)) {
        console.warn(
          `${fileName}: missing expected DB headers -> ${fields.join(', ')}`,
        );
      }
    }

    if (warnings.length > 0) {
      console.warn('\nIMPORT WARNINGS');
      warnings.forEach((warning) => console.warn(`⚠ ${warning}`));
    }

    console.log('\n✓ Supabase CSV import successful.');
  } catch (error) {
    console.error('\n✗ Supabase CSV import failed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

seedSupabaseCsvData().catch((error) => {
  console.error('Fatal error:', error);
  process.exitCode = 1;
});
