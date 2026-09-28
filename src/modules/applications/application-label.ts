export function applicationLabel(application: {
  organisationLegalName?: string | null;
  applicationRef?: string | null;
  id?: string;
}): string {
  const ref = application.applicationRef || application.id || 'unknown reference';
  const name = application.organisationLegalName?.trim();
  return name ? `${name} (${ref})` : ref;
}
