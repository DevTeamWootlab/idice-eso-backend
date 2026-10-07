import { parseCsv } from './csv-parser';

describe('parseCsv', () => {
  it('parses escaped quotes, commas, and newlines inside quoted fields', () => {
    expect(
      parseCsv(
        'id,description\r\n1,"Line one,\r\nline ""two""" \r\n2,plain text\r\n',
      ),
    ).toEqual([
      ['id', 'description'],
      ['1', 'Line one,\r\nline "two"'],
      ['2', 'plain text'],
    ]);
  });

  it('rejects unterminated quoted fields', () => {
    expect(() => parseCsv('id,description\n1,"missing quote')).toThrow(
      'CSV contains an unterminated quoted field.',
    );
  });
});
