/** Nominal square companion footprint in CSS pixels, independent of zoom. */
export const SIZE_RANGE = Object.freeze({ min: 1, max: 2048, default: 200 });
export function validateSize(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < SIZE_RANGE.min || value > SIZE_RANGE.max) {
        throw new TypeError('size must be a finite number between 1 and 2048 CSS pixels');
    }
    return value;
}
