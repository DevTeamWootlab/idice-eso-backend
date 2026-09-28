export function contentDisposition(fileName: string, disposition: 'inline' | 'attachment' = 'inline'): string {
  const name = (fileName || 'document').replace(/[\r\n]/g, ' ');
  const asciiFallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

const EXTENSION_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
};

function extensionOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.split(/[?#]/)[0];
  const match = /\.([a-z0-9]{2,5})$/i.exec(clean);
  return match ? match[1].toLowerCase() : null;
}

export function resolveContentType(
  mimeType: string | null | undefined,
  ...names: (string | null | undefined)[]
): string {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  for (const name of names) {
    const ext = extensionOf(name);
    if (ext && EXTENSION_TYPES[ext]) return EXTENSION_TYPES[ext];
  }
  return 'application/octet-stream';
}

export function resolveFileName(originalFileName: string | null | undefined, storageKey: string | null | undefined): string {
  if (originalFileName && originalFileName.trim()) return originalFileName.trim();
  const tail = (storageKey ?? '').split(/[?#]/)[0].split('/').pop();
  return tail && tail.trim() ? decodeURIComponent(tail.trim()) : 'document';
}
