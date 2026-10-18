import { validateMoveOptions, validatePosition } from './movement.js';
const horizontal = { left: 0, center: .5, right: 1 };
const vertical = { top: 0, center: .5, bottom: 1 };
const composedParent = (element) => element.assignedSlot ?? element.parentElement ?? element.getRootNode().host ?? null;
/** Read layout once. No observers or persistent reference to the target are retained. */
export function resolveElementTarget(avatar, position, target, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new TypeError('moveToElement options must be an object');
    if (![Object.prototype, null].includes(Object.getPrototypeOf(options)))
        throw new TypeError('moveToElement options must be a plain object');
    for (const key of Reflect.ownKeys(options)) {
        const descriptor = Object.getOwnPropertyDescriptor(options, key);
        if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError('moveToElement options require ordinary data properties');
    }
    const { x = 0, y = 0, alignX = 'left', alignY = 'top', ...moveOptions } = options;
    validatePosition({ x, y });
    validateMoveOptions(moveOptions);
    if (typeof alignX !== 'string' || typeof alignY !== 'string' || !Object.hasOwn(horizontal, alignX) || !Object.hasOwn(vertical, alignY))
        throw new TypeError('alignX must be left, center or right; alignY must be top, center or bottom');
    const view = avatar.ownerDocument.defaultView;
    if (!view || !avatar.isConnected || !(target instanceof view.Element) || !target.isConnected || target.ownerDocument !== avatar.ownerDocument)
        throw new TypeError('moveToElement requires connected avatar and target Elements in the same document');
    const ownZoom = view.getComputedStyle(avatar).zoom;
    if (ownZoom && ownZoom !== '1' && ownZoom !== 'normal')
        throw new TypeError('moveToElement does not support CSS zoom on the avatar; use CSS transform: scale() instead');
    // Parent transforms change the units/direction of CSS translate. Own transforms do not:
    // translate precedes rotate/scale/transform, so the measured own border-box is valid.
    let parent = composedParent(avatar);
    while (parent) {
        const style = view.getComputedStyle(parent);
        if ([style.transform, style.scale, style.rotate, style.perspective].some(value => value && value !== 'none') || (style.zoom && style.zoom !== '1' && style.zoom !== 'normal'))
            throw new TypeError('moveToElement does not support transformed or zoomed avatar ancestors; place the avatar directly under an untransformed document body');
        parent = composedParent(parent);
    }
    const from = avatar.getBoundingClientRect(), to = target.getBoundingClientRect();
    for (const rect of [from, to])
        for (const value of [rect.left, rect.top, rect.width, rect.height])
            if (!Number.isFinite(value))
                throw new TypeError('moveToElement requires finite layout rectangles');
    return {
        position: validatePosition({
            x: position.x + to.left - from.left + (to.width - from.width) * horizontal[alignX] + x,
            y: position.y + to.top - from.top + (to.height - from.height) * vertical[alignY] + y,
        }),
        options: moveOptions,
    };
}
