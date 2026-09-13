import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_DIR = ROOT / 'ESO-tables'


def load_csv(path: Path):
    with path.open('r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        return reader.fieldnames or [], rows


def write_csv(path: Path, fieldnames, rows):
    with path.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, '') for key in fieldnames})


def clean_text(value):
    return re.sub(r'\s+', ' ', (value or '').strip())


def bool_value(value):
    return 'true' if str(value or '').strip().lower() in {'true', '1', 'yes', 'y'} else 'false'


def user_email(name, id_value):
    base = clean_text(name) or 'user'
    slug = re.sub(r'[^a-zA-Z0-9]+', '.', base.lower()).strip('.') or 'user'
    if not id_value:
        return f'{slug}@eso.local'
    return f'{slug}.{str(id_value)[:8]}@eso.local'


def normalize_users():
    path = CSV_DIR / 'users_rows.csv'
    _, rows = load_csv(path)
    normalized = []
    for row in rows:
        uid = str(row.get('id') or '').strip()
        full_name = clean_text(row.get('fullName') or row.get('full_name') or row.get('name') or '')
        email = (row.get('email') or '').strip() or user_email(full_name, uid)
        assigned_state = clean_text(row.get('assignedState') or row.get('state') or 'FCT') or 'FCT'
        normalized.append({
            'id': uid,
            'email': email,
            'passwordHash': 'ChangeMe@123',
            'role': 'ROLE_ESO',
            'fullName': full_name,
            'isEmailVerified': 'true',
            'mfaEnabled': 'false',
            'isActive': 'true',
            'assignedState': assigned_state,
            'created_at': clean_text(row.get('created_at') or ''),
            'updated_at': clean_text(row.get('updated_at') or ''),
        })
    write_csv(path, ['id', 'email', 'passwordHash', 'role', 'fullName', 'isEmailVerified', 'mfaEnabled', 'isActive', 'assignedState', 'created_at', 'updated_at'], normalized)


# def normalize_organizations():
#     path = CSV_DIR / 'organizations_rows.csv'
#     _, rows = load_csv(path)
#     normalized = []
#     for row in rows:
#         uid = str(row.get('id') or '').strip()
#         normalized.append({
#             'id': uid,
#             'name': clean_text(row.get('name') or ''),
#             'state': clean_text(row.get('state') or 'FCT') or 'FCT',
#             'hubType': 'STANDARD',
#             'latitude': '',
#             'longitude': '',
#             'beneficiaryCapacity': '0',
#             'isActive': 'true',
#         })
#     write_csv(path, ['id', 'name', 'state', 'hubType', 'latitude', 'longitude', 'beneficiaryCapacity', 'isActive'], normalized)


