# sidekick

Embeddable **bot avatar** web components. A single custom element renders an animated bot
anywhere on the page — 2D or 3D, both on `<canvas>`, zero rendering dependencies.

```html
<script type="module" src="https://cdn.example.com/sidekick/dist/sidekick.bundle.js"></script>
<skk-bot seed="hana" state="thinking"></skk-bot>
```

## Install

```sh
pnpm add sidekick
```

```ts
import { defineElements } from 'sidekick'; // side-effect free
defineElements(); // registers <skk-avatar>, <skk-bot>, <skk-bubble>

// or auto-register:
import 'sidekick/elements';
```

Subpath exports: `sidekick`, `sidekick/avatar`, `sidekick/theme`, `sidekick/elements`, `sidekick/react`.

## Avatar engine

An `AvatarItem` is a plain, JSON-serialisable description of a bot: body shape, eyes,
mouth, accessories, palette and animation rig. Generate one from a hash, or describe it
explicitly.

```ts
import { avatarFromHash, createAvatar, randomAvatar } from 'sidekick/avatar';

// Deterministic: the same seed always produces the same bot.
const bot = avatarFromHash('hana', {
  mode: '3d',
  hue: 210, // pin the palette (saturation / lightness / scheme also accepted)
  scheme: 'triad',
  accessories: ['antenna', 'glasses'], // or 'auto' | 0..3
  shapes: ['capsule', 'rounded-box'], // restrict the silhouette pool
});

// Explicit: name every part.
const custom = createAvatar({
  seed: 'custom',
  shape: 'capsule',
  eyes: { kind: 'star', size: 1.1, spacing: 0.36 },
  mouth: { kind: 'grin', width: 0.5 },
  accessories: [{ kind: 'cap', color: '#f6c453' }],
  hue: 18,
  saturation: 0.7,
  lightness: 0.55,
});

JSON.stringify(custom); // storable; restore with deserializeAvatar()
```

Extend the catalog with your own parts:

```ts
import { defineAccessory, defineBodyShape, defineEye } from 'sidekick/avatar';

defineBodyShape({ kind: 'hexnut', mesh3d: 'cylinder', weight: 1 });
defineEye({ kind: 'wink', defaultSize: 1, blinkable: true, count: 2, weight: 1 });
defineAccessory(
  { kind: 'box-halo', slots: ['top'], weight: 1 },
  {
    draw2d: ({ ctx, box }) => ctx.strokeRect(box.cx - box.radius, box.cy, box.radius, box.radius),
    build3d: () => [{ kind: 'torus', position: [0, 1.3, 0], scale: [0.6, 0.6, 0.6] }],
  },
);
```

### Animation

`AvatarAnimator` drives ~20 channels (`breath`, `bob`, `sway`, `blink`, `mouthOpen`,
`pupilX/Y`, `yaw`, `glow`, …) with damped springs, layered oscillators and a randomised
blink envelope. The bot `state` (pose) and `mood` set targets; pointer gaze is added on
top and also applies to static / reduced-motion frames.

```ts
import { createAvatarEngine } from 'sidekick/avatar';

const engine = createAvatarEngine({ canvas, item: bot, mode: '3d' });
engine.setState('speaking');
engine.setPointer(0.4, -0.2);
engine.getChannels(); // snap-evaluated channels
engine.destroy();
```

Renderers: `Canvas2DRenderer` (2D) and `WebGL3DRenderer` (hand-written WebGL2, no
three.js). If WebGL2 is unavailable — or the shared budget of `MAX_WEBGL_CONTEXTS = 8`
contexts is exhausted — the engine falls back to Canvas2D and reports `engine.fellBack`.
Pass `allow2DFallback: false` to throw instead.

## Components

### `<skk-avatar>`

Pure presentation: one avatar inside your layout flow.

```html
<skk-avatar seed="hana" mode="3d" size="128" state="thinking" shape="capsule"></skk-avatar>
```

`getAvatar()` / `setAvatar(item)` / `refresh()` / `toDataURL()` are available on the element.

### `<skk-bot>`

A floating assistant: placement, drag, persistence and a state machine.

```html
<skk-bot seed="bot" position="bottom-right" margin="16" persist="main-bot" drag></skk-bot>
```

| Attribute                                                      | Meaning                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `position-mode`                                                | `viewport` (fixed) · `contained` (absolute in ancestor) · `anchor` · `free` |
| `position`                                                     | 3×3 keyword (`top-left` … `center` … `bottom-right`)                        |
| `anchor-selector`, `placement`, `alignment`, `gap`             | attach to another element; `placement: auto` picks the roomiest side        |
| `offset-x`, `offset-y`, `margin`, `padding`, `snap`, `z-index` | spacing knobs; everything is viewport clamped (`clamped` on the result)     |
| `state`                                                        | `idle · listening · thinking · speaking · success · error · sleeping`       |
| `drag`, `persist`                                              | pointer dragging, position stored in localStorage under `persist`           |
| `portal`                                                       | move the host to `<body>` so ancestors cannot clip it                       |

```ts
bot.request('thinking'); // transient states (success/error) revert automatically
bot.moveTo(240, 180, { persist: true });
bot.resetPosition();
```

### `<skk-bubble>`

```html
<skk-bot seed="bot"><skk-bubble slot="bubble" variant="info">Hello!</skk-bubble></skk-bot>
```

`bubble.show('Working…', { variant: 'thinking', duration: 2500 })`, `role`/`aria-live`
per variant, `close()` on click or Escape.

### React

```tsx
import { SkkBot, requestState } from 'sidekick/react';

<SkkBot seed="bot" size={96} position="bottom-right" drag />;
```

### Theming

```ts
import { applyTheme, DEFAULT_TOKENS } from 'sidekick/theme';
applyTheme(document, { ...DEFAULT_TOKENS, focus: '#7c5cff', zIndex: '10000' });
```

## Development

```sh
pnpm dev        # playground on the Vite dev server
pnpm test       # vitest (jsdom + canvas stubs)
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
pnpm build      # ESM entries + IIFE bundle + .d.ts into dist/
```

## Notes

- Requires Canvas 2D; 3D needs WebGL2 and falls back automatically.
- `prefers-reduced-motion` switches the animator to static poses and skips blinks.
- The full single-file IIFE bundle is ≈28 kB gzipped (including Lit).
