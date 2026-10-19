const edges = ['left', 'right', 'top', 'bottom'];
export function validateEntrance(value) {
    if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw new TypeError('entrance must be a plain object');
    const input = value;
    for (const key of Reflect.ownKeys(input)) {
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError('entrance requires ordinary data properties');
    }
    const allowed = input.source === 'viewport' ? ['source', 'edge', 'at', 'inset'] : ['source', 'target', 'direction', 'at', 'gap'];
    for (const key of Reflect.ownKeys(input)) {
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (typeof key !== 'string' || !allowed.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError('invalid entrance property');
    }
    if (input.source !== 'viewport' && input.source !== 'element')
        throw new TypeError('entrance source must be viewport or element');
    const at = input.at ?? .5;
    if (typeof at !== 'number' || !Number.isFinite(at) || at < 0 || at > 1)
        throw new RangeError('entrance at must be between 0 and 1');
    const edge = input.source === 'viewport' ? input.edge : input.direction;
    if (!edges.includes(edge))
        throw new TypeError('entrance edge/direction must be left, right, top or bottom');
    const distance = input.source === 'viewport' ? input.inset ?? 24 : input.gap ?? 16;
    if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0 || distance > 10000)
        throw new RangeError('entrance inset/gap must be between 0 and 10000 CSS pixels');
    if (input.source === 'viewport')
        return { source: 'viewport', edge: edge, at, inset: distance };
    if (!(typeof input.target === 'string' && input.target.trim()) && !(input.target && typeof input.target === 'object' && 'nodeType' in input.target && input.target.nodeType === 1))
        throw new TypeError('entrance target must be an Element or nonempty selector');
    return { source: 'element', target: input.target, direction: edge, at, gap: distance };
}
export function sameEntrance(a, b) {
    if (!a || !b)
        return a === b;
    return a.source === b.source && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);
}
export function entrancePositions(config, width, height, viewportWidth, viewportHeight, target) {
    if (![width, height, viewportWidth, viewportHeight].every(value => Number.isFinite(value) && value > 0))
        throw new RangeError('entrance requires positive layout dimensions');
    const at = config.at ?? .5;
    if (config.source === 'viewport') {
        const inset = config.inset ?? 24;
        const end = { x: at * Math.max(0, viewportWidth - width), y: at * Math.max(0, viewportHeight - height) };
        if (config.edge === 'left')
            end.x = inset;
        if (config.edge === 'right')
            end.x = viewportWidth - width - inset;
        if (config.edge === 'top')
            end.y = inset;
        if (config.edge === 'bottom')
            end.y = viewportHeight - height - inset;
        if (end.x < 0 || end.y < 0 || end.x + width > viewportWidth || end.y + height > viewportHeight)
            throw new RangeError('entrance inset and avatar dimensions must fit inside the viewport');
        return { end };
    }
    if (!target || target.width < width || target.height < height)
        throw new RangeError('entrance target must cover the avatar canvas; enlarge the opaque target or explicitly reduce avatar CSS dimensions');
    const start = { x: target.left + (target.width - width) * at, y: target.top + (target.height - height) * at }, end = { ...start }, gap = config.gap ?? 16;
    if (config.direction === 'left') {
        start.x = target.left;
        end.x = target.left - width - gap;
    }
    if (config.direction === 'right') {
        start.x = target.left + target.width - width;
        end.x = target.left + target.width + gap;
    }
    if (config.direction === 'top') {
        start.y = target.top;
        end.y = target.top - height - gap;
    }
    if (config.direction === 'bottom') {
        start.y = target.top + target.height - height;
        end.y = target.top + target.height + gap;
    }
    if (end.x < 0 || end.y < 0 || end.x + width > viewportWidth || end.y + height > viewportHeight)
        throw new RangeError('entrance destination needs enough viewport space outside the selected target edge');
    return { start, end };
}
/** Even-odd cutout of the target viewport border rectangle in canvas-local CSS pixels. */
export function entranceClip(avatar, target) {
    const left = Math.max(0, target.left - avatar.left), top = Math.max(0, target.top - avatar.top);
    const right = Math.min(avatar.width, target.left + target.width - avatar.left), bottom = Math.min(avatar.height, target.top + target.height - avatar.top);
    if (left >= right || top >= bottom)
        return 'none';
    return `polygon(evenodd, 0px 0px, ${avatar.width}px 0px, ${avatar.width}px ${avatar.height}px, 0px ${avatar.height}px, 0px 0px, ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px ${top}px, 0px 0px)`;
}
