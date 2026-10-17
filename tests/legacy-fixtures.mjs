/** Frozen-era saved-document fixtures, deliberately independent of current factories. */
export function legacyAccessory(preset = 'beret', id = preset) {
  return {
    id, preset, slot: preset === 'glasses' ? 'face' : 'head',
    anchor: { region: preset === 'glasses' ? 'face' : 'crown', uv: [0, preset === 'glasses' ? 0.1 : 0], offset: preset === 'halo' ? 0.22 : preset === 'glasses' ? 0 : 0.035 },
    color: preset === 'beret' ? '#b84742' : preset === 'halo' ? '#f7cc5b' : '#31323d',
    scale: 1, rotation: [0, preset === 'beret' ? -0.16 : 0, 0], follow: preset === 'glasses' ? 0 : 0.5,
  };
}
export function legacyDesign(version = 5) {
  if (version === 6) return {
    version, body: { shape: 'square', color: '#e9b64d' },
    eyes: { color: '#24242c', left: { weights: { smile: 0, blink: 0 } }, right: { weights: { smile: 0, blink: 0 } } },
    accessories: [],
  };
  const state = () => version < 4 ? { expression: 'neutral', openness: 1 } : {
    weights: { smile: 0, blink: 0 },
    targets: { smile: version === 4 ? { width: 1.75, arc: 0.35, thickness: 0.22 } : { radius: 0.75, thickness: 0.22 }, blink: { thickness: 0.16 } },
  };
  return {
    version,
    body: version < 3 ? { shape: 'rounded-box', size: [1.12, 1.18, 0.9], roundness: 0.68, taper: 0, bulge: 0.05, bend: 0, color: '#e9b64d' } : { shape: 'square', color: '#e9b64d' },
    eyes: version === 1 ? { preset: 'capsule', anchor: { region: 'face', uv: [0, 0.1], offset: 0.026 }, spacing: 0.64, scale: 1, color: '#24242c' } : {
      shape: 'capsule', width: 0.16, height: 0.34, left: state(), right: state(), anchor: { region: 'face', uv: [0, 0.1], offset: 0 }, spacing: 0.64, scale: 1, color: '#24242c',
    }, accessories: [],
  };
}