def normalize_applications():
    path = CSV_DIR / 'eso_applications_rows.csv'
    _, rows = load_csv(path)
    normalized = []
    for row in rows:
        app_id = str(row.get('id') or '').strip()
        state_of_operation = clean_text(row.get('state') or row.get('stateOfOperation') or 'FCT') or 'FCT'
        normalized.append({
            'id': app_id,
            'submittedByOrgId': str(row.get('applicant_user_id') or '').strip(),
            'preferredInstitutionId': str(row.get('organization_id') or '').strip(),
            'applicationRef': clean_text(row.get('code') or ''),
            'status': clean_text(row.get('status') or 'DRAFT') or 'DRAFT',
            'stateOfOperation': state_of_operation,
            'organisationLegalName': clean_text(row.get('sa_legal_name') or row.get('organisation_name') or row.get('name') or ''),
            'registrationType': clean_text(row.get('sa_registration_type') or 'REGISTERED_ENTITY') or 'REGISTERED_ENTITY',
            'yearEstablished': clean_text(row.get('sa_year_established') or ''),
            'organisationType': clean_text(row.get('sa_organisation_type') or 'OTHER') or 'OTHER',
            'websiteOrSocialHandle': clean_text(row.get('sa_website') or ''),
            'primaryContactName': clean_text(row.get('sa_contact_name') or ''),
            'primaryContactRole': clean_text(row.get('sa_contact_role') or ''),
            'primaryContactPhone': clean_text(row.get('sa_contact_phone') or ''),
            'primaryContactEmail': clean_text(row.get('sa_contact_email') or ''),
            'statesOfOperation': clean_text(row.get('sb_states') or ''),
            'physicalAddress': clean_text(row.get('sb_office_address') or ''),
            'proximityToHostInstitution': clean_text(row.get('sb_proximity_to_host') or ''),
            'tin': clean_text(row.get('sb_tin') or ''),
            'staffingSummary': ' | '.join(filter(None, [clean_text(row.get('sb_staff_full_time') or ''), clean_text(row.get('sb_staff_part_time') or '')])),
            'governanceStructure': clean_text(row.get('sb_governance_structure') or ''),
            'sectorFocus': clean_text(row.get('sc_sector_focus') or ''),
            'programmeDeliveryTrackRecord': clean_text(row.get('sc_delivery_track_record') or ''),
            'mentorshipIndustryNetwork': clean_text(row.get('sc_mentorship_network') or ''),
            'inclusionAccessibilityCapacity': clean_text(row.get('sc_inclusion_capacity') or ''),
            'existingInstitutionalRelationships': clean_text(row.get('sd_existing_relationships') or ''),
            'institutionalCoordinationPlan': clean_text(row.get('sd_coordination_plan') or ''),
            'staffFacultyEngagementPlan': clean_text(row.get('sd_faculty_engagement_plan') or ''),
            'beneficiaryReferralPlan': clean_text(row.get('sd_beneficiary_referral_plan') or ''),
            'hasConductedIncubation': bool_value(row.get('sf_conducted_incubation')),
            'hasConductedAcceleration': bool_value(row.get('sf_conducted_acceleration')),
            'monitoringReportingSystems': clean_text(row.get('sf_monitoring_systems') or ''),
            'sustainabilityPlan': clean_text(row.get('sf_sustainability_plan') or ''),
            'employmentPathway': clean_text(row.get('sf_employment_pathway') or ''),
            'conflictOfInterestDeclared': bool_value(row.get('sg_conflict_of_interest')),
            'safeguardingPolicyCommitted': bool_value(row.get('sg_safeguarding_commitment')),
            'genderInclusionPolicyCommitted': bool_value(row.get('sg_inclusion_commitment')),
            'idiceReportingQaCommitted': bool_value(row.get('sg_reporting_commitment')),
            'ndpaComplianceAccepted': bool_value(row.get('sh_ndpa_consent')),
            'declarationOfAccuracyConfirmed': bool_value(row.get('sh_accuracy_declaration')),
            'brownfieldRestrictionAccepted': bool_value(row.get('sh_brownfield_declaration')),
            'authorisedSignatoryName': clean_text(row.get('sh_signatory_name') or ''),
            'authorisedSignatoryTitle': clean_text(row.get('sh_signatory_title') or ''),
            'signedAt': clean_text(row.get('sh_signed_at') or ''),
            'submittedAt': clean_text(row.get('submitted_at') or ''),
            'created_at': clean_text(row.get('created_at') or ''),
            'updated_at': clean_text(row.get('updated_at') or ''),
        })

    write_csv(path, ['id', 'submittedByOrgId', 'preferredInstitutionId', 'applicationRef', 'status', 'stateOfOperation', 'organisationLegalName', 'registrationType', 'yearEstablished', 'organisationType', 'websiteOrSocialHandle', 'primaryContactName', 'primaryContactRole', 'primaryContactPhone', 'primaryContactEmail', 'statesOfOperation', 'physicalAddress', 'proximityToHostInstitution', 'tin', 'staffingSummary', 'governanceStructure', 'sectorFocus', 'programmeDeliveryTrackRecord', 'mentorshipIndustryNetwork', 'inclusionAccessibilityCapacity', 'existingInstitutionalRelationships', 'institutionalCoordinationPlan', 'staffFacultyEngagementPlan', 'beneficiaryReferralPlan', 'hasConductedIncubation', 'hasConductedAcceleration', 'monitoringReportingSystems', 'sustainabilityPlan', 'employmentPathway', 'conflictOfInterestDeclared', 'safeguardingPolicyCommitted', 'genderInclusionPolicyCommitted', 'idiceReportingQaCommitted', 'ndpaComplianceAccepted', 'declarationOfAccuracyConfirmed', 'brownfieldRestrictionAccepted', 'authorisedSignatoryName', 'authorisedSignatoryTitle', 'signedAt', 'submittedAt', 'created_at', 'updated_at'], normalized)


