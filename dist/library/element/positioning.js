import { validatePosition } from './movement.js';
import { assertAnchorHierarchy, resolveElementTarget } from './element-target.js';
export const POSITION_PLACEMENTS = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
function ordinary(value, keys, label) {
    if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw new TypeError(`${label} must be a plain object`);
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !keys.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError(`${label} contains an unsupported property`);
    }
}
export function validatePositioning(value, document) {
    ordinary(value, ['target', 'placement', 'gap', 'offset', 'follow'], 'positioning');
    const target = value.target;
    if (typeof target === 'string') {
        if (!target.trim())
            throw new TypeError('positioning target must be viewport, a selector, or an Element');
        if (target !== 'viewport')
            document.querySelector(target); // Validate syntax without requiring mounted targets yet.
    }
    else if (!document.defaultView || !(target instanceof document.defaultView.Element) || target.ownerDocument !== document)
        throw new TypeError('positioning target must belong to the same document');
    const placement = value.placement ?? 'bottom-right', gap = value.gap ?? 16, follow = value.follow ?? true;
    if (!POSITION_PLACEMENTS.includes(placement))
        throw new TypeError('invalid positioning placement');
    if (typeof gap !== 'number' || !Number.isFinite(gap) || gap < 0)
        throw new TypeError('positioning gap must be a non-negative finite number');
    if (typeof follow !== 'boolean')
        throw new TypeError('positioning follow must be boolean');
    const offset = value.offset ?? {};
    ordinary(offset, ['x', 'y'], 'positioning offset');
    const x = offset.x ?? 0, y = offset.y ?? 0;
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y))
        throw new TypeError('positioning offsets must be finite numbers');
    return { target, placement: placement, gap, offset: { x, y }, follow };
}
export function samePositioning(a, b) {
    return a === b || !!a && !!b && a.target === b.target && (a.placement ?? 'bottom-right') === (b.placement ?? 'bottom-right') && (a.gap ?? 16) === (b.gap ?? 16) && (a.follow ?? true) === (b.follow ?? true) && (a.offset?.x ?? 0) === (b.offset?.x ?? 0) && (a.offset?.y ?? 0) === (b.offset?.y ?? 0);
}
export function copyPositioning(value) { return value ? { ...value, ...(value.offset ? { offset: { ...value.offset } } : {}) } : null; }
/** Pure CSS-pixel geometry, shared by initial positioning, entrance and pursuit. */
export function positioningPoint(config, own, target, viewport) {
    const [vertical, horizontal] = config.placement === 'center' ? ['center', 'center'] : config.placement.split('-');
    const axis = (mode, start, extent, size) => mode === 'center' ? start + (extent - size) / 2 : mode === 'left' || mode === 'top' ? start + (viewport ? config.gap : -size - config.gap) : start + extent - (viewport ? size + config.gap : -config.gap);
    return { x: axis(horizontal, target.left, target.width, own.width) + config.offset.x, y: axis(vertical, target.top, target.height, own.height) + config.offset.y };
}
export function resolvePositioning(avatar, position, config) {
    const view = avatar.ownerDocument.defaultView;
    const target = config.target === 'viewport' ? null : typeof config.target === 'string' ? avatar.ownerDocument.querySelector(config.target) : config.target;
    if (config.target !== 'viewport' && (!target || !target.isConnected))
        throw new TypeError('positioning target is missing or disconnected');
    if (target) {
        assertAnchorHierarchy(avatar, target);
        resolveElementTarget(avatar, position, target);
    }
    // Reuse hierarchy validation for viewport positioning, without allocating a proxy DOM node.
    else
        resolveElementTarget(avatar, position, avatar.ownerDocument.documentElement);
    const own = avatar.getBoundingClientRect();
    const reference = target?.getBoundingClientRect() ?? { left: 0, top: 0, width: view.innerWidth, height: view.innerHeight };
    const point = positioningPoint(config, own, reference, !target);
    return { position: validatePosition({ x: position.x + point.x - own.left, y: position.y + point.y - own.top }), target };
}
