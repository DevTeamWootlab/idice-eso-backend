import { TrainingTier } from '@/common/enums/beneficiary.enum';
import { toCsv, type Cell } from '@/common/utils/csv';
import { buildXlsx } from '@/common/utils/xlsx';
import { buildPdf } from '@/common/utils/pdf';
import { percentOf, type PcuMetricsResponse } from './pcu-metrics';
import { classifyRegulator } from './pcu-filters';

export type ReportKind = 'pcu' | 'nuc' | 'nbte';

export interface ReportTable {
  title: string;
  columns: string[];
  rows: Cell[][];
}

export interface ReportModel {
  title: string;
  generatedAt: string;
  filters: [string, string][];
  tables: ReportTable[];
}

export const REPORT_TITLES: Record<ReportKind, string> = {
  pcu: 'PCU M&E Programme Report',
  nuc: 'NUC Statutory Report — Universities',
  nbte: 'NBTE Statutory Report — Polytechnics',
};

const TIER_LABEL: Record<string, string> = {
  [TrainingTier.FOUNDATIONAL]: 'Foundational',
  [TrainingTier.INTERMEDIATE]: 'Developmental',
  [TrainingTier.ADVANCED]: 'Specialised',
};

const pct = (value: number | null) => (value === null ? 'n/a' : `${value}%`);

export function buildReportModel(input: {
  kind: ReportKind;
  metrics: PcuMetricsResponse;
  filters: [string, string][];
}): ReportModel {
  const { kind, metrics: m } = input;
  const programme = kind === 'pcu';
  // Programme targets are programme-wide, so they are only shown against the full PCU report.
  const target = (text: string | number) => (programme ? text : '—');

  const indicators: ReportTable = {
    title: 'Key performance indicators',
    columns: ['Indicator', 'Result', 'Target', 'Progress'],
    rows: [
      ['Youth enrolled', m.youthEnrolled.value, target(m.youthEnrolled.target), programme ? `${percentOf(m.youthEnrolled.value, m.youthEnrolled.target) ?? 0}%` : '—'],
      ['Female participation', `${pct(m.femaleParticipation.percent)} (${m.femaleParticipation.participants} of ${m.youthEnrolled.value})`, target(`${m.femaleParticipation.target}%`), '—'],
      ['Startups incubated', m.startupsIncubated.value, target(`${m.startupsIncubated.targetPerCoe} per CoE`), '—'],
      ['Enterprises in acceleration', m.pillars.acceleration, '—', '—'],
      ['Job placement', `${pct(m.jobPlacement.percent)} (${m.jobPlacement.placed} of ${m.jobPlacement.completers} completers)`, target(`${m.jobPlacement.target}%`), '—'],
      ['NEET / PWD inclusion', `${pct(m.neetPwdInclusion.percent)} (${m.neetPwdInclusion.participants})`, '—', '—'],
    ],
  };
  const tiers: ReportTable = {
    title: 'Skill tier progress',
    columns: ['Tier', 'Completed', 'Target', 'Progress'],
    rows: m.skillTiers.map((t) => [
      TIER_LABEL[t.tier] ?? t.tier,
      t.completed,
      target(t.target),
      programme ? `${percentOf(t.completed, t.target) ?? 0}%` : '—',
    ]),
  };
  const perCoe: ReportTable = {
    title: 'Per Centre of Excellence',
    columns: ['Centre of Excellence', 'State', 'Regulator', 'Youth enrolled', 'Startups incubated', 'Enterprises in acceleration'],
    rows: m.perCoe.map((c) => [c.name, c.state, classifyRegulator(c.name), c.youthEnrolled, c.startupsIncubated, c.enterprisesAccelerated]),
  };

  return { title: REPORT_TITLES[kind], generatedAt: m.generatedAt, filters: input.filters, tables: [indicators, tiers, perCoe] };
}

const filterLines = (model: ReportModel): [string, string][] =>
  model.filters.length ? model.filters : [['Filters', 'None (whole programme)']];

export function reportToCsv(model: ReportModel): string {
  const rows: Cell[][] = [[model.title], ['Generated', model.generatedAt], ...filterLines(model), []];
  for (const table of model.tables) rows.push([table.title], table.columns, ...table.rows, []);
  return toCsv(rows);
}

export function reportToXlsx(model: ReportModel): Buffer {
  const [indicators, ...rest] = model.tables;
  const head: Cell[][] = [[model.title], ['Generated', model.generatedAt], ...filterLines(model), []];
  const widths = [34, 34, 20, 18, 20];
  const sheets = [
    {
      name: 'Summary',
      rows: [...head, indicators.columns, ...indicators.rows],
      boldRows: [0, head.length],
      columnWidths: widths,
    },
    ...rest.map((table) => ({ name: table.title.replace('Per Centre of Excellence', 'Per CoE'), rows: [table.columns, ...table.rows], boldRows: [0], columnWidths: widths })),
  ];
  return buildXlsx(sheets);
}

export function reportToPdf(model: ReportModel): Buffer {
  return buildPdf({
    title: model.title,
    subtitle: `Generated ${model.generatedAt.slice(0, 10)}  |  ${filterLines(model).map(([k, v]) => `${k}: ${v}`).join('  |  ')}`,
    footer: 'iDICE North Central ESO Programme',
    sections: model.tables.map((t) => ({ heading: t.title, table: { columns: t.columns, rows: t.rows } })),
  });
}
