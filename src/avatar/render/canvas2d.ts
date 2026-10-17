import type { AvatarItem, AvatarRenderer, Channels, EyeSpec, Primitive3D } from '../types.js';
import { customAccessoryDrawer, customBodyDrawer, customEyeDrawer } from '../catalog.js';
import { createRandom } from '../random.js';

export interface Canvas2DOptions {
  alpha?: boolean;
}

interface DrawBox {
  cx: number;
  cy: number;
  radius: number;
  size: number;
}

const TAU = Math.PI * 2;

function superellipsePath(ctx: CanvasRenderingContext2D, rx: number, ry: number, exponent: number): void {
  const steps = 64;
  const n = Math.max(0.6, exponent);
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * TAU;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const x = Math.sign(cos) * Math.abs(cos) ** (2 / n) * rx;
    const y = Math.sign(sin) * Math.abs(sin) ** (2 / n) * ry;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function polygonPath(ctx: CanvasRenderingContext2D, radius: number, sides: number, star = false): void {
  ctx.beginPath();
  const points = star ? sides * 2 : sides;
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * TAU - Math.PI / 2;
    const inner = 0.52;
    const r = star ? (i % 2 === 0 ? radius : radius * inner) : radius;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function teardropPath(ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.15);
  ctx.bezierCurveTo(radius * 0.95, -radius * 0.25, radius * 0.85, radius * 0.95, 0, radius);
  ctx.bezierCurveTo(-radius * 0.85, radius * 0.95, -radius * 0.95, -radius * 0.25, 0, -radius * 1.15);
  ctx.closePath();
}

function bodyPath(ctx: CanvasRenderingContext2D, item: AvatarItem, r: number): void {
  const { shape, radius, segments } = item.body;
  switch (shape) {
    case 'capsule':
      ctx.beginPath();
      ctx.roundRect(-r * 0.78, -r, r * 1.56, r * 2, r * 0.78);
      break;
    case 'rounded-box':
      ctx.beginPath();
      ctx.roundRect(-r * 0.92, -r * 0.92, r * 1.84, r * 1.84, r * (0.12 + radius * 1.2));
      break;
    case 'disc':
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.08, r * 0.72, 0, 0, TAU);
      break;
    case 'hexagon':
      polygonPath(ctx, r, Math.max(3, segments));
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.08);
      ctx.lineTo(r * 0.82, 0);
      ctx.lineTo(0, r * 1.08);
      ctx.lineTo(-r * 0.82, 0);
      ctx.closePath();
      break;
    case 'star':
      polygonPath(ctx, r, Math.max(3, segments), true);
      break;
    case 'teardrop':
      teardropPath(ctx, r);
      break;
    default:
      superellipsePath(ctx, r, r, 2.2 + radius * 3.4);
  }
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  item: AvatarItem,
  eye: EyeSpec,
  x: number,
  y: number,
  ch: Channels,
): void {
  const custom = customEyeDrawer(eye.kind);
  if (custom) {
    custom(ctx, eye, { cx: x, cy: y, radius: eye.size * 100, size: eye.size * 200 }, ch, x);
    return;
  }

  const s = eye.size;
  const lid = Math.max(0, Math.min(1, ch.lid));
  const px = x + ch.pupilX * s * 0.35;
  const py = y + ch.pupilY * s * 0.3;
  const open = 1 - lid;
  if (open <= 0.04) {
    // Fully closed: a simple lash line reads better than a squashed shape.
    ctx.strokeStyle = eye.color;
    ctx.lineWidth = Math.max(1.2, s * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.7, y);
    ctx.lineTo(x + s * 0.7, y);
    ctx.stroke();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(x - s * 1.6, y - s * 1.6, s * 3.2, s * 3.2 * open);
  ctx.clip();

  ctx.fillStyle = eye.color;
  switch (eye.kind) {
    case 'oval':
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.62, s * 0.82, 0, 0, TAU);
      ctx.fill();
      break;
    case 'happy':
      ctx.strokeStyle = eye.color;
      ctx.lineWidth = Math.max(1.6, s * 0.24);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y + s * 0.2, s * 0.72, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      break;
    case 'sleepy':
      ctx.strokeStyle = eye.color;
      ctx.lineWidth = Math.max(1.6, s * 0.22);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y - s * 0.25, s * 0.72, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    case 'star': {
      ctx.beginPath();
      const points = 5;
      for (let i = 0; i <= points * 2; i += 1) {
        const a = (i / (points * 2)) * TAU - Math.PI / 2;
        const r = i % 2 === 0 ? s * 0.9 : s * 0.42;
        const vx = x + Math.cos(a) * r;
        const vy = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'spiral': {
      ctx.strokeStyle = eye.color;
      ctx.lineWidth = Math.max(1.2, s * 0.16);
      ctx.beginPath();
      for (let i = 0; i <= 60; i += 1) {
        const a = (i / 60) * TAU * 2.4 + ch.yaw;
        const r = (i / 60) * s * 0.85;
        const vx = x + Math.cos(a) * r;
        const vy = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.stroke();
      break;
    }
    case 'goggle': {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, s * 0.86, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = eye.color;
      ctx.lineWidth = Math.max(1.4, s * 0.2);
      ctx.stroke();
      ctx.fillStyle = eye.color;
      ctx.beginPath();
      ctx.arc(px, py, s * 0.38, 0, TAU);
      ctx.fill();
      break;
    }
    case 'cyclops': {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.86, s * 0.78, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = eye.color;
      ctx.beginPath();
      ctx.arc(px, py, s * 0.46, 0, TAU);
      ctx.fill();
      break;
    }
    default:
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.58, s * 0.68, 0, 0, TAU);
      ctx.fill();
  }

  if (eye.highlight && eye.kind !== 'happy' && eye.kind !== 'sleepy') {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - s * 0.22, y - s * 0.26, Math.max(0.8, s * 0.19), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawMouth(ctx: CanvasRenderingContext2D, item: AvatarItem, ch: Channels, box: DrawBox): void {
  const { mouth } = item;
  const w = mouth.width * box.radius * ch.mouthWidth;
  const y = mouth.y * box.radius;
  const open = Math.max(0, Math.min(1, ch.mouthOpen));
  const smile = Math.max(-1, Math.min(1, ch.smile));
  ctx.strokeStyle = mouth.color;
  ctx.fillStyle = mouth.color;
  ctx.lineWidth = Math.max(1.4, box.radius * 0.055);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (mouth.kind) {
    case 'flat':
      ctx.beginPath();
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(w / 2, y);
      ctx.stroke();
      break;
    case 'open': {
      const h = box.radius * (0.06 + open * 0.34);
      ctx.beginPath();
      ctx.ellipse(0, y + h * 0.2, w * 0.42, Math.max(h * 0.5, box.radius * 0.045), 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'cat':
      ctx.beginPath();
      ctx.moveTo(-w / 2, y - box.radius * 0.02);
      ctx.quadraticCurveTo(-w / 4, y + box.radius * 0.09 + open * box.radius * 0.12, 0, y);
      ctx.quadraticCurveTo(
        w / 4,
        y + box.radius * 0.09 + open * box.radius * 0.12,
        w / 2,
        y - box.radius * 0.02,
      );
      ctx.stroke();
      break;
    case 'grin': {
      const h = box.radius * (0.08 + open * 0.2);
      ctx.beginPath();
      ctx.roundRect(-w / 2, y - h / 2, w, h, h * 0.4);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(1, box.radius * 0.03);
      ctx.beginPath();
      ctx.moveTo(-w / 2 + w * 0.12, y);
      ctx.lineTo(w / 2 - w * 0.12, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'dot':
      ctx.beginPath();
      ctx.arc(0, y, box.radius * (0.05 + open * 0.12), 0, TAU);
      ctx.fill();
      break;
    default: {
      // Smile: curvature follows the smile channel, openness opens an ellipse.
      const curve = box.radius * (0.04 + (smile + 1) * 0.075);
      if (open > 0.28) {
        const h = box.radius * (0.08 + open * 0.3);
        ctx.beginPath();
        ctx.moveTo(-w / 2, y - curve * 0.4);
        ctx.quadraticCurveTo(0, y + curve, w / 2, y - curve * 0.4);
        ctx.quadraticCurveTo(0, y + curve * 0.4 + h, -w / 2, y - curve * 0.4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(-w / 2, y - curve * 0.5);
        ctx.quadraticCurveTo(0, y + curve, w / 2, y - curve * 0.5);
        ctx.stroke();
      }
    }
  }
}

function drawAccessory(
  ctx: CanvasRenderingContext2D,
  item: AvatarItem,
  ch: Channels,
  box: DrawBox,
  index: number,
): void {
  for (const spec of item.accessories) {
    const custom = customAccessoryDrawer(spec.kind);
    if (custom) {
      custom({ ctx, spec, box, channels: ch, item });
      continue;
    }
    const r = box.radius * spec.scale;
    const swing = ch.swing * 0.25 + spec.angle;
    ctx.save();
    ctx.translate(0, -r * 0.92);
    ctx.rotate(swing);
    ctx.fillStyle = spec.color;
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = Math.max(1.4, r * 0.06);
    ctx.lineCap = 'round';

    switch (spec.kind) {
      case 'antenna': {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r * 0.42);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -r * 0.52, r * 0.13, 0, TAU);
        ctx.fill();
        break;
      }
      case 'propeller': {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r * 0.3);
        ctx.stroke();
        const spin = ch.yaw * 3;
        for (let i = 0; i < 2; i += 1) {
          const a = spin + (i * Math.PI) / 2;
          ctx.beginPath();
          ctx.ellipse(
            Math.cos(a) * r * 0.22,
            -r * 0.34 + Math.sin(a) * r * 0.05,
            r * 0.3,
            r * 0.08,
            a,
            0,
            TAU,
          );
          ctx.fill();
        }
        break;
      }
      case 'halo': {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = spec.color;
        ctx.lineWidth = Math.max(1.6, r * 0.07);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.5, r * 0.42, r * 0.13, 0, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'crown': {
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, 0);
        ctx.lineTo(-r * 0.4, -r * 0.28);
        ctx.lineTo(-r * 0.2, -r * 0.1);
        ctx.lineTo(0, -r * 0.36);
        ctx.lineTo(r * 0.2, -r * 0.1);
        ctx.lineTo(r * 0.4, -r * 0.28);
        ctx.lineTo(r * 0.4, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'horns': {
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(dir * r * 0.42, r * 0.05);
          ctx.quadraticCurveTo(dir * r * 0.62, -r * 0.3, dir * r * 0.3, -r * 0.36);
          ctx.quadraticCurveTo(dir * r * 0.44, -r * 0.12, dir * r * 0.3, r * 0.02);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'ears': {
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(dir * r * 0.34, r * 0.02);
          ctx.lineTo(dir * r * 0.5, -r * 0.52);
          ctx.lineTo(dir * r * 0.12, -r * 0.16);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'cap': {
        ctx.beginPath();
        ctx.arc(0, r * 0.02, r * 0.5, Math.PI, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(r * 0.28, r * 0.02, r * 0.44, r * 0.09, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -r * 0.42, r * 0.07, 0, TAU);
        ctx.fill();
        break;
      }
      case 'beanie': {
        ctx.beginPath();
        ctx.arc(0, r * 0.04, r * 0.52, Math.PI, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#000000';
        ctx.fillRect(-r * 0.52, -r * 0.06, r * 1.04, r * 0.1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = spec.color;
        ctx.beginPath();
        ctx.arc(0, -r * 0.5, r * 0.13, 0, TAU);
        ctx.fill();
        break;
      }
      case 'headphones': {
        ctx.lineWidth = Math.max(2, r * 0.09);
        ctx.beginPath();
        ctx.arc(0, r * 0.1, r * 0.56, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.roundRect(dir * r * 0.5 - r * 0.1, -r * 0.02, r * 0.2, r * 0.34, r * 0.09);
          ctx.fill();
        }
        break;
      }
      case 'glasses': {
        ctx.restore();
        ctx.save();
        ctx.lineWidth = Math.max(1.4, r * 0.05);
        ctx.strokeStyle = spec.color;
        const eyeY = (item.eyes[0]?.y ?? -0.06) * box.radius;
        const spacing = (item.eyes[0]?.spacing ?? 0.34) * box.radius;
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.arc((dir * spacing) / 2, eyeY, r * 0.19, 0, TAU);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(-spacing / 2 + r * 0.19, eyeY);
        ctx.lineTo(spacing / 2 - r * 0.19, eyeY);
        ctx.stroke();
        break;
      }
      case 'visor': {
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = spec.color;
        const eyeY = (item.eyes[0]?.y ?? -0.06) * box.radius;
        ctx.beginPath();
        ctx.roundRect(-r * 0.66, eyeY - r * 0.18, r * 1.32, r * 0.36, r * 0.18);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'bowtie': {
        ctx.restore();
        ctx.save();
        ctx.translate(0, r * 0.72);
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(dir * r * 0.26, -r * 0.14);
          ctx.lineTo(dir * r * 0.26, r * 0.14);
          ctx.closePath();
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.05, 0, TAU);
        ctx.fill();
        break;
      }
      case 'scarf': {
        ctx.restore();
        ctx.save();
        ctx.translate(0, r * 0.7);
        ctx.beginPath();
        ctx.roundRect(-r * 0.56, -r * 0.1, r * 1.12, r * 0.2, r * 0.1);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(r * 0.16, r * 0.02, r * 0.18, r * 0.34, r * 0.08);
        ctx.fill();
        break;
      }
      case 'badge': {
        ctx.restore();
        ctx.save();
        ctx.translate(-r * 0.46, r * 0.34);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.14, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-r * 0.04, -r * 0.04, r * 0.05, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      default:
        ctx.beginPath();
        ctx.arc(0, -r * 0.4, r * 0.16, 0, TAU);
        ctx.fill();
    }
    ctx.restore();
    void index;
  }
}

/** Canvas 2D avatar renderer. Pure drawing: it never touches layout or timers. */
export class Canvas2DRenderer implements AvatarRenderer {
  readonly mode = '2d' as const;
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D | null;
  #dpr = 1;
  #width = 0;
  #height = 0;

  constructor(canvas: HTMLCanvasElement, _options: Canvas2DOptions = {}) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d', { alpha: _options.alpha ?? true });
  }

  resize(width: number, height: number, dpr: number): void {
    this.#width = Math.max(1, Math.round(width));
    this.#height = Math.max(1, Math.round(height));
    this.#dpr = Math.max(1, Math.min(dpr, 3));
    this.#canvas.width = Math.round(this.#width * this.#dpr);
    this.#canvas.height = Math.round(this.#height * this.#dpr);
  }

  render(item: AvatarItem, ch: Channels, time: number): void {
    const ctx = this.#ctx;
    if (!ctx || this.#width === 0) return;
    const { width, height } = this;
    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const box: DrawBox = {
      cx: width / 2,
      cy: height / 2,
      radius: (Math.min(width, height) / 2) * 0.78,
      size: Math.min(width, height),
    };

    const bob = ch.bob * box.radius;
    const sway = ch.sway * box.radius;
    const squash = 1 + ch.breath;
    const stretch = 1 - ch.breath * 0.55;
    const r = box.radius * item.body.scale * item.body.aspect * ch.scale;

    // Ground shadow tracks the bob to sell the weight of the character.
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, 0.22 - ch.bob * 0.18);
    ctx.fillStyle = '#0b1220';
    ctx.beginPath();
    ctx.ellipse(box.cx, box.cy + box.radius * 1.12, r * (0.62 - ch.bob * 0.12), r * 0.14, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (ch.glow > 0.02) {
      const gradient = ctx.createRadialGradient(box.cx, box.cy, r * 0.7, box.cx, box.cy, r * 1.5);
      gradient.addColorStop(0, item.palette.accent);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalAlpha = Math.min(0.55, ch.glow * 0.5);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(box.cx, box.cy, r * 1.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(box.cx + sway, box.cy + bob);
    ctx.rotate(ch.tilt + ch.roll * 0.4);

    const customBody = customBodyDrawer(item.body.shape);
    if (customBody) {
      ctx.save();
      ctx.scale(stretch, squash);
      customBody(ctx, item.body, box, ch);
      ctx.restore();
    } else {
      // Squash & stretch anchored at the feet so the body does not float.
      ctx.translate(0, r * (1 - squash));
      ctx.scale(stretch, squash);
      const gradient = ctx.createLinearGradient(0, -r, 0, r);
      gradient.addColorStop(0, item.palette.light);
      gradient.addColorStop(0.55, item.palette.base);
      gradient.addColorStop(1, item.palette.dark);
      bodyPath(ctx, item, r);
      ctx.fillStyle = gradient;
      ctx.fill();
      if (item.features.outline) {
        ctx.lineWidth = Math.max(1.5, r * 0.045);
        ctx.strokeStyle = item.palette.outline;
        ctx.stroke();
      }
    }

    if (item.features.shine) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-r * 0.34, -r * 0.44, r * 0.2, r * 0.11, -0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (item.features.spots > 0) {
      const rng = createRandom(`${item.hash}:spots`);
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = item.palette.dark;
      for (let i = 0; i < item.features.spots; i += 1) {
        const angle = rng.range(0, TAU);
        const dist = rng.range(0.25, 0.72) * r;
        ctx.beginPath();
        ctx.ellipse(Math.cos(angle) * dist, Math.sin(angle) * dist, r * 0.09, r * 0.07, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    if (item.features.seam) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = item.palette.outline;
      ctx.lineWidth = Math.max(1, r * 0.025);
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, r * 0.42);
      ctx.quadraticCurveTo(0, r * 0.54, r * 0.9, r * 0.42);
      ctx.stroke();
      ctx.restore();
    }

    if (item.features.blush) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.max(0, ch.smile) * 0.35;
      ctx.fillStyle = item.palette.cheek;
      const spacing = (item.eyes[0]?.spacing ?? 0.34) * r;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(
          (dir * spacing) / 2 + dir * r * 0.08,
          item.mouth.y * r - r * 0.1,
          r * 0.14,
          r * 0.08,
          0,
          0,
          TAU,
        );
        ctx.fill();
      }
      ctx.restore();
    }

    // Eyes
    const primary = item.eyes[0];
    if (primary) {
      const spacing = primary.spacing * r;
      const eyeY = primary.y * r;
      if (item.eyes.length === 1) {
        drawEye(ctx, item, primary, 0, eyeY, ch);
      } else {
        const phase = primary.independentBlink ? 0.12 : 0;
        drawEye(ctx, item, primary, -spacing / 2, eyeY, ch);
        drawEye(ctx, item, { ...primary, blinkPhase: primary.blinkPhase + phase }, spacing / 2, eyeY, ch);
      }
    }

    if (ch.brow > 0.05) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.9, ch.brow);
      ctx.strokeStyle = item.palette.outline;
      ctx.lineWidth = Math.max(1.4, r * 0.045);
      ctx.lineCap = 'round';
      const spacing = (item.eyes[0]?.spacing ?? 0.34) * r;
      const size = item.eyes[0]?.size ?? 0.15;
      const browY = (item.eyes[0]?.y ?? -0.06) * r - size * r * 1.15;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo((dir * spacing) / 2 - size * r * 0.5, browY + ch.brow * r * 0.05);
        ctx.lineTo((dir * spacing) / 2 + dir * size * r * 0.5, browY - ch.brow * r * 0.06);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawMouth(ctx, item, ch, { ...box, radius: r });
    drawAccessory(ctx, item, ch, { ...box, radius: r }, 0);

    ctx.restore();
    void time;
  }

  get width(): number {
    return this.#width;
  }

  get height(): number {
    return this.#height;
  }

  destroy(): void {
    this.#ctx = null;
  }
}

export type { Primitive3D };