def normalize_references():
    path = CSV_DIR / 'eso_references_rows.csv'
    _, rows = load_csv(path)
    normalized = []
    for row in rows:
        normalized.append({
            'id': str(row.get('id') or '').strip(),
            'applicationId': str(row.get('application_id') or '').strip(),
            'fullName': clean_text(row.get('name') or row.get('fullName') or ''),
            'relationship': clean_text(row.get('relationship') or ''),
            'organisationName': '',
            'phoneNumber': clean_text(row.get('phone') or row.get('phoneNumber') or ''),
            'email': clean_text(row.get('email') or ''),
            'verified': 'false',
            'created_at': clean_text(row.get('created_at') or ''),
        })
    write_csv(path, ['id', 'applicationId', 'fullName', 'relationship', 'organisationName', 'phoneNumber', 'email', 'verified', 'created_at'], normalized)


def normalize_documents():
    path = CSV_DIR / 'application_files_rows.csv'
    _, rows = load_csv(path)
    type_map = {
        'REGISTRATION_CERT': 'REGISTRATION_CERTIFICATE',
        'REGISTRATION_CERTIFICATE': 'REGISTRATION_CERTIFICATE',
        'TAX_CLEARANCE': 'TAX_CLEARANCE',
        'ORGANOGRAM': 'ORGANOGRAM',
        'CV': 'CV',
        'MANAGEMENT_CV': 'CV',
        'AUDITED_ACCOUNTS': 'AUDITED_ACCOUNTS',
        'BANK_REFERENCE_LETTER': 'BANK_REFERENCE_LETTER',
        'CONCEPT_NOTE': 'CONCEPT_NOTE',
        'WORKPLAN': 'WORKPLAN',
        'BUDGET': 'BUDGET',
        'CONFLICT_OF_INTEREST_EVIDENCE': 'CONFLICT_OF_INTEREST_EVIDENCE',
        'INSTITUTION_ENDORSEMENT_LETTER': 'INSTITUTION_ENDORSEMENT_LETTER',
        'OPERATIONAL_PRESENCE_EVIDENCE': 'OPERATIONAL_PRESENCE_EVIDENCE',
        'PRESENCE_EVIDENCE': 'OPERATIONAL_PRESENCE_EVIDENCE',
        'EVIDENCE_OF_DELIVERY': 'EVIDENCE_OF_DELIVERY',
        'INCUBATION_ACCELERATION_EVIDENCE': 'INCUBATION_ACCELERATION_EVIDENCE',
    }
    normalized = []
    for row in rows:
        file_type = clean_text(row.get('file_type') or row.get('documentType') or '')
        normalized.append({
            'id': str(row.get('id') or '').strip(),
            'applicationId': str(row.get('application_id') or '').strip(),
            'documentType': type_map.get(file_type, file_type or 'OPERATIONAL_PRESENCE_EVIDENCE'),
            'storageKey': clean_text(row.get('s3_url') or row.get('storageKey') or ''),
            'originalFileName': clean_text(row.get('file_name') or row.get('originalFileName') or ''),
            'mimeType': clean_text(row.get('mime_type') or row.get('mimeType') or 'application/octet-stream'),
            'fileSizeBytes': clean_text(row.get('file_size') or row.get('fileSizeBytes') or '0'),
            'created_at': clean_text(row.get('uploaded_at') or row.get('created_at') or ''),
        })
    write_csv(path, ['id', 'applicationId', 'documentType', 'storageKey', 'originalFileName', 'mimeType', 'fileSizeBytes', 'created_at'], normalized)


if __name__ == '__main__':
    normalize_users()
    # normalize_organizations()
    normalize_applications()
    normalize_references()
    normalize_documents()
