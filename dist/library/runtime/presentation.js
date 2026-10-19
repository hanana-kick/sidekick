export function presentationSignature(image, bottomUp = false) {
    const { width, height, pixels } = image;
    let alpha = 2166136261, color = 2166136261;
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const i = ((bottomUp ? height - 1 - y : y) * width + x) * 4;
            alpha = Math.imul(alpha ^ (pixels[i + 3] > 127 ? 1 : 0), 16777619);
            // Opaque RGB survives the WebGL premultiplied -> 2D straight-alpha conversion
            // unchanged. Spatial hashing detects eye/accessory changes within the body.
            for (let c = 0; c < 3; c++)
                color = Math.imul(color ^ (pixels[i + 3] === 255 ? pixels[i + c] : 0), 16777619);
        }
    return { width, height, alpha, color };
}
export function matchesPresentation(a, b) {
    return a.width === b.width && a.height === b.height && a.alpha === b.alpha && a.color === b.color;
}
