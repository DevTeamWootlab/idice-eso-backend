export interface SniffedType {
  ext: string;
  mime: string;
}

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'avif']);

export function sniffFileType(buffer: Buffer | null | undefined): SniffedType | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  if (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a') {
    return { ext: 'gif', mime: 'image/gif' };
  }
  if (buffer.toString('ascii', 0, 5) === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' };
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (brand === 'avif') return { ext: 'avif', mime: 'image/avif' };
    if (HEIF_BRANDS.has(brand)) {
      return brand.startsWith('hei') || brand.startsWith('hev')
        ? { ext: 'heic', mime: 'image/heic' }
        : { ext: 'heif', mime: 'image/heif' };
    }
  }
  return null;
}

export function withExtension(fileName: string | null | undefined, ext: string): string {
  const raw = (fileName ?? '').split(/[\\/]/).pop()?.trim() || 'evidence';
  const base = raw.replace(/\.[a-z0-9]{1,8}$/i, '') || 'evidence';
  return `${base}.${ext}`;
}
