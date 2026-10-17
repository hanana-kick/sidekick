import { createDesign, createAccessory, createEyeState, equipAccessory, removeAccessory, SidekickAvatar } from '@hanana-kick/sidekick';
import type { AccessoryPreset, AccessorySlot } from '@hanana-kick/sidekick';
import { createDesign as createCoreDesign } from '@hanana-kick/sidekick/core';
const design = createDesign({ body: { shape: 'heart', color: '#abcdef' }, eyes: { color: '#24242c', left: { weights: { smile: .3, blink: .4 } } }, accessories: [createAccessory('beret')] });
createCoreDesign({ eyes: { right: { expression: 'smile' } } });
const avatar = new SidekickAvatar();
void avatar.setShape('circle'); void avatar.setEyeWeights('left', { smile: .7 }); void avatar.setExpression('right', 'blink'); avatar.setCamera({ yaw: 20 });
void avatar.motion.to({ accessories: { beret: { rotation: [0, 0, .2] } } });
const leftEarring = createAccessory('earring', { slot: 'leftEar', id: 'left-earring' });
const rightEarring = createAccessory('earring', { slot: 'rightEar' });
createDesign({ accessories: [leftEarring, rightEarring, createAccessory('moustache'), createAccessory('bowTie')] });
createAccessory('scarf', 'winter-scarf');
const genericAccessory = (preset: AccessoryPreset, slot: AccessorySlot) => createAccessory(preset, { slot });
genericAccessory('glasses', 'eyes');
const equipped = equipAccessory(design, leftEarring);
removeAccessory(equipped, leftEarring.id);
void avatar.equipAccessory(rightEarring); void avatar.removeAccessory(rightEarring.id);
const currentVersion: 7 = design.version;
void currentVersion;
// @ts-expect-error An earring requires an explicit side.
createAccessory('earring');
// @ts-expect-error An ID alone cannot choose an earring side.
createAccessory('earring', 'earring-id');
// @ts-expect-error A single earring cannot occupy both sides.
createAccessory('earring', { slot: 'both' });
// @ts-expect-error An earring cannot be placed in a fixed accessory slot.
createAccessory('earring', { slot: 'head' });
// @ts-expect-error Canonical public slots no longer include the legacy face slot.
const removedSlot: AccessorySlot = 'face';
// @ts-expect-error Public design has no shape profiles.
createDesign({ body: { profiles: {} } });
// @ts-expect-error The ./core entry has the same strict boundary.
createCoreDesign({ eyes: { width: .2 } });
// @ts-expect-error Eye target geometry is internal.
createEyeState({ targets: { smile: { radius: .75 } } });
// @ts-expect-error Canonical design stores no eye geometry.
design.eyes.anchor;
// @ts-expect-error Accessories have no persisted transform.
design.accessories[0]!.rotation;
// @ts-expect-error Accessories have no persisted anchor.
design.accessories[0]!.anchor;
// @ts-expect-error Accessories have no persisted scale.
design.accessories[0]!.scale;
// @ts-expect-error Public module exports no profile calibration API.
import { resolveShapeProfile } from '@hanana-kick/sidekick';
// @ts-expect-error Public module exports no mutable render descriptors.
import type { ResolvedAvatarDesign, EyeShapeTargets, Anchor } from '@hanana-kick/sidekick';
// @ts-expect-error Low-level renderer state is internal.
import { AvatarRenderer, ShapeTimeline } from '@hanana-kick/sidekick';
// @ts-expect-error Internal implementation subpaths are not exported.
import { resolveDesign } from '@hanana-kick/sidekick/dist/src/core/resolved-design.js';
// @ts-expect-error ./core exports no anchor types.
import type { Anchor as CoreAnchor } from '@hanana-kick/sidekick/core';

// Tracking is behavior; no additional appearance geometry is exposed.
import type { TrackingMode, SidekickAttributes } from '@hanana-kick/sidekick';
import type { TrackingMode as CoreTrackingMode } from '@hanana-kick/sidekick/core';
const mode: TrackingMode = 'eyes-and-body';
const coreMode: CoreTrackingMode = mode;
avatar.trackingMode = coreMode;
avatar.mouseTracking = true;
const attrs: SidekickAttributes = { 'tracking-mode': mode, 'mouse-tracking': false };
void attrs;
// @ts-expect-error No independent body-only tracking axis exists.
avatar.trackingMode = 'body';
// @ts-expect-error Named tracking modes are not booleans.
avatar.trackingMode = true;

// Worker readback is explicitly asynchronous and keeps the public pixel contract.
const freshPixels: Promise<import("@hanana-kick/sidekick").PixelBuffer> = avatar.capturePixelsAsync();
const presentedPixels: import("@hanana-kick/sidekick").PixelBuffer = avatar.capturePixels();
const backend: "worker" | "main" | "none" = avatar.diagnostics.backend;
void freshPixels; void presentedPixels; void backend;
