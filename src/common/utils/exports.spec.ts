import { inflateRawSync } from 'node:zlib';
import { toCsv } from './csv';
import { buildXlsx, crc32 } from './xlsx';
import { buildPdf, toLatin1 } from './pdf';

function unzip(buffer: Buffer): Record<string, string> {
  const files: Record<string, string> = {};
  let eocd = buffer.length - 22;
  expect(buffer.readUInt32LE(eocd)).toBe(0x06054b50);
  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    expect(buffer.readUInt32LE(p)).toBe(0x02014b50);
    const method = buffer.readUInt16LE(p + 10);
    const crc = buffer.readUInt32LE(p + 16);
    const csize = buffer.readUInt32LE(p + 20);
    const nameLen = buffer.readUInt16LE(p + 28);
    const localAt = buffer.readUInt32LE(p + 42);
    const name = buffer.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const dataAt = localAt + 30 + buffer.readUInt16LE(localAt + 26) + buffer.readUInt16LE(localAt + 28);
    const data = method === 8 ? inflateRawSync(buffer.subarray(dataAt, dataAt + csize)) : buffer.subarray(dataAt, dataAt + csize);
    expect(crc32(data)).toBe(crc);
    files[name] = data.toString('utf8');
    p += 46 + nameLen;
  }
  return files;
}

describe('csv', () => {
  it('quotes commas, quotes and newlines, and adds a BOM', () => {
    const csv = toCsv([['name', 'note'], ['Ada, "Ace"', 'line1\nline2'], ['x', 5]]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Ada, ""Ace"""');
    expect(csv).toContain('"line1\nline2"');
    expect(csv).toContain('x,5');
  });
  it('neutralises spreadsheet formulas in text but not real numbers', () => {
    const csv = toCsv([['=HYPERLINK("http://evil")', '+1', '@SUM(A1)', -5, 'safe']]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain("'+1");
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain(',-5,');
  });
});

describe('xlsx', () => {
  it('crc32 matches the standard check value', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });
  it('writes a valid package with every sheet, escaped text and numeric cells', () => {
    const files = unzip(buildXlsx([
      { name: 'Summary', rows: [['Indicator', 'Value'], ['A & B <x>', 12.5], ['Flag', true]], boldRows: [0] },
      { name: 'Summary', rows: [['dup name']] },
    ]));
    for (const name of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
      expect(Object.keys(files)).toContain(name);
    }
    expect(files['xl/worksheets/sheet1.xml']).toContain('A &amp; B &lt;x&gt;');
    expect(files['xl/worksheets/sheet1.xml']).toContain('<v>12.5</v>');
    expect(files['xl/worksheets/sheet1.xml']).toContain('t="b"');
    expect(files['xl/workbook.xml']).toContain('name="Summary"');
    expect(files['xl/workbook.xml']).toContain('name="Summary 2"');
  });
});

describe('pdf', () => {
  const doc = buildPdf({
    title: 'PCU Report',
    subtitle: 'Generated 2026-09-19',
    footer: 'iDICE',
    sections: [
      { heading: 'Summary', lines: ['Line one (with parens) and \\ backslash'] },
      { heading: 'Table', table: { columns: ['Name', 'Youth'], rows: Array.from({ length: 120 }, (_, i) => [`CoE ${i} – Ünï`, i]) } },
    ],
  });
  it('is a structurally valid PDF whose xref offsets point at the objects', () => {
    const text = doc.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    entries.forEach((offset, i) => expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });
  it('paginates long tables and numbers the pages', () => {
    const text = doc.toString('latin1');
    const pages = Number(/\/Count (\d+)/.exec(text)![1]);
    expect(pages).toBeGreaterThan(1);
    expect(text).toContain(`Page 1 of ${pages}`);
  });
  it('folds characters the standard fonts cannot show', () => {
    expect(toLatin1('a – b ↔ c ≥ d')).toBe('a - b <-> c >= d');
  });
});
