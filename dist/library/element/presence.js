import { validateMoveOptions, validatePosition } from './movement.js';
const edges = ['left', 'right', 'top', 'bottom'];
function options(value, key) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw new TypeError('presence options must be a plain object');
    const motion = {};
    let edge = key === 'from' ? 'left' : 'right';
    for (const name of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        if (typeof name !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError('presence options require ordinary data properties');
        if (name === key)
            edge = descriptor.value ?? edge;
        else
            motion[name] = descriptor.value;
    }
    if (!edges.includes(edge))
        throw new TypeError(`${key} must be left, right, top or bottom`);
    validateMoveOptions(motion);
    return { edge: edge, motion };
}
/** Coordinates are layout-viewport CSS pixels, just like viewport moveTo. */
export function outsidePosition(edge, point, box) {
    const margin = 8;
    switch (edge) {
        case 'left': return { x: -box.width - box.offsetX - margin, y: point.y };
        case 'right': return { x: box.viewportWidth - box.offsetX + margin, y: point.y };
        case 'top': return { x: point.x, y: -box.height - box.offsetY - margin };
        case 'bottom': return { x: point.x, y: box.viewportHeight - box.offsetY + margin };
    }
}
/** Owns presence, not appearance/activity settings. Physical integration stays in AvatarMovement. */
export class AvatarPresence {
    host;
    revision = 0;
    recovery = false;
    state = 'visible';
    operation;
    get current() { return this.state; }
    get bypassBounds() { return !!this.operation || this.recovery || this.state === 'hidden'; }
    constructor(host) {
        this.host = host;
    }
    enter(point, input = {}) {
        const target = validatePosition(point), parsed = options(input, 'from');
        this.host.assertViewport();
        const revision = ++this.revision;
        const interrupted = !!this.operation;
        this.cancel();
        if (revision !== this.revision)
            return Promise.resolve({ finished: false, position: this.host.position(), presence: this.state });
        const destination = this.host.constrain(target);
        return new Promise(resolve => {
            const operation = { kind: 'enter', edge: parsed.edge, point: destination, options: parsed.motion, segment: 0, resolve };
            this.operation = operation;
            this.state = 'entering';
            // A fresh appearance starts outside. Retargeting an active presence flight keeps its inertia.
            if (!interrupted) {
                this.host.visibility(true);
                this.host.stage(outsidePosition(parsed.edge, destination, this.host.geometry()));
                if (this.operation !== operation)
                    return;
            }
            this.host.visibility(false);
            if (this.operation === operation)
                this.run(operation);
        });
    }
    exit(input = {}) {
        const parsed = options(input, 'to');
        this.host.assertViewport();
        if (this.state === 'hidden') {
            const result = { finished: true, position: this.host.position(), presence: 'hidden' };
            this.host.complete('exit', result);
            return Promise.resolve(result);
        }
        const revision = ++this.revision;
        this.cancel();
        if (revision !== this.revision)
            return Promise.resolve({ finished: false, position: this.host.position(), presence: this.state });
        return new Promise(resolve => {
            const operation = { kind: 'exit', edge: parsed.edge, point: this.host.position(), options: parsed.motion, segment: 0, resolve };
            this.operation = operation;
            this.state = 'exiting';
            this.run(operation);
        });
    }
    /** Superseding normal moves reveal the bot without restarting its activity or resetting momentum. */
    reveal() { const revision = ++this.revision; this.cancel(); if (revision === this.revision) {
        this.recovery = this.recovery || this.state === 'hidden';
        this.state = 'visible';
        this.host.visibility(false);
    } return revision; }
    owns(revision) { return revision === this.revision; }
    recovered(revision) { if (this.owns(revision))
        this.recovery = false; }
    interrupt() { const revision = ++this.revision; this.cancel(); return revision; }
    cancel() {
        const operation = this.operation;
        if (!operation)
            return;
        this.operation = undefined;
        this.recovery = true;
        this.state = 'visible';
        this.host.visibility(false);
        this.finish(operation, false);
    }
    resize() {
        const operation = this.operation;
        if (!operation)
            return;
        if (operation.kind === 'enter')
            operation.point = this.host.constrain(operation.point);
        this.run(operation);
    }
    run(operation) {
        const segment = ++operation.segment;
        const target = operation.kind === 'exit' ? outsidePosition(operation.edge, this.host.position(), this.host.geometry()) : operation.point;
        void this.host.move(target, operation.options).then(result => {
            if (this.operation !== operation || segment !== operation.segment)
                return;
            this.operation = undefined;
            this.recovery = !result.finished;
            this.state = result.finished && operation.kind === 'exit' ? 'hidden' : 'visible';
            this.host.visibility(this.state === 'hidden');
            this.finish(operation, result.finished);
        });
    }
    finish(operation, finished) {
        const result = { finished, position: this.host.position(), presence: this.state };
        operation.resolve(result);
        this.host.complete(operation.kind, result);
    }
}
