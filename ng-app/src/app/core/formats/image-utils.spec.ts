import { describe, expect, it } from 'vitest';
import { decodeDataUrl, extensionForMime, scaledSize } from './image-utils';

describe('decodeDataUrl', () => {
  it('decodes mime type and bytes from a base64 data URL', () => {
    // "AQID" base64-decodes to bytes [1, 2, 3]
    const result = decodeDataUrl('data:image/png;base64,AQID');
    expect(result).not.toBeNull();
    expect(result!.mime).toBe('image/png');
    expect(Array.from(result!.bytes)).toEqual([1, 2, 3]);
  });

  it('returns null for a non-data-URL string', () => {
    expect(decodeDataUrl('https://example.com/a.png')).toBeNull();
  });

  it('returns null for a data URL that is not base64-encoded', () => {
    expect(decodeDataUrl('data:text/plain,hello')).toBeNull();
  });
});

describe('extensionForMime', () => {
  it('maps known mime types to their extension', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('image/jpg')).toBe('jpg');
    expect(extensionForMime('image/gif')).toBe('gif');
    expect(extensionForMime('image/bmp')).toBe('bmp');
    expect(extensionForMime('image/svg+xml')).toBe('svg');
  });

  it('defaults unknown mime types to png', () => {
    expect(extensionForMime('image/webp')).toBe('png');
    expect(extensionForMime('image/png')).toBe('png');
  });
});

describe('scaledSize', () => {
  it('scales down to the requested width, preserving aspect ratio', () => {
    expect(scaledSize({ width: 400, height: 200 }, 200)).toEqual({ width: 200, height: 100 });
  });

  it('falls back to natural width when no width is requested', () => {
    expect(scaledSize({ width: 400, height: 200 }, null)).toEqual({ width: 400, height: 200 });
    expect(scaledSize({ width: 400, height: 200 }, undefined)).toEqual({ width: 400, height: 200 });
  });

  it('caps the target width at maxWidth even if a larger width was requested', () => {
    expect(scaledSize({ width: 1000, height: 500 }, 900, 600)).toEqual({ width: 600, height: 300 });
  });

  it('caps the natural width at the default maxWidth of 600 when no width is requested', () => {
    expect(scaledSize({ width: 1200, height: 300 }, null)).toEqual({ width: 600, height: 150 });
  });

  it('avoids dividing by zero when natural width is 0 (scale factor falls back to 1)', () => {
    // targetWidth is still the requested width (200); only the scale factor (used for height)
    // falls back to 1 to avoid a NaN from dividing by a natural width of 0.
    expect(scaledSize({ width: 0, height: 50 }, 200)).toEqual({ width: 200, height: 50 });
  });
});
