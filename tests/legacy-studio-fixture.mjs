/** Historical serialized data, intentionally independent of the current schema. */
export function legacyStudioDesign(design, version = 5) {
  const state = side => version <= 3
    ? { expression: design.eyes[side].weights.smile ? 'smile' : 'neutral', openness: 1 - design.eyes[side].weights.blink }
    : { weights: { ...design.eyes[side].weights }, targets: { smile: version === 4 ? { width: 1.72, arc: 0.35, thickness: 0.22 } : { radius: 0.75, thickness: 0.22 }, blink: { thickness: 0.16 } } };
  const eyes = { shape: 'capsule', width: 0.16, height: 0.34, spacing: 0.64, scale: 1, color: design.eyes.color,
    anchor: { region: 'face', uv: [0, 0.1], offset: 0 }, left: state('left'), right: state('right') };
  const body = version <= 2
    ? { shape: { kind: 'material', name: design.body.shape }, size: [1.12, 1.18, 0.9], roundness: 0.68, taper: 0, bulge: 0.05, bend: 0, color: design.body.color }
    : { ...design.body };
  return { version, body, eyes: version === 1 ? { preset: 'capsule', anchor: eyes.anchor, spacing: eyes.spacing, scale: eyes.scale, color: eyes.color } : eyes,
    accessories: design.accessories.map(item => ({ ...item,
      anchor: { region: item.preset === 'glasses' ? 'face' : 'crown', uv: [0, item.preset === 'glasses' ? 0.1 : 0], offset: item.preset === 'halo' ? 0.22 : item.preset === 'beret' ? 0.035 : 0 },
      scale: 1, rotation: [0, item.preset === 'beret' ? -0.16 : 0, 0], follow: item.preset === 'glasses' ? 0 : 0.5,
    })) };
}
