import { classifyRegulator, exclusiveEnd, filterInstitutions } from './pcu-filters';
import { buildReportModel, reportToCsv, reportToPdf, reportToXlsx } from './pcu-report';
import { buildPcuMetrics } from './pcu-metrics';

const institutions = [
  { id: 'i1', name: 'University of Ilorin', state: 'Kwara', isActive: true },
  { id: 'i2', name: 'Federal Polytechnic Nasarawa', state: 'Nasarawa', isActive: true },
  { id: 'i3', name: 'National Film Institute Jos', state: 'Plateau', isActive: true },
  { id: 'i4', name: 'Kwara State University', state: 'KWARA', isActive: true },
];

describe('classifyRegulator', () => {
  it('sorts universities to NUC, polytechnics to NBTE, everything else to OTHER', () => {
    expect(classifyRegulator('University of Ilorin')).toBe('NUC');
    expect(classifyRegulator('Federal Polytechnic Nasarawa')).toBe('NBTE');
    expect(classifyRegulator('Federal Poly Bida')).toBe('NBTE');
    expect(classifyRegulator('National Film Institute Jos')).toBe('OTHER');
  });
});

describe('filterInstitutions', () => {
  it('filters by state case-insensitively, by id and by regulator, and combines filters', () => {
    expect(filterInstitutions(institutions, { state: 'kwara' }).map((i) => i.id)).toEqual(['i1', 'i4']);
    expect(filterInstitutions(institutions, { institutionId: 'i2' }).map((i) => i.id)).toEqual(['i2']);
    expect(filterInstitutions(institutions, { regulator: 'NBTE' }).map((i) => i.id)).toEqual(['i2']);
    expect(filterInstitutions(institutions, { state: 'Kwara', regulator: 'NUC' }).map((i) => i.id)).toEqual(['i1', 'i4']);
    expect(filterInstitutions(institutions, { state: 'Kwara', regulator: 'NBTE' })).toEqual([]);
    expect(filterInstitutions(institutions, {})).toHaveLength(4);
  });
});

describe('exclusiveEnd', () => {
  it('makes a bare end date cover the whole day', () => {
    expect(exclusiveEnd('2026-09-30').toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(exclusiveEnd('2026-09-30T12:00:00.000Z').toISOString()).toBe('2026-09-30T12:00:00.000Z');
  });
});

describe('statutory reports', () => {
  const metrics = buildPcuMetrics({
    institutions,
    enrolled: [{ institutionId: 'i1', pillar: 'SKILLS', gender: 'FEMALE', count: 3, inclusionCount: 1 }, { institutionId: 'i2', pillar: 'INCUBATION', gender: 'MALE', count: 2, inclusionCount: 0 }],
    tiers: [{ tier: 'FOUNDATIONAL', count: 4 }],
    completers: 4,
    placed: 2,
    now: new Date('2026-09-19T10:00:00Z'),
  });
  const filters: [string, string][] = [['State', 'Kwara'], ['Period', '2026-01-01 to 2026-09-30']];

  it('shows programme targets and progress only in the full PCU report', () => {
    const pcu = buildReportModel({ kind: 'pcu', metrics, filters });
    expect(pcu.title).toBe('PCU M&E Programme Report');
    expect(pcu.tables[0].rows[0]).toEqual(['Youth enrolled', 5, 25000, '0%']);
    const nuc = buildReportModel({ kind: 'nuc', metrics, filters });
    expect(nuc.title).toContain('NUC');
    expect(nuc.tables[0].rows[0]).toEqual(['Youth enrolled', 5, '—', '—']);
  });
  it('lists every CoE with its regulator and uses the tier names the dashboard shows', () => {
    const model = buildReportModel({ kind: 'pcu', metrics, filters });
    expect(model.tables[1].rows.map((r) => r[0])).toEqual(['Foundational', 'Developmental', 'Specialised']);
    const perCoe = model.tables[2].rows;
    expect(perCoe.find((r) => r[0] === 'Federal Polytechnic Nasarawa')![2]).toBe('NBTE');
    expect(perCoe.find((r) => r[0] === 'University of Ilorin')![3]).toBe(3);
  });
  it('echoes the applied filters into CSV, and produces real Excel and PDF files', () => {
    const model = buildReportModel({ kind: 'pcu', metrics, filters });
    const csv = reportToCsv(model);
    expect(csv).toContain('State,Kwara');
    expect(csv).toContain('Period,2026-01-01 to 2026-09-30');
    expect(csv).toContain('Per Centre of Excellence');
    expect(reportToXlsx(model).subarray(0, 2).toString()).toBe('PK');
    expect(reportToPdf(model).subarray(0, 5).toString()).toBe('%PDF-');
    expect(reportToCsv(buildReportModel({ kind: 'pcu', metrics, filters: [] }))).toContain('None (whole programme)');
  });
});
