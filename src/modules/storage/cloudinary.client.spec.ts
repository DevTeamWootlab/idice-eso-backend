import { createHash } from 'crypto';
import {
  CloudinaryClient,
  browserSafeCloudinaryUrl,
  parseCloudinaryUrl,
  withDeliveryFormat,
} from '@/modules/storage/cloudinary.client';
describe('parseCloudinaryUrl', () => {
  it('reads an image-type PDF uploaded by the earlier Supabase flow', () => {
    expect(
      parseCloudinaryUrl(
        'https://res.cloudinary.com/drhmiaj0r/image/upload/v1790187909/eso-documents/084a3149-1819-4858-84d9-bc75cd637f36/wfbgvqyf3b0vwtc42xzh.pdf',
      ),
    ).toEqual({
      cloudName: 'drhmiaj0r',
      resourceType: 'image',
      deliveryType: 'upload',
      publicId:
        'eso-documents/084a3149-1819-4858-84d9-bc75cd637f36/wfbgvqyf3b0vwtc42xzh',
      format: 'pdf',
    });
  });

  it('keeps the extension in the public id for raw files', () => {
    expect(
      parseCloudinaryUrl(
        'https://res.cloudinary.com/demo/raw/upload/v1/idice-eso/a/report.docx',
      ),
    ).toMatchObject({
      resourceType: 'raw',
      publicId: 'idice-eso/a/report.docx',
    });
  });

  it('skips transformations', () => {
    expect(
      parseCloudinaryUrl(
        'https://res.cloudinary.com/demo/image/upload/c_fill,w_200/folder/photo.png',
      ),
    ).toMatchObject({
      publicId: 'folder/photo',
      format: 'png',
    });
  });

  it('rejects other hosts', () => {
    expect(
      parseCloudinaryUrl('https://example.com/image/upload/x.pdf'),
    ).toBeNull();
  });
});

describe('CloudinaryClient signing', () => {
  it("matches Cloudinary's documented SHA-1 signature", () => {
    const client = new CloudinaryClient({
      cloudName: 'demo',
      apiKey: 'k',
      apiSecret: 'abcd',
    });
    const expected = createHash('sha1')
      .update('public_id=sample&timestamp=1315060510abcd')
      .digest('hex');
    expect(
      (
        client as unknown as { sign: (p: Record<string, unknown>) => string }
      ).sign({ public_id: 'sample', timestamp: 1315060510 }),
    ).toBe(expected);
  });
});

describe('browser-safe delivery', () => {
  it('delivers HEIC photos as JPEG', () => {
    expect(
      browserSafeCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/v1/idice-eso/validation/a/photos/x-IMG_1.heic'),
    ).toBe('https://res.cloudinary.com/demo/image/upload/v1/idice-eso/validation/a/photos/x-IMG_1.jpg');
  });

  it('leaves JPEG, PNG and raw files alone', () => {
    const jpeg = 'https://res.cloudinary.com/demo/image/upload/v1/f/a.jpg';
    const raw = 'https://res.cloudinary.com/demo/raw/upload/v1/f/a.pdf';
    expect(browserSafeCloudinaryUrl(jpeg)).toBe(jpeg);
    expect(browserSafeCloudinaryUrl(raw)).toBe(raw);
  });

  it('swaps only the final extension', () => {
    expect(withDeliveryFormat('https://x/a.b/c.heic?x=1', 'jpg')).toBe('https://x/a.b/c.jpg?x=1');
    expect(withDeliveryFormat('https://x/a/c', 'jpg')).toBe('https://x/a/c.jpg');
  });
});
