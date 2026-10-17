import type { AccessorySpec, AvatarItem, Channels, Primitive3D } from '../../types.js';
import { customAccessoryBuilder, getAccessoryDef } from '../../catalog.js';
import type { Vec3 } from './math.js';

const WHITE: Vec3 = [1, 1, 1];
const DARK: Vec3 = [0.11, 0.13, 0.18];

type PartInput = Partial<Primitive3D> & Pick<Primitive3D, 'kind' | 'color'>;

function part(partial: PartInput): Primitive3D {
  return Object.assign(
    { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    partial,
  ) as Primitive3D;
}

/**
 * Builds the part list for one frame, in character-local space (body radius = 1).
 * The renderer multiplies every part by the shared character transform, so the
 * whole avatar bobs/tilts/breathes as a single rigid group.
 */
export function buildParts(item: AvatarItem, ch: Channels): Primitive3D[] {
  const parts: Primitive3D[] = [];
  const bodyMesh = item.body.mesh3d ?? 'sphere';
  const depth = bodyMesh === 'disc' ? 0.42 : bodyMesh === 'box' ? 0.82 : 0.9;

  parts.push(
    part({
      kind: bodyMesh,
      segments: bodyMesh === 'sphere' || bodyMesh === 'box' ? 24 : 20,
      scale: [item.body.aspect, 1, depth],
      color: item.paletteNumeric.base,
      emissive: item.paletteNumeric.accent.map((c) => c * Math.min(1, ch.glow) * 0.35) as Vec3,
    }),
  );

  if (item.features.seam) {
    parts.push(
      part({
        kind: 'torus',
        position: [0, -0.52, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: [0.92 * item.body.aspect, 0.92, 0.92],
        color: item.paletteNumeric.dark,
      }),
    );
  }

  if (item.features.spots > 0) {
    for (let i = 0; i < Math.min(5, item.features.spots); i += 1) {
      const a = (i / Math.max(1, item.features.spots)) * Math.PI * 2 + 0.6;
      parts.push(
        part({
          kind: 'sphere',
          segments: 10,
          position: [Math.cos(a) * 0.5, -0.15 + Math.sin(a * 1.7) * 0.3, depth * 0.86],
          scale: [0.11, 0.09, 0.04],
          color: item.paletteNumeric.dark,
        }),
      );
    }
  }

  const primary = item.eyes[0];
  if (primary) {
    const lid = Math.max(0, Math.min(1, ch.lid));
    const openY = Math.max(0.06, 1 - lid * 0.95);
    const single = item.eyes.length === 1;
    const xs: number[] = single ? [0] : [-primary.spacing / 2, primary.spacing / 2];
    for (const ex of xs) {
      parts.push(
        part({
          kind: 'sphere',
          segments: 16,
          position: [ex, primary.y, depth * 0.88],
          scale: [primary.size * 0.62, primary.size * 0.72 * openY, primary.size * 0.4],
          color: primary.kind === 'dot' ? item.paletteNumeric.outline : WHITE,
        }),
      );
      parts.push(
        part({
          kind: 'sphere',
          segments: 14,
          position: [
            ex + ch.pupilX * primary.size * 0.22,
            primary.y + ch.pupilY * primary.size * 0.2,
            depth * 0.88 + primary.size * 0.34,
          ],
          scale: [primary.size * 0.34, primary.size * 0.4 * openY, primary.size * 0.22],
          color: item.paletteNumeric.outline,
        }),
      );
    }

    if (ch.brow > 0.06 && !single) {
      for (const ex of [-primary.spacing / 2, primary.spacing / 2]) {
        parts.push(
          part({
            kind: 'box',
            segments: 8,
            position: [ex, primary.y + primary.size * 1.25 + ch.brow * 0.06, depth * 0.92],
            rotation: [0, 0, ch.brow * 0.25],
            scale: [primary.size * 0.6, 0.035, 0.05],
            color: item.paletteNumeric.dark,
          }),
        );
      }
    }
  }

  if (item.features.blush) {
    for (const dir of [-1, 1]) {
      parts.push(
        part({
          kind: 'sphere',
          segments: 10,
          position: [dir * (primary?.spacing ?? 0.34) * 0.62, (primary?.y ?? 0) - 0.16, depth * 0.86],
          scale: [0.14, 0.08, 0.04],
          color: item.paletteNumeric.cheek,
          opacity: 0.65,
        }),
      );
    }
  }

  const open = Math.max(0, Math.min(1, ch.mouthOpen));
  parts.push(
    part({
      kind: open > 0.28 ? 'sphere' : 'box',
      segments: 12,
      position: [0, item.mouth.y, depth * 0.92],
      scale: [
        item.mouth.width * 0.5 * (0.7 + ch.mouthWidth * 0.35),
        (open > 0.28 ? 0.06 + open * 0.14 : 0.028) + Math.max(0, ch.smile) * 0.012,
        0.06,
      ],
      color: item.paletteNumeric.outline,
    }),
  );

  for (const spec of item.accessories) {
    if (!getAccessoryDef(spec.kind)) continue;
    const custom = customAccessoryBuilder(spec.kind);
    if (custom) {
      parts.push(...custom(spec, item));
      continue;
    }
    parts.push(...accessoryParts(item, spec, ch, depth));
  }

  return parts;
}

function accessoryParts(item: AvatarItem, spec: AccessorySpec, ch: Channels, depth: number): Primitive3D[] {
  const s = spec.scale;
  const color = item.paletteNumeric.accent;
  const swing = ch.swing * 0.4 + spec.angle;
  const out: Primitive3D[] = [];

  switch (spec.kind) {
    case 'antenna':
      out.push(
        part({
          kind: 'cylinder',
          segments: 10,
          position: [Math.sin(swing) * 0.12, 1.12 * s, 0],
          rotation: [0, 0, -swing],
          scale: [0.035, 0.16 * s, 0.035],
          color: item.paletteNumeric.dark,
        }),
        part({
          kind: 'sphere',
          segments: 14,
          position: [Math.sin(swing) * 0.26, 1.32 * s, 0],
          scale: [0.11 * s, 0.11 * s, 0.11 * s],
          color,
          emissive: color.map((c) => c * 0.4) as Vec3,
        }),
      );
      break;
    case 'propeller': {
      const spin = ch.yaw * 4;
      out.push(
        part({
          kind: 'cylinder',
          segments: 10,
          position: [0, 1.06 * s, 0],
          scale: [0.04, 0.1 * s, 0.04],
          color: item.paletteNumeric.dark,
        }),
      );
      for (let i = 0; i < 2; i += 1) {
        out.push(
          part({
            kind: 'box',
            segments: 6,
            position: [0, 1.18 * s, 0],
            rotation: [0, spin + (i * Math.PI) / 2, 0],
            scale: [0.42 * s, 0.02, 0.1 * s],
            color,
          }),
        );
      }
      break;
    }
    case 'halo':
      out.push(
        part({
          kind: 'torus',
          segments: 22,
          position: [0, 1.35 * s, 0],
          rotation: [Math.PI / 2, 0, 0],
          scale: [0.5 * s, 0.5 * s, 0.5 * s],
          color,
          emissive: color.map((c) => c * 0.6) as Vec3,
          opacity: 0.9,
        }),
      );
      break;
    case 'crown':
      out.push(
        part({
          kind: 'cylinder',
          segments: 16,
          position: [0, 1.06 * s, 0],
          scale: [0.52 * s, 0.13 * s, 0.52 * s],
          color,
        }),
      );
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        out.push(
          part({
            kind: 'cone',
            segments: 8,
            position: [Math.cos(a) * 0.42 * s, 1.24 * s, Math.sin(a) * 0.42 * s],
            scale: [0.1 * s, 0.16 * s, 0.1 * s],
            color,
          }),
        );
      }
      break;
    case 'horns':
      for (const dir of [-1, 1]) {
        out.push(
          part({
            kind: 'cone',
            segments: 10,
            position: [dir * 0.46 * s, 1.02 * s, 0],
            rotation: [0, 0, -dir * 0.5],
            scale: [0.12 * s, 0.3 * s, 0.12 * s],
            color: item.paletteNumeric.dark,
          }),
        );
      }
      break;
    case 'ears':
      for (const dir of [-1, 1]) {
        out.push(
          part({
            kind: 'cone',
            segments: 10,
            position: [dir * 0.4 * s, 1.05 * s, 0],
            rotation: [0, 0, -dir * 0.35],
            scale: [0.16 * s, 0.34 * s, 0.12 * s],
            color: item.paletteNumeric.base,
          }),
        );
      }
      break;
    case 'cap':
      out.push(
        part({
          kind: 'sphere',
          segments: 18,
          position: [0, 0.82 * s, 0],
          scale: [0.86 * s, 0.4 * s, 0.86 * s],
          color,
        }),
        part({
          kind: 'disc',
          segments: 18,
          position: [0.28 * s, 0.86 * s, 0.32 * s],
          rotation: [0, -0.3, -0.12],
          scale: [0.5 * s, 0.5 * s, 0.5 * s],
          color: item.paletteNumeric.dark,
        }),
      );
      break;
    case 'beanie':
      out.push(
        part({
          kind: 'sphere',
          segments: 18,
          position: [0, 0.78 * s, 0],
          scale: [0.9 * s, 0.44 * s, 0.9 * s],
          color,
        }),
        part({
          kind: 'torus',
          segments: 22,
          position: [0, 0.8 * s, 0],
          rotation: [Math.PI / 2, 0, 0],
          scale: [0.9 * s, 0.9 * s, 0.9 * s],
          color: item.paletteNumeric.dark,
        }),
      );
      break;
    case 'headphones': {
      out.push(
        part({
          kind: 'torus',
          segments: 24,
          position: [0, 0.7 * s, 0],
          rotation: [0, 0, Math.PI / 2],
          scale: [0.9 * s, 0.9 * s, 0.9 * s],
          color: item.paletteNumeric.dark,
        }),
      );
      for (const dir of [-1, 1]) {
        out.push(
          part({
            kind: 'sphere',
            segments: 14,
            position: [dir * 0.92 * s, 0.1 * s, 0],
            scale: [0.16 * s, 0.26 * s, 0.2 * s],
            color,
          }),
        );
      }
      break;
    }
    case 'glasses': {
      const ey = item.eyes[0]?.y ?? 0;
      const sp = item.eyes[0]?.spacing ?? 0.34;
      for (const dir of [-1, 1]) {
        out.push(
          part({
            kind: 'torus',
            segments: 18,
            position: [(dir * sp) / 2, ey, depth * 0.98],
            rotation: [Math.PI / 2, 0, 0],
            scale: [0.24, 0.24, 0.24],
            color: spec.colorNumeric ?? color,
            opacity: 0.95,
          }),
        );
      }
      out.push(
        part({
          kind: 'cylinder',
          segments: 8,
          position: [0, ey, depth * 0.98],
          rotation: [0, 0, Math.PI / 2],
          scale: [0.03, sp * 0.3, 0.03],
          color: spec.colorNumeric ?? color,
        }),
      );
      break;
    }
    case 'visor': {
      const ey = item.eyes[0]?.y ?? 0;
      out.push(
        part({
          kind: 'box',
          segments: 10,
          position: [0, ey, depth * 1.02],
          scale: [0.85, 0.16, 0.09],
          color: spec.colorNumeric ?? color,
          opacity: 0.8,
          emissive: [
            (spec.colorNumeric ?? color)[0] * 0.3,
            (spec.colorNumeric ?? color)[1] * 0.3,
            (spec.colorNumeric ?? color)[2] * 0.3,
          ] as Vec3,
        }),
      );
      break;
    }
    case 'bowtie':
      for (const dir of [-1, 1]) {
        out.push(
          part({
            kind: 'cone',
            segments: 8,
            position: [dir * 0.16, -0.78 * s, depth * 0.85],
            rotation: [0, 0, dir * (Math.PI / 2)],
            scale: [0.09 * s, 0.2 * s, 0.09 * s],
            color,
          }),
        );
      }
      break;
    case 'scarf':
      out.push(
        part({
          kind: 'torus',
          segments: 22,
          position: [0, -0.72 * s, 0],
          rotation: [Math.PI / 2, 0, 0],
          scale: [0.82 * s, 0.82 * s, 0.82 * s],
          color,
        }),
        part({
          kind: 'box',
          segments: 6,
          position: [0.3 * s, -0.95 * s, depth * 0.7],
          rotation: [0.2, 0, 0.15],
          scale: [0.12 * s, 0.3 * s, 0.05 * s],
          color,
        }),
      );
      break;
    case 'badge':
      out.push(
        part({
          kind: 'disc',
          segments: 16,
          position: [-0.42, -0.3, depth * 0.94],
          rotation: [0, 0.35, 0],
          scale: [0.12, 0.12, 0.12],
          color,
        }),
      );
      break;
    default:
      out.push(
        part({
          kind: 'sphere',
          segments: 12,
          position: [0, 1.15 * s, 0],
          scale: [0.12 * s, 0.12 * s, 0.12 * s],
          color,
        }),
      );
  }

  return out;
}

export const DEFAULT_3D_COLORS = { WHITE, DARK };
