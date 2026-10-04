import { Injectable } from '@nestjs/common';
import { Application } from './entities/application.entity';
import { DOCUMENT_TYPES } from './entities/application-document.entity';

const MANDATORY_DOCUMENT_TYPES = [
  DOCUMENT_TYPES.REGISTRATION_CERTIFICATE,
  DOCUMENT_TYPES.TAX_CLEARANCE,
  DOCUMENT_TYPES.ORGANOGRAM,
  DOCUMENT_TYPES.CV,
  DOCUMENT_TYPES.AUDITED_ACCOUNTS,
  // PRD 5 (eligibility item 7) and 8.1 (Section G) require these three too — the
  // document types already existed in DOCUMENT_TYPES but nothing enforced their
  // presence, and the frontend had no upload field for any of them at all.
  DOCUMENT_TYPES.BANK_REFERENCE_LETTER,
  DOCUMENT_TYPES.CONCEPT_NOTE,
  DOCUMENT_TYPES.WORKPLAN,
  DOCUMENT_TYPES.BUDGET,
];

export interface CompletenessResult {
  complete: boolean;
  missing: string[];
}

@Injectable()
export class ApplicationCompletenessService {
  check(application: Application): CompletenessResult {
    const missing: string[] = [];

    // Section A
    if (!application.organisationLegalName)
      missing.push('Section A: Organisation legal name');
    if (!application.registrationType)
      missing.push('Section A: Registration type');
    if (!application.yearEstablished)
      missing.push('Section A: Year established');
    if (!application.organisationType)
      missing.push('Section A: Organisation type');
    if (!application.primaryContactName)
      missing.push('Section A: Primary contact name');
    if (!application.primaryContactPhone)
      missing.push('Section A: Primary contact phone');
    if (!application.primaryContactEmail)
      missing.push('Section A: Primary contact email');

    // Section B
    if (!application.statesOfOperation?.length)
      missing.push('Section B: States of operation');
    if (!application.physicalAddress)
      missing.push('Section B: Physical address');
    if (!application.proximityToHostInstitution)
      missing.push('Section B: Proximity to host institution');
    if (!application.tin) missing.push('Section B: Tax Identification Number');
   if (!application.preferredInstitutionId) {
     missing.push(
       'Section B: Preferred Centre of Excellence / host institution is required',
     );
   }
   // Section C
   if (!application.sectorFocus?.length)
     missing.push('Section C: Sector focus');
   if (!application.programmeDeliveryTrackRecord)
     missing.push('Section C: Programme delivery track record');
   if (!application.inclusionAccessibilityCapacity)
     missing.push('Section C: Inclusion & accessibility capacity');

   // Section D
   if (!application.existingInstitutionalRelationships)
     missing.push('Section D: Existing institutional relationships');
   if (!application.institutionalCoordinationPlan)
     missing.push('Section D: Coordination with institutional structures');

   // Section E — minimum 3 verifiable references
   if ((application.references?.length ?? 0) < 3) {
     missing.push('Section E: At least 3 references are required');
   } else {
     application.references.forEach((ref, i) => {
       if (!ref.fullName || !ref.phoneNumber || !ref.email) {
         missing.push(`Section E: Reference ${i + 1} is incomplete`);
       }
     });
   }

   // Section F
   if (
     application.hasConductedIncubation === null ||
     application.hasConductedIncubation === undefined
   ) {
     missing.push('Section F: Incubation experience response is required');
   }
   if (
     application.hasConductedAcceleration === null ||
     application.hasConductedAcceleration === undefined
   ) {
     missing.push('Section F: Acceleration experience response is required');
   }
   if (!application.sustainabilityPlan)
     missing.push('Section F: Sustainability plan');
   if (!application.employmentPathway)
     missing.push('Section F: Employment pathway');

   // Section G
   if (application.safeguardingPolicyCommitted !== true)
     missing.push('Section G: Safeguarding policy commitment');
   if (application.genderInclusionPolicyCommitted !== true)
     missing.push('Section G: Gender/inclusion policy commitment');
   if (application.idiceReportingQaCommitted !== true)
     missing.push('Section G: iDICE reporting & QA commitment');

   // Conditional — CoI evidence required only if CoI is declared true
   // if (application.conflictOfInterestDeclared === true) {
   //   const hasEvidence = application.documents?.some(
   //     (d) => d.documentType === DocumentType.CONFLICT_OF_INTEREST_EVIDENCE
   //   );
   //   if (!hasEvidence) {
   //     missing.push(
   //       'Section G: Conflict-of-interest supporting document is required',
   //     );
   //   }
   // }
   if (application.conflictOfInterestDeclared === true) {
     const hasEvidence = application.documents?.some(
       (d) => d.documentType === DOCUMENT_TYPES.CONFLICT_OF_INTEREST_EVIDENCE,
     );

     if (!hasEvidence) {
       missing.push(
         'Section G: Conflict-of-interest supporting document is required',
       );
     }
   }

   // Section H
   if (application.ndpaComplianceAccepted !== true)
     missing.push('Section H: NDPA 2023 consent is required');
   if (application.declarationOfAccuracyConfirmed !== true)
     missing.push('Section H: Declaration of accuracy is required');
   if (application.brownfieldRestrictionAccepted !== true)
     missing.push('Section H: Brownfield declaration is required');
   if (!application.authorisedSignatoryName)
     missing.push('Section H: Authorised signatory name');
   if (!application.authorisedSignatoryTitle)
     missing.push('Section H: Authorised signatory title');

    

    // Mandatory documents
    for (const type of MANDATORY_DOCUMENT_TYPES) {
      const present = application.documents?.some(
        (d) => d.documentType === type,
      );
      if (!present) missing.push(`Missing required document: ${type}`);
    }

    return { complete: missing.length === 0, missing };
  }
}
