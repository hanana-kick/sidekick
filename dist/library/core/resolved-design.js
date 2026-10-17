const targets = () => ({ smile: { radius: 0.75, thickness: 0.22 }, blink: { thickness: 0.16 } });
/** New descriptors on every resolution; caller-owned designs never gain hidden geometry. */
export function resolveDesign(design) {
    return {
        version: 7,
        body: { ...design.body },
        eyes: {
            shape: 'capsule', width: 0.16, height: 0.34, anchor: { region: 'face', uv: [0, 0.1], offset: 0 }, spacing: 0.64, scale: 1, color: design.eyes.color,
            left: { weights: { ...design.eyes.left.weights }, targets: targets() },
            right: { weights: { ...design.eyes.right.weights }, targets: targets() },
        },
        accessories: design.accessories.map(accessory => {
            let anchor, follow;
            if ((accessory.preset === 'earring' || accessory.preset === 'starEarring')) {
                anchor = { region: accessory.slot === 'leftEar' ? 'left' : 'right', uv: [0, -0.15], offset: 0 };
                follow = 0.35;
            }
            else if ((accessory.preset === 'moustache' || accessory.preset === 'goatee')) {
                anchor = { region: 'face', uv: [0, -0.23], offset: 0 };
                follow = 0;
            }
            else if (accessory.preset === 'bowTie' || accessory.preset === 'scarf' || accessory.preset === 'necklace') {
                anchor = { region: 'face', uv: [0, -0.55], offset: 0 };
                follow = 0.15;
            }
            else {
                anchor = { region: (accessory.preset === 'glasses' || accessory.preset === 'sunglasses') ? 'face' : 'crown', uv: [0, (accessory.preset === 'glasses' || accessory.preset === 'sunglasses') ? 0.1 : 0], offset: accessory.preset === 'halo' ? 0.22 : (accessory.preset === 'glasses' || accessory.preset === 'sunglasses') ? 0 : 0.035 };
                follow = (accessory.preset === 'glasses' || accessory.preset === 'sunglasses') ? 0 : 0.5;
            }
            return { ...accessory, anchor, scale: 1, rotation: [0, 0, 0], follow };
        }),
    };
}
