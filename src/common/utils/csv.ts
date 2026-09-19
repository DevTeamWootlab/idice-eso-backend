export type Cell = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * RFC 4180 CSV with a UTF-8 BOM so Excel opens accented names correctly. Text cells that
 * would be executed as a formula by a spreadsheet (=, +, -, @) are prefixed with an
 * apostrophe, so exported user-entered text can never run as a formula (CSV injection).
 * Real numbers are untouched.
 */
export function toCsv(rows: Cell[][]): string {
  const encode = (cell: Cell): string => {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : '';
    if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE';
    const safe = FORMULA_START.test(cell) ? `'${cell}` : cell;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '\uFEFF' + rows.map((row) => row.map(encode).join(',')).join('\r\n') + '\r\n';
}
