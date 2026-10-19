const types = ['wait', 'follow', 'guide', 'review', 'idle', 'celebrate', 'error'];
const targetTypes = ['wait', 'follow', 'guide', 'review'];
function plain(input, allowed) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)))
        throw new TypeError('behavior must be a plain object');
    for (const key of Reflect.ownKeys(input)) {
        const field = Object.getOwnPropertyDescriptor(input, key);
        if (typeof key !== 'string' || !allowed.includes(key) || !field.enumerable || !Object.hasOwn(field, 'value'))
            throw new TypeError(`Unsupported behavior field: ${String(key)}`);
    }
    return input;
}
/** Copies ordinary data only. Validation never evaluates callbacks or changes the running behavior. */
export function validateBehavior(input, document) {
    const record = plain(input, ['type', 'target', 'targets', 'side', 'gap', 'timeout', 'duration', 'dwell']);
    const type = record.type;
    if (typeof type !== 'string' || !types.includes(type))
        throw new TypeError('Unknown behavior type');
    const keys = ['type', ...(targetTypes.includes(type) ? ['side', 'gap', 'timeout'] : []), ...(type === 'review' ? ['targets', 'dwell'] : ['duration']), ...(['wait', 'follow', 'guide'].includes(type) ? ['target'] : [])];
    plain(record, keys);
    const copy = { ...record };
    for (const key of ['gap', 'timeout', 'duration', 'dwell'])
        if (key in copy && (typeof copy[key] !== 'number' || !Number.isFinite(copy[key]) || copy[key] < 0 || copy[key] > (key === 'gap' ? 10000 : 86400000)))
            throw new RangeError(`${key} must be a finite nonnegative number`);
    if ('side' in copy && !['left', 'right', 'above', 'below'].includes(copy.side))
        throw new TypeError('side must be left, right, above, or below');
    const target = (value) => {
        if (typeof value === 'string') {
            if (!value.trim())
                throw new TypeError('Empty target selector');
            document.querySelector(value);
        }
        else if (!document.defaultView || !(value instanceof document.defaultView.Element) || value.ownerDocument !== document)
            throw new TypeError('Target must be a selector or Element in the same document');
    };
    if (type === 'review') {
        if (typeof copy.targets === 'string')
            target(copy.targets);
        else if (Array.isArray(copy.targets)) {
            if (copy.targets.length > 10000)
                throw new RangeError('Review supports at most 10000 items');
            if (Object.getPrototypeOf(copy.targets) !== Array.prototype)
                throw new TypeError('Review arrays must be ordinary arrays');
            const items = [];
            for (const key of Reflect.ownKeys(copy.targets)) {
                if (key === 'length')
                    continue;
                const field = Object.getOwnPropertyDescriptor(copy.targets, key);
                if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || !field.enumerable || !Object.hasOwn(field, 'value'))
                    throw new TypeError('Review arrays require ordinary indexed data');
            }
            for (let index = 0; index < copy.targets.length; index++) {
                const item = Object.getOwnPropertyDescriptor(copy.targets, String(index))?.value;
                if (typeof item === 'string')
                    throw new TypeError('Review arrays require Elements');
                target(item);
                items.push(item);
            }
            copy.targets = Object.freeze(items);
        }
        else
            throw new TypeError('review.targets must be a selector or Element array');
    }
    else if (['wait', 'follow', 'guide'].includes(type))
        target(copy.target);
    return Object.freeze(copy);
}
export class BehaviorController {
    host;
    revision = 0;
    active;
    last = { id: 0, type: null, status: 'idle', itemIndex: -1, itemCount: 0, completedItems: 0 };
    constructor(host) {
        this.host = host;
    }
    get state() { return { ...this.last }; }
    get declaration() { const value = this.active?.declaration; return value ? { ...value, ...(value.type === 'review' && Array.isArray(value.targets) ? { targets: [...value.targets] } : {}) } : null; }
    perform(input, options = {}) {
        const declaration = validateBehavior(input, this.host.document);
        plain(options, ['signal']);
        if (options.signal !== undefined && (!this.host.document.defaultView || !(options.signal instanceof this.host.document.defaultView.AbortSignal)))
            throw new TypeError('signal must be an AbortSignal');
        const id = ++this.revision;
        this.cancel('replaced', false);
        let resolve;
        const promise = new Promise(done => { resolve = done; });
        const run = { id, declaration, state: { id, type: declaration.type, status: 'resolving', itemIndex: -1, itemCount: 0, completedItems: 0 }, restore: () => { }, cleanups: new Set(), resolve, settled: false };
        if (id !== this.revision) {
            this.finish(run, 'cancelled', 'replaced');
            return promise;
        }
        this.active = run;
        run.restore = this.host.capture();
        if (!this.owns(run))
            return promise;
        if (options.signal?.aborted) {
            this.finish(run, 'cancelled', 'aborted');
            return promise;
        }
        if (options.signal) {
            const abort = () => this.finish(run, 'cancelled', 'aborted');
            options.signal.addEventListener('abort', abort, { once: true });
            run.cleanups.add(() => options.signal.removeEventListener('abort', abort));
        }
        if (!this.host.connected()) {
            this.finish(run, 'error', 'Avatar is disconnected');
            return promise;
        }
        this.publish(run, 'resolving');
        void this.execute(run).catch(error => this.finish(run, 'error', error instanceof Error ? error.message : String(error)));
        return promise;
    }
    cancel(reason = 'stopped', increment = true) { if (increment)
        this.revision++; if (this.active)
        this.finish(this.active, 'cancelled', reason); }
    owns(run) { return this.active === run && !run.settled; }
    publish(run, status, patch = {}) {
        if (!this.owns(run))
            return;
        run.state = { ...run.state, ...patch, status };
        this.last = run.state;
        this.host.change(this.state);
    }
    finish(run, status, reason) {
        if (run.settled)
            return;
        run.settled = true;
        const owned = this.active === run;
        if (owned)
            this.active = undefined;
        for (const cleanup of run.cleanups)
            cleanup();
        run.cleanups.clear();
        const revision = this.revision;
        if (owned) {
            this.last = { ...run.state, status };
            run.restore();
            if (!this.active && this.revision === revision)
                this.host.stop();
        }
        const result = { id: run.id, type: run.declaration.type, status, ...(reason ? { reason } : {}), completedItems: run.state.completedItems };
        run.resolve(result);
        if (owned && !this.active && this.revision === revision)
            this.host.change(this.state);
        this.host.end({ ...result });
    }
    delay(run, milliseconds) {
        return new Promise(resolve => {
            let timer;
            const done = () => { if (timer !== undefined)
                clearTimeout(timer); run.cleanups.delete(done); resolve(); };
            run.cleanups.add(done);
            if (milliseconds !== undefined)
                timer = setTimeout(done, milliseconds);
            if (!this.owns(run))
                done();
        });
    }
    resolveTargets(run) {
        const spec = run.declaration;
        if (!('target' in spec) && spec.type !== 'review')
            return Promise.resolve([]);
        const source = spec.type === 'review' ? spec.targets : spec.target;
        if (Array.isArray(source))
            return Promise.resolve(source.filter(item => item.isConnected && item.ownerDocument === this.host.document));
        const select = () => typeof source === 'string' ? Array.from(this.host.document.querySelectorAll(source)).slice(0, spec.type === 'review' ? 10000 : 1) : Array.isArray(source) ? [...source] : [source];
        return new Promise((resolve, reject) => {
            let timer;
            const observer = new this.host.document.defaultView.MutationObserver(check);
            const cleanup = () => { observer.disconnect(); if (timer !== undefined)
                clearTimeout(timer); run.cleanups.delete(cancel); };
            const cancel = () => { cleanup(); resolve([]); };
            function check() { const items = select().filter(item => item.isConnected && item.ownerDocument === itemDocument); if (items.length) {
                cleanup();
                resolve(items);
            } }
            const itemDocument = this.host.document;
            run.cleanups.add(cancel);
            observer.observe(itemDocument, { childList: true, subtree: true, attributes: true });
            timer = setTimeout(() => { cleanup(); reject(new Error('Behavior target was not found before timeout')); }, spec.timeout ?? 5000);
            check();
        });
    }
    async execute(run) {
        if (!this.owns(run))
            return;
        const spec = run.declaration;
        const activity = spec.type === 'celebrate' ? 'celebrating' : spec.type === 'wait' || spec.type === 'review' ? 'thinking' : spec.type === 'guide' ? 'speaking' : spec.type === 'error' || spec.type === 'follow' ? 'listening' : 'idle';
        this.host.prepare(activity, spec.type === 'celebrate' ? 'smile' : spec.type === 'error' ? 'blink' : 'neutral', () => this.owns(run));
        if (!this.owns(run))
            return;
        if (!('target' in spec) && spec.type !== 'review') {
            this.publish(run, 'acting');
            await this.delay(run, spec.duration ?? (spec.type === 'celebrate' ? 1600 : spec.type === 'error' ? 1800 : undefined));
            if (this.owns(run))
                this.finish(run, 'completed');
            return;
        }
        const items = await this.resolveTargets(run);
        if (!this.owns(run))
            return;
        for (let index = 0; index < items.length; index++) {
            const target = items[index];
            if (!target.isConnected || target.ownerDocument !== this.host.document)
                continue;
            this.publish(run, 'moving', { itemIndex: index, itemCount: items.length });
            if (!this.owns(run))
                return;
            let lost = false;
            const unwatch = this.host.watch(target, () => { lost = true; if (spec.type !== 'review')
                this.finish(run, 'error', 'Behavior target was removed'); });
            if (!this.owns(run)) {
                unwatch();
                return;
            }
            if (lost) {
                unwatch();
                continue;
            }
            run.cleanups.add(unwatch);
            const movement = await this.host.move(target, spec.side ?? 'right', spec.gap ?? 16);
            if (!this.owns(run))
                return;
            if (!movement.finished && !lost) {
                this.finish(run, 'cancelled', 'Movement was interrupted');
                return;
            }
            if (!lost && target.isConnected) {
                this.publish(run, 'acting');
                await this.delay(run, spec.type === 'review' ? spec.dwell ?? 1000 : spec.duration);
                if (!this.owns(run))
                    return;
                if (!lost && target.isConnected)
                    run.state = { ...run.state, completedItems: run.state.completedItems + 1 };
            }
            unwatch();
            run.cleanups.delete(unwatch);
        }
        if (this.owns(run))
            this.finish(run, 'completed');
    }
}
