import { definePartAnimation } from '@hanana-kick/sidekick-plugin-sdk';

// This independent clip targets equipped instance IDs, not catalog presets.
// Body/face/eyes retain their normal behavior. Only the two plugins move.
export const catalogAccessoryAnimation = definePartAnimation({
  duration: 2, loop: true,
  tracks: [
    { target: { accessory: 'plugin-moustache' }, channel: 'position', interpolation: 'smooth',
      keyframes: [{ time: 0, value: [0, 0, 0] }, { time: 1, value: [.012, .012, .008] }, { time: 2, value: [0, 0, 0] }] },
    { target: { accessory: 'plugin-bow-tie' }, channel: 'scale', interpolation: 'smooth',
      keyframes: [{ time: 0, value: [1, 1, 1] }, { time: 1, value: [1.08, .96, 1] }, { time: 2, value: [1, 1, 1] }] },
    { target: { accessory: 'plugin-moustache' }, channel: 'rotation', interpolation: 'smooth',
      keyframes: [{ time: 0, value: [0, 0, -.10] }, { time: 1, value: [0, 0, .10] }, { time: 2, value: [0, 0, -.10] }] },
    { target: { accessory: 'plugin-bow-tie' }, channel: 'rotation', interpolation: 'smooth',
      keyframes: [{ time: 0, value: [0, 0, .14] }, { time: 1, value: [0, 0, -.14] }, { time: 2, value: [0, 0, .14] }] },
  ],
});
