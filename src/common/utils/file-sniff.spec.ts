import { sniffFileType, withExtension } from './file-sniff';

const pad = (bytes: number[]) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

describe('sniffFileType', () => {
  it('recognises JPEG, PNG, WebP, PDF and HEIC', () => {
    expect(sniffFileType(pad([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg');
    expect(sniffFileType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe('png');
    expect(sniffFileType(Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'ascii'), Buffer.alloc(8)]))?.ext).toBe('webp');
    expect(sniffFileType(Buffer.concat([Buffer.from('%PDF-1.7\n', 'ascii'), Buffer.alloc(8)]))?.mime).toBe('application/pdf');
    expect(sniffFileType(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic', 'ascii'), Buffer.alloc(8)]))?.ext).toBe('heic');
  });

  it('returns null for unknown or short content', () => {
    expect(sniffFileType(Buffer.from('hello world, plain text'))).toBeNull();
    expect(sniffFileType(Buffer.alloc(3))).toBeNull();
  });
});

describe('withExtension', () => {
  it('replaces or adds the extension', () => {
    expect(withExtension('IMG_1234.HEIC', 'jpg')).toBe('IMG_1234.jpg');
    expect(withExtension('blob', 'png')).toBe('blob.png');
    expect(withExtension('', 'jpg')).toBe('evidence.jpg');
    expect(withExtension('C:\\fakepath\\site.jpeg', 'jpg')).toBe('site.jpg');
  });
});
