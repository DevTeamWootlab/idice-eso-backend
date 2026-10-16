const COURSE_FAMILY: Record<string, string> = {
  STANDARD: 'STANDARD',
  CREATIVE: 'STANDARD',
  GAMING: 'GAMING',
  VR: 'VR',
};

export function hubsShareCourses(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = COURSE_FAMILY[a.toUpperCase()];
  const right = COURSE_FAMILY[b.toUpperCase()];
  return !!left && left === right;
}

export function sameState(institutionState: string | null | undefined, stateEnum: string | null | undefined): boolean {
  const normalise = (value: string | null | undefined) =>
    (value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return !!institutionState && normalise(institutionState) === normalise(stateEnum);
}
