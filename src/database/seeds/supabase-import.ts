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
import { Application } from '@/modules/applications/entities/application.entity';
import { ApplicationReference } from '@/modules/applications/entities/application-reference.entity';
import { AuditLog } from '@/modules/audit-log/entities/audit-log.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { seedInstitutions } from './institutions.seed';
import { parseCsv } from './csv-parser';
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
const CSV_DIRECTORY = path.join(process.cwd(), 'ESO-tables');

// const ESO_TABLES_DIR = path.join(process.cwd(), 'ESO-tables');
// const usersCsvPath = path.join(ESO_TABLES_DIR, 'users_rows.csv');

/**
 * Maps each operating state to its valid host institution UUIDs.
 *
 * Used during application validation to ensure a selected `preferredInstitutionId`
 * belongs to the state where the organization operates.
 */
const VALID_INSTITUTIONS_BY_STATE: Record<string, string[]> = {
  BENUE: ['0c9b8d16-a929-4449-8cd3-1391f7175796'],
  KWARA: [
    '81e4d3e6-a12d-4761-8d1d-89057ff42ea9',
    '1fd0f539-e2b5-41ef-b9cd-0063d2bccfc7',
  ],
  NIGER: [
    '1c510fe8-ad6d-4204-84ec-7562eb5900c5',
    '82eeadc4-81cf-40c9-af3f-d93ef1f85d2a',
  ],
  KOGI: [
    '530c10b5-061b-4b89-946e-adc1f59d9e2f',
    '902c83e0-cb67-418c-9023-3d775e6c81b4',
    '3fb7b4e7-e625-44b9-b266-b74d5b38b2ae',
  ],
  FCT: ['04e34081-9746-4d77-a729-c21c75147b8b'],
  NASARAWA: ['e1012e27-3058-4443-85c2-2eec0ee79a76'],
  PLATEAU: ['00605d6a-980d-406e-a669-c49fc93044cd'],
};

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

const warnings: string[] = [];

function readCsv(fileName: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const filePath = path.join(CSV_DIRECTORY, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const records = parseCsv(fs.readFileSync(filePath, 'utf8'));
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0].map((header) =>
    header.replace(/^\uFEFF/, '').trim(),
  );
  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    throw new Error(
      `${fileName} contains duplicate column headers: ${[...new Set(duplicateHeaders)].join(', ')}`,
    );
  }

  const rows = records.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `${fileName} record ${index + 2} has ${values.length} fields; expected ${headers.length}.`,
      );
    }
    return Object.fromEntries(
      headers.map((header, column) => [header, values[column]]),
    );
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

const ORGANISATION_TYPE_ALIASES: Record<string, string> = {
  'innovation hub': 'INNOVATION_HUB',
  'incubators and accelerators': 'INCUBATOR',
  'incubators & accelerators': 'INCUBATOR',
  'creative hubs': 'CREATIVE_HUBS',
  'startup support organisations': 'STARTUP_SUPPORT_ORGANIZATIONS',
  'startup support organizations': 'STARTUP_SUPPORT_ORGANIZATIONS',
  'training provider': 'TRAINING_PROVIDER',
};

const PROXIMITY_ALIASES: Record<string, string> = {
  lt_15: 'LESS_THAN_15_MINS',
  '15_30': 'BETWEEN_15_30_MINS',
  '30_60': 'OVER_30_MINS',
  gt_60: 'OVER_30_MINS',
};

