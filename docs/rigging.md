# Bone poses and skinned accessories

Rigging is optional runtime state. Existing designs, accessories, and clips work without it. It is not saved in design JSON. Bone position and rotation are model-local, bind-relative deltas; they do not replace the avatar's screen position or its z-height travel controls.

## Body rig

```js
bot.setBodyRig({
  skeleton: { bones: [
    { id: 'root' },
    { id: 'upper', parent: 'root', position: [0, 0.3, 0] },
  ] },
  influences: [
    { bone: 'root', center: [0, -0.4, 0], radius: 1 },
    { bone: 'upper', center: [0, 0.5, 0], radius: 0.8 },
  ],
  fallbackBone: 'root',
  attachments: { head: 'upper' },
});
bot.setBonePose({ upper: { rotation: [0, 0, 0.2] } });
```

Influence centers and radii are in neutral body-local units. The four strongest nonzero radial weights are normalized. Outside all influence radii, `fallbackBone` (or the first bone) receives full weight. Bindings are regenerated for changed shape geometry, not authored against unstable vertex indices. This makes shape changes compatible with the same rig. Eye ink follows the deformed surface rather than staying behind.

Each slot in `attachments` follows that bone's deformation after normal attachment placement. Omitted slots retain the original attachment behavior. Skeleton bind positions are not added twice.

`bodyRig` and `getBonePose()` return owned copies. `setBonePose()` replaces the target pose and removes that target's bone tracks from the active clip, leaving other tracks unchanged. `clearBonePose()` restores its bind pose and takes the same ownership. `setBodyRig(null)` disables body rigging. Replacing a rig clears its previous pose and bone tracks. World and local bone matrices can be computed with the pure `getBoneTransform()` / `computeBoneMatrices()` helpers.

## Keyframes and presets

Use the existing clip clock, not another animation loop:

```js
bot.setPartAnimation({ duration: 1, loop: true, tracks: [{
  target: { bone: 'upper' }, channel: 'rotation', interpolation: 'smooth',
  keyframes: [
    { time: 0, value: [0, 0, 0] },
    { time: 0.5, value: [0, 0, 0.2] },
    { time: 1, value: [0, 0, 0] },
  ],
}] });
bot.pausePartAnimation();
bot.seekPartAnimation(0.5);
bot.playPartAnimation();
```

Bone tracks use only `position` or `rotation`, not `scale` or `opacity`. Omit `accessory` from the target for the body skeleton, or include an accessory instance ID to address that instance's skeleton. Position components are within −16..16; rotation components are within −2π..2π XYZ Euler radians, interpolated component-wise rather than by shortest-path quaternion rotation. Each target/channel pair must be unique. Clip values override only their named pose channels. Reduced motion stops automatic clip progression, while explicit poses and seeking remain available.

`createPartAnimationPreset('nod' | 'shake' | 'wiggle' | 'blink', options)` returns an ordinary validated clip with neutral endpoints and does not require a rig. Nod, shake, and wiggle use body rotation; blink uses both eye-weight tracks. The helper does not start playback:

```js
import { createPartAnimationPreset } from '@hanana-kick/sidekick/core';
bot.setPartAnimation(createPartAnimationPreset('nod', { intensity: 0.6 }));
```

All options are optional: `duration` is 0.05..60 seconds, `intensity` is 0..1 (default 1), and `loop` is a boolean (default false). Default durations are 0.8 seconds for nod, 0.7 for shake, 0.9 for wiggle, and 0.24 for blink. Invalid options are rejected rather than clamped. Presets use the same playback, pause, seek, and reduced-motion behavior as other clips.

The pure `samplePartAnimation()` result includes `bones` for body-bone channels and `accessoryBones[accessoryId]` for accessory-bone channels, alongside the existing part and accessory samples. Bone IDs are 1..128 characters, start with an ASCII letter or digit, and otherwise allow ASCII letters, digits, `.`, `_`, `/`, `:`, and `-`; prototype/reserved names are rejected.

## Plugin meshes

`defineAccessoryGeometry()` accepts optional `skin: { skeleton, joints, weights }`. `joints` is a Uint8Array with four bone indices per vertex; `weights` is a Float32Array with four nonnegative weights per vertex summing to one. The mesh vertices describe the bind pose in attachment-local coordinates. Skeleton indices follow the authored bones array. Bone positions are relative to their parent.

```js
bot.setBonePose({ tip: { rotation: [0, 0, 0.3] } }, { accessory: 'my-accessory' });
// Or use the existing clip:
// target: { accessory: 'my-accessory', bone: 'tip' }
```

The plugin registry validates and defensively copies the skin data before worker transport. Lazy and eager loading retain their existing behavior. Replacing an accessory with a different skeleton or removing it clears its old pose and bone tracks. Slot mounting is supported; fitted attachment recipes, paired-affine deformation, and procedural surface connectors cannot be combined with skinning in this version.

## Limits and rendering

Skeletons have at most 32 bones; each vertex has at most four influences. Bone scales, shear, external rig formats, and inverse-kinematics solvers are not part of this API. CPU skinning feeds the same geometry to WebGL and Canvas2D, including worker rendering. No separate requestAnimationFrame loop is installed. Stable geometry and pose reuse cached deformation; dynamic skins have CPU and buffer-update costs proportional to vertex count. This is a capability, not a claim of reduced CPU/GPU usage.

Direct AvatarRenderer consumers must treat RenderState.rig as an immutable snapshot and replace the object to change a rig. The element API already owns copies. Combined equipped skinned meshes are limited to 16,384 vertices and 32,768 triangles, in addition to individual mesh and six-slot limits.
