export interface OutcomeCandidate {
  beneficiaryId: string;
  fullName: string;
  referenceId: string;
  institution: { id: string; name: string } | null;
  completedAt: string | null;
  outcome: {
    outcomeType: string;
    employerOrVentureName: string | null;
    achievedOn: string | null;
    verified: boolean;
  } | null;
}

const toIsoDate = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
};

const toIsoTimestamp = (
  value: Date | string | null | undefined,
): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Joins the paged beneficiaries with their outcome and latest completion date. */
export function shapeOutcomeCandidates(
  beneficiaries: {
    id: string;
    fullName: string;
    referenceId: string;
    assignedInstitution?: { id: string; name: string } | null;
  }[],
  outcomes: {
    beneficiaryId: string;
    outcomeType: string;
    employerOrVentureName?: string | null;
    achievedOn?: Date | string | null;
    verified: boolean;
  }[],
  completions: { beneficiaryId: string; completedAt: Date | string | null }[],
): OutcomeCandidate[] {
  const outcomeByBeneficiary = new Map(outcomes.map((o) => [o.beneficiaryId, o]));
  const completedByBeneficiary = new Map(
    completions.map((c) => [c.beneficiaryId, c.completedAt]),
  );

  return beneficiaries.map((b) => {
    const outcome = outcomeByBeneficiary.get(b.id);
    return {
      beneficiaryId: b.id,
      fullName: b.fullName,
      referenceId: b.referenceId,
      institution: b.assignedInstitution
        ? { id: b.assignedInstitution.id, name: b.assignedInstitution.name }
        : null,
      completedAt: toIsoTimestamp(completedByBeneficiary.get(b.id)),
      outcome: outcome
        ? {
            outcomeType: outcome.outcomeType,
            employerOrVentureName: outcome.employerOrVentureName ?? null,
            achievedOn: toIsoDate(outcome.achievedOn),
            verified: outcome.verified,
          }
        : null,
    };
  });
}