function aliasValue(
  aliases: Record<string, string>,
  value: string | undefined,
): string | undefined {
  if (!value) return value;
  return aliases[normalizeText(value).toLowerCase()] ?? value;
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

function parseJsonArray(
  value: string | undefined,
  fieldName: string,
  rowId: string,
): string[] {
  if (!value || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    if (
      !Array.isArray(parsed) ||
      !parsed.every((item): item is string => typeof item === 'string')
    ) {
      throw new Error('expected a JSON array of strings');
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `eso_applications_rows.csv row ${rowId || '(without id)'} has invalid ${fieldName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseOperatingStateArray(
  value: string | undefined,
  rowId: string,
): OperatingState[] {
  return parseJsonArray(value, 'states of operation', rowId).map((entry) => {
    const state = normalizeEnum(OperatingState, entry, undefined);
    if (!state) {
      throw new Error(
        `eso_applications_rows.csv row ${rowId || '(without id)'} has unsupported state of operation '${entry}'.`,
      );
    }
    return state;
  });
}

function strictEnum<T extends Record<string, string>>(
  enumObj: T,
  value: string | undefined,
  fieldName: string,
  rowId: string,
): T[keyof T] | undefined {
  if (!normalizeText(value)) return undefined;
  const normalized = normalizeEnum(enumObj, value, undefined);
  if (!normalized) {
    throw new Error(
      `eso_applications_rows.csv row ${rowId || '(without id)'} has unsupported ${fieldName} '${value}'.`,
    );
  }
  return normalized;
}

function ensureHeaders(
  fileName: string,
  headers: string[],
  requiredColumns: string[][],
) {
  const missing = requiredColumns
    .filter(
      (alternatives) =>
        !alternatives.some((header) => headers.includes(header)),
    )
    .map((alternatives) => alternatives.join(' or '));
  if (missing.length > 0) {
    throw new Error(
      `${fileName} is missing required column(s): ${missing.join(', ')}`,
    );
  }
}

// id,email,passwordHash,role,fullName,isEmailVerified,mfaEnabled,isActive,assignedState,created_at,updated_at
// USER SEED - MUST RUN SECOND
async function seedUsers(dataSource: DataSource) {
  const csv = readCsv('users_rows.csv');
  const emailUpdates = readCsv('updated_user_email.csv');
  ensureHeaders('updated_user_email.csv', emailUpdates.headers, [
    ['id'],
    ['email'],
  ]);
  const emailByUserId = new Map<string, string>();
  for (const [index, row] of emailUpdates.rows.entries()) {
    const id = normalizeText(row.id);
    const email = normalizeText(row.email);
    if (!id || !email) {
      throw new Error(
        `updated_user_email.csv record ${index + 2} must include both id and email.`,
      );
    }
    if (emailByUserId.has(id)) {
      throw new Error(
        `updated_user_email.csv contains duplicate user ID at record ${index + 2}.`,
      );
    }
    emailByUserId.set(id, email);
  }
  ensureHeaders('users_rows.csv', csv.headers, [
    ['id'],
    ['fullName', 'full_name'],
    ['assignedState', 'state'],
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

    if (!userId) {
      throw new Error(`users_rows.csv record is missing a user ID.`);
    }
    if (!emailValue) {
      throw new Error(
        `No email found in updated_user_email.csv or users_rows.csv for user ${userId}.`,
      );
    }
    const finalEmail = emailValue;

    // const existing = await repo.findOne({ where: { id: userId } });
    // if (existing) {
    //   continue;
    // }
    const existingUser = await repo.findOne({ where: { id: userId } });
    const emailOwner = await repo.findOne({ where: { email: finalEmail } });
    if (emailOwner && emailOwner.id !== userId) {
      throw new Error(
        `users_rows.csv email belongs to a different user ID than ${userId}.`,
      );
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
    ['id'],
    ['submittedByOrgId', 'applicant_user_id'],
    ['preferredInstitutionId', 'organization_id'],
    ['applicationRef', 'code'],
    ['stateOfOperation', 'state', 'sa_state'],
    ['statesOfOperation', 'sb_states'],
  ]);

  const repo = dataSource.getRepository(Application);
  const userRepo = dataSource.getRepository(User);
  const institutionIds = new Set(
    (
      await dataSource.getRepository(Institution).find({
        select: { id: true },
      })
    ).map((institution) => institution.id),
  );
  let imported = 0;
  let updated = 0;
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
      throw new Error(
        `eso_applications row ${rowId || '(without id)'} is missing its application code or applicant user ID.`,
      );
    }

    // Verify user exists before creating or updating the application
    const userExists = await userRepo.findOne({
      where: { id: submittedByOrgId },
    });
    if (!userExists) {
      throw new Error(
        `eso_applications row ${rowId || '(without id)'} references user ${submittedByOrgId}, which was not imported.`,
      );
    }

    const status =
      strictEnum(ApplicationStatus, row.status, 'status', rowId) ??
      ApplicationStatus.DRAFT;
    const organisationLegalName = normalizeText(
      row.sa_legal_name ||
        row.organisationLegalName ||
        row.organisation_name ||
        row.organization_name ||
        row.name,
    );
    const registrationType = strictEnum(
      RegistrationType,
      row.sa_registration_type || row.registrationType,
      'registration type',
      rowId,
    );
    const organisationType = strictEnum(
      OrganisationType,
      aliasValue(
        ORGANISATION_TYPE_ALIASES,
        row.sa_organisation_type || row.organisationType,
      ),
      'organisation type',
      rowId,
    );
    const sectorFocus = parseJsonArray(
      row.sc_sector_focus,
      'sector focus',
      rowId,
    ).map((value) => {
      const sector = normalizeEnum(SectorFocus, value, undefined);
      if (!sector) {
        throw new Error(
          `eso_applications_rows.csv row ${rowId || '(without id)'} has unsupported sector focus '${value}'.`,
        );
      }
      return sector;
    });
    const statesOfOperation = parseOperatingStateArray(
      row.sb_states || row.statesOfOperation,
      rowId,
    );
    const proximityToHostInstitution = strictEnum(
      ProximityToHost,
      aliasValue(
        PROXIMITY_ALIASES,
        row.sb_proximity_to_host || row.proximityToHostInstitution,
      ),
      'proximity to host institution',
      rowId,
    );

    const rawFallbackState =
      statesOfOperation[0] || row.state || row.sa_state || row.stateOfOperation;
    const fallbackStateEnum = toOperatingState(rawFallbackState);
    const institutionId = resolveValidInstitutionId(
      rawFallbackState,
      sourceInstitutionId,
    );

    if (!institutionId) {
      throw new Error(
        `eso_applications row ${rowId || '(without id)'} has no institution mapping for state '${rawFallbackState}'.`,
      );
    }
    if (!institutionIds.has(institutionId)) {
      throw new Error(
        `eso_applications row ${rowId} maps state '${rawFallbackState}' to institution ${institutionId}, but that institution is not present in the database. Ensure the current institution seed ran successfully before importing applications.`,
      );
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
      throw new Error(
        `eso_applications row for ${sourceApplicationRef} is missing its application ID.`,
      );
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
      updated_at: safeDate(row.updated_at || row.updatedAt) ?? undefined,
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
    `✓ Data Ingestion Complete: ${imported} created, ${updated} updated`,
  );
}

// src/database/seeds/supabase-import.ts
// id,applicationId,fullName,relationship,organisationName,phoneNumber,email,verified,created_at

async function seedApplicationReferences(dataSource: DataSource) {
  const csv = readCsv('eso_reference_rows.csv');
  ensureHeaders('eso_reference_rows.csv', csv.headers, [
    ['id'],
    ['applicationId', 'application_id'],
    ['fullName', 'name'],
    ['relationship'],
    ['phoneNumber', 'phone'],
    ['email'],
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
    const applicationId = normalizeText(
      row.applicationId || row.application_id,
    );
    const fullName = normalizeText(row.fullName || row.name);
    const phoneNumber = normalizeText(row.phoneNumber || row.phone);
    const email = normalizeText(row.email);
    const organisationName = normalizeText(row.organisationName || 'N/A');
    const relationship = normalizeText(row.relationship);

    if (!applicationId || !fullName || !phoneNumber || !email) {
      throw new Error(
        `eso_reference_rows.csv row ${rowId || '(without id)'} is missing applicationId, fullName, phoneNumber, or email.`,
      );
    }
    if (!relationship) {
      throw new Error(
        `eso_reference_rows.csv row ${rowId || '(without id)'} is missing the required relationship.`,
      );
    }

    const applicationExists = await applicationRepo.exists({
      where: { id: applicationId },
    });
    if (!applicationExists) {
      throw new Error(
        `eso_reference_rows.csv row ${rowId || '(without id)'} references application ${applicationId}, which was not imported.`,
      );
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
      verified: toBoolean(row.verified),
      createdAt: safeDate(row.created_at) ?? undefined,
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
  REGISTRATION_CERT: DOCUMENT_TYPES.REGISTRATION_CERTIFICATE,
  TAX_CLEARANCE: DOCUMENT_TYPES.TAX_CLEARANCE,
  ORGANOGRAM: DOCUMENT_TYPES.ORGANOGRAM,
  CV: DOCUMENT_TYPES.CV,
  MANAGEMENT_CV: DOCUMENT_TYPES.CV,
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
    ['id'],
    ['applicationId', 'application_id'],
    ['documentType', 'fileType', 'file_type'],
    ['storageKey', 's3_url'],
    ['originalFileName', 'file_name'],
    ['mimeType', 'mime_type'],
    ['fileSizeBytes', 'file_size'],
  ]);

  const repo = dataSource.getRepository(ApplicationDocument);
  const applicationRepo = dataSource.getRepository(Application);
  let imported = 0;
  let updated = 0;

  for (const row of csv.rows) {
    const rowId = normalizeText(row.id);
    const applicationId = normalizeText(
      row.applicationId || row.application_id,
    );
    const fileType = normalizeText(
      row.documentType || row.fileType || row.file_type,
    );
    const storageKey = normalizeText(row.storageKey || row.s3_url);
    const originalFileName = normalizeText(
      row.originalFileName || row.file_name,
    );

    if (!applicationId || !fileType || !storageKey) {
      throw new Error(
        `application_files_rows.csv row ${rowId || '(without id)'} is missing application, document type, or storage key.`,
      );
    }
    if (!originalFileName) {
      throw new Error(
        `application_files_rows.csv row ${rowId || '(without id)'} is missing its original file name.`,
      );
    }

    const applicationExists = await applicationRepo.exists({
      where: { id: applicationId },
    });
    if (!applicationExists) {
      throw new Error(
        `application_files_rows.csv row ${rowId || '(without id)'} references application ${applicationId}, which was not imported.`,
      );
    }

    const normalizedType = fileType.replace(/\s+/g, '_').toUpperCase();
    const documentType = DOCUMENT_TYPE_MAP[normalizedType];

    if (!documentType) {
      throw new Error(
        `application_files_rows.csv row ${rowId || '(without id)'} has unknown document type '${fileType}'.`,
      );
    }
    const fileSizeBytes = safeInt(row.fileSizeBytes || row.file_size);
    if (fileSizeBytes === null || fileSizeBytes < 0) {
      throw new Error(
        `application_files_rows.csv row ${rowId || '(without id)'} has an invalid file size.`,
      );
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
      mimeType:
        normalizeText(row.mimeType || row.mime_type) ||
        'application/octet-stream',
      fileSizeBytes,
      createdAt: safeDate(row.created_at || row.uploaded_at) ?? undefined,
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
    `✓ Application Documents Sync Complete: ${imported} created, ${updated} updated`,
  );
}

async function seedAuditLogs(dataSource: DataSource) {
  const csv = readCsv('application_status_history_rows.csv');
  ensureHeaders('application_status_history_rows.csv', csv.headers, [
    ['id'],
    ['application_id'],
    ['previous_status'],
    ['new_status'],
    ['changed_by'],
    ['comments'],
    ['created_at'],
  ]);

  const repo = dataSource.getRepository(AuditLog);
  const applicationRepo = dataSource.getRepository(Application);
  let imported = 0;
  let updated = 0;

  for (const row of csv.rows) {
    const rowId = normalizeText(row.id);
    const applicationId = normalizeText(row.application_id);
    const previousStatus = normalizeText(row.previous_status);
    const newStatus = normalizeText(row.new_status);

    if (!rowId || !applicationId || !previousStatus || !newStatus) {
      throw new Error(
        `application_status_history_rows.csv row ${rowId || '(without id)'} is missing required transition fields.`,
      );
    }
    const applicationExists = await applicationRepo.exists({
      where: { id: applicationId },
    });
    if (!applicationExists) {
      throw new Error(
        `application_status_history_rows.csv row ${rowId} references application ${applicationId}, which was not imported.`,
      );
    }

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
      createdAt: safeDate(row.created_at) ?? undefined,
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
      console.log('Step 1: Seeding institutions...');
      await seedInstitutions(manager);

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
