export function parseCsv(content: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let value = '';
  let inQuotes = false;

  const pushValue = () => {
    record.push(value.trim());
    value = '';
  };
  const pushRecord = () => {
    pushValue();
    if (record.some((field) => field !== '')) records.push(record);
    record = [];
  };

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      pushValue();
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && content[i + 1] === '\n') i += 1;
      pushRecord();
    } else {
      value += char;
    }
  }

  if (inQuotes) {
    throw new Error('CSV contains an unterminated quoted field.');
  }
  if (value || record.length) pushRecord();
  return records;
}
