import type { PartAnimationTrack } from '../../src/core/part-animation.js';
import { createPartAnimationPreset } from '../../src/core/animation-presets.js';

const accessoryBone = { accessory: 'hat', bone: 'tip' };
const bodyBone = { bone: 'upper' };
const position: PartAnimationTrack = { target: bodyBone, channel: 'position', keyframes: [{ time: 0, value: [0, 1, 0] }] };
const rotation: PartAnimationTrack = { target: accessoryBone, channel: 'rotation', keyframes: [{ time: 0, value: [0, 0, 1] }] };
const accessoryScale: PartAnimationTrack = { target: { accessory: 'hat' }, channel: 'scale', keyframes: [{ time: 0, value: [1, 1, 1] }] };
const accessoryOpacity: PartAnimationTrack = { target: { accessory: 'hat' }, channel: 'opacity', keyframes: [{ time: 0, value: .5 }] };
// @ts-expect-error Bone scale is unsupported even when the target is a variable with an accessory ID.
const noBoneScale: PartAnimationTrack = { target: accessoryBone, channel: 'scale', keyframes: [{ time: 0, value: [1, 1, 1] }] };
// @ts-expect-error Bone opacity must not fall through to the existing accessory transform variant.
const noBoneOpacity: PartAnimationTrack = { target: accessoryBone, channel: 'opacity', keyframes: [{ time: 0, value: .5 }] };
// @ts-expect-error Body-bone scale is unsupported too.
const noBodyScale: PartAnimationTrack = { target: bodyBone, channel: 'scale', keyframes: [{ time: 0, value: [1, 1, 1] }] };
// @ts-expect-error An explicitly authored accessory bone cannot have a scale channel.
const noLiteralBoneScale: PartAnimationTrack = { target: { accessory: 'hat', bone: 'tip' }, channel: 'scale', keyframes: [{ time: 0, value: [1, 1, 1] }] };
createPartAnimationPreset('nod', { duration: 1, intensity: .3, loop: true });
// @ts-expect-error Preset names are a fixed public union.
createPartAnimationPreset('unknown');
void [position, rotation, accessoryScale, accessoryOpacity, noBoneScale, noBoneOpacity, noBodyScale, noLiteralBoneScale];
