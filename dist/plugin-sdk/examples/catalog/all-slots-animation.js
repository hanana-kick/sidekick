import { definePartAnimation } from '@hanana-kick/sidekick-plugin-sdk';
// Each target is an equipped instance, not an internal preset selector.
export const allSlotsAnimation = definePartAnimation({ duration: 2, loop: true, tracks: [
  { target: { accessory: 'plugin-halo' }, channel: 'rotation', keyframes: [{time:0,value:[0,-.12,0]},{time:1,value:[0,.12,0]},{time:2,value:[0,-.12,0]}] },
  { target: { accessory: 'plugin-glasses' }, channel: 'position', keyframes: [{time:0,value:[0,0,0]},{time:1,value:[0,.014,.008]},{time:2,value:[0,0,0]}] },
  { target: { accessory: 'plugin-moustache' }, channel: 'rotation', keyframes: [{time:0,value:[0,0,-.1]},{time:1,value:[0,0,.1]},{time:2,value:[0,0,-.1]}] },
  { target: { accessory: 'plugin-bow-tie' }, channel: 'scale', keyframes: [{time:0,value:[1,1,1]},{time:1,value:[1.08,.96,1]},{time:2,value:[1,1,1]}] },
  { target: { accessory: 'plugin-earring-left' }, channel: 'rotation', keyframes: [{time:0,value:[.06,0,-.1]},{time:1,value:[-.06,0,.1]},{time:2,value:[.06,0,-.1]}] },
  { target: { accessory: 'plugin-earring-right' }, channel: 'rotation', keyframes: [{time:0,value:[-.06,0,.1]},{time:1,value:[.06,0,-.1]},{time:2,value:[-.06,0,.1]}] },
] });
