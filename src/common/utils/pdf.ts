import type { Cell } from './csv';

export interface PdfTable {
  columns: string[];
  rows: Cell[][];
}
export interface PdfSection {
  heading?: string;
  lines?: string[];
  table?: PdfTable;
}
export interface PdfDocument {
  title: string;
  subtitle?: string;
  footer?: string;
  sections: PdfSection[];
}

const PAGE_W = 842; // A4 landscape
const PAGE_H = 595;
const MARGIN = 40;
const MONO = 8.5;
const MONO_W = MONO * 0.6;
const MAX_CHARS = Math.floor((PAGE_W - MARGIN * 2) / MONO_W);
const LINE = 12;

const REPLACEMENTS: Record<string, string> = {
  '–': '-', '—': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...',
  '≥': '>=', '≤': '<=', '↔': '<->', '→': '->', '•': '*', '·': '-',
};

/** Reduce to what the standard PDF fonts (WinAnsi/Latin-1) can show. */
export function toLatin1(text: string): string {
  let out = '';
  for (const ch of text) {
    if (REPLACEMENTS[ch]) out += REPLACEMENTS[ch];
    else out += ch.charCodeAt(0) <= 0xff && ch.charCodeAt(0) >= 0x20 ? ch : ' ';
  }
  return out;
}

const escapePdf = (text: string) => toLatin1(text).replace(/[\\()]/g, (c) => `\\${c}`);
const cellText = (cell: Cell) =>
  cell === null || cell === undefined ? '' : typeof cell === 'boolean' ? (cell ? 'Yes' : 'No') : String(cell);
const clip = (text: string, width: number) =>
  toLatin1(text).length > width ? `${toLatin1(text).slice(0, Math.max(0, width - 3))}...` : toLatin1(text);

function columnWidths(table: PdfTable): number[] {
  const natural = table.columns.map((c, i) =>
    Math.max(toLatin1(c).length, ...table.rows.map((r) => toLatin1(cellText(r[i])).length), 3),
  );
  const gaps = (natural.length - 1) * 2;
  let widths = natural;
  const total = natural.reduce((a, b) => a + b, 0) + gaps;
  if (total > MAX_CHARS) {
    const scale = (MAX_CHARS - gaps) / natural.reduce((a, b) => a + b, 0);
    widths = natural.map((w) => Math.max(6, Math.floor(w * scale)));
  }
  return widths;
}

export function buildPdf(doc: PdfDocument): Buffer {
  type Op = string;
  const pages: Op[][] = [[]];
  let y = PAGE_H - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 14) {
      pages.push([]);
      y = PAGE_H - MARGIN;
    }
  };
  const text = (font: 'F1' | 'F2' | 'F3' | 'F4', size: number, value: string, x = MARGIN) => {
    pages[pages.length - 1].push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`);
  };

  ensure(30);
  y -= 16;
  text('F2', 16, doc.title);
  y -= 16;
  if (doc.subtitle) {
    text('F1', 9.5, doc.subtitle);
    y -= 16;
  }

  for (const section of doc.sections) {
    if (section.heading) {
      ensure(40);
      y -= 10;
      text('F2', 11.5, section.heading);
      y -= 14;
    }
    for (const line of section.lines ?? []) {
      ensure(LINE);
      text('F1', 9.5, line);
      y -= LINE;
    }
    if (section.table) {
      const widths = columnWidths(section.table);
      const format = (cells: Cell[]) =>
        widths.map((w, i) => clip(cellText(cells[i]), w).padEnd(w, ' ')).join('  ');
      ensure(LINE * 3);
      text('F4', MONO, format(section.table.columns));
      y -= LINE;
      pages[pages.length - 1].push(
        `0.5 w ${MARGIN} ${y + 8} m ${PAGE_W - MARGIN} ${y + 8} l S`,
      );
      for (const row of section.table.rows) {
        ensure(LINE);
        text('F3', MONO, format(row));
        y -= LINE;
      }
      if (section.table.rows.length === 0) {
        ensure(LINE);
        text('F3', MONO, 'No data for the selected filters.');
        y -= LINE;
      }
    }
  }

  // Footers need the final page count.
  pages.forEach((ops, i) => {
    ops.push(
      `BT /F1 8 Tf ${MARGIN} 22 Td (${escapePdf(doc.footer ?? '')}) Tj ET`,
      `BT /F1 8 Tf ${PAGE_W - MARGIN - 60} 22 Td (Page ${i + 1} of ${pages.length}) Tj ET`,
    );
  });

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // pages placeholder (object 2)
  const fonts = ['Helvetica', 'Helvetica-Bold', 'Courier', 'Courier-Bold'].map((name) =>
    add(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`),
  );
  const kids: number[] = [];
  for (const ops of pages) {
    const stream = ops.join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    const page = add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${content} 0 R /Resources << /Font << /F1 ${fonts[0]} 0 R /F2 ${fonts[1]} 0 R /F3 ${fonts[2]} 0 R /F4 ${fonts[3]} 0 R >> >> >>`,
    );
    kids.push(page);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title (${escapePdf(doc.title)}) /Producer (iDICE ESO Portal) >>`);

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
