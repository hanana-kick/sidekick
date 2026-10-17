/** RGBA bytes in row order. Row orientation is preserved by the pure crop helper. */
export interface PixelBuffer { width: number; height: number; pixels: Uint8Array | Uint8ClampedArray }
export interface AlphaBounds { x: number; y: number; width: number; height: number }
export interface SnapshotOptions { crop?: boolean; padding?: number }

export function validateSnapshotOptions(options: SnapshotOptions = {}): Required<SnapshotOptions> {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('snapshot options must be an object');
  for (const key of Reflect.ownKeys(options)) if (key !== 'crop' && key !== 'padding') throw new TypeError(`unknown snapshot option: ${String(key)}`);
  if (options.crop !== undefined && typeof options.crop !== 'boolean') throw new TypeError('crop must be a boolean');
  const padding = options.padding ?? 0;
  if (!Number.isInteger(padding) || padding < 0 || padding > 4096) throw new RangeError('padding must be an integer from 0 to 4096');
  return { crop: options.crop ?? true, padding };
}
function validatePixels(image: PixelBuffer): void {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1) throw new RangeError('pixel dimensions must be positive integers');
  const length = image.width * image.height * 4;
  if (!Number.isSafeInteger(length) || !(image.pixels instanceof Uint8Array || image.pixels instanceof Uint8ClampedArray) || image.pixels.length !== length) throw new TypeError('expected width × height RGBA bytes');
}
/** Include every nonzero-alpha pixel, including barely visible antialiased edges. */
export function alphaBounds(image: PixelBuffer): AlphaBounds | null {
  validatePixels(image);
  const { width, height, pixels } = image;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] === 0) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
/** Exact byte copy with transparent padding; an empty crop is transparent 1 × 1. */
export function cropPixels(image: PixelBuffer, options: SnapshotOptions = {}): PixelBuffer & { bounds: AlphaBounds | null } {
  const { crop, padding } = validateSnapshotOptions(options);
  validatePixels(image);
  const bounds = crop ? alphaBounds(image) : { x: 0, y: 0, width: image.width, height: image.height };
  const width = (bounds?.width ?? 1) + 2 * padding, height = (bounds?.height ?? 1) + 2 * padding;
  const pixels = new Uint8Array(width * height * 4);
  if (bounds) for (let y = 0; y < bounds.height; y++) {
    const from = ((bounds.y + y) * image.width + bounds.x) * 4;
    pixels.set(image.pixels.subarray(from, from + bounds.width * 4), ((y + padding) * width + padding) * 4);
  }
  return { width, height, pixels, bounds };
}
