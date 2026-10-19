import { ACCESSORY_SLOTS } from './design.js';
const same = (a, b) => a?.id === b?.id && a?.preset === b?.preset && a?.color === b?.color;
/** One visible mesh per slot. Replacement is made only at zero coverage. */
export class AccessoryTransition {
    slots = new Map();
    initialized = false;
    get active() { return [...this.slots.values()].some(s => !same(s.current, s.target) || s.opacity !== (s.target ? 1 : 0)); }
    /** Includes outgoing and requested mounts for conservative framing. */
    get envelope() { return [...this.slots.values()].flatMap(s => [s.current, s.target].filter((a) => !!a)); }
    sample(target, delta, instant = false) {
        const dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.25)) : 0;
        for (const slot of ACCESSORY_SLOTS) {
            const next = target.find(a => a.slot === slot);
            let s = this.slots.get(slot);
            if (!s) {
                s = { current: next, target: next, opacity: next ? 1 : 0 };
                this.slots.set(slot, s);
            }
            if (!this.initialized || instant) {
                s.current = next;
                s.target = next;
                s.opacity = next ? 1 : 0;
                continue;
            }
            if (!same(s.target, next)) {
                s.target = next;
                // Retargeting preserves the exact already-presented opacity. A vacant
                // slot can immediately stage its new mesh, but it remains invisible.
                if (!s.current) {
                    s.current = next;
                    s.opacity = 0;
                }
                continue;
            }
            // Resolution may refresh curated geometry without changing identity.
            s.target = next;
            let remaining = dt;
            if (!same(s.current, s.target)) {
                const untilSwap = s.opacity * 0.1;
                s.opacity = Math.max(0, s.opacity - remaining / 0.1);
                if (s.opacity < 1e-9)
                    s.opacity = 0;
                remaining = Math.max(0, remaining - untilSwap);
                if (s.opacity === 0)
                    s.current = s.target;
                else
                    continue;
            }
            if (s.current) {
                s.current = s.target;
                s.opacity = Math.min(1, s.opacity + remaining / 0.1);
                if (s.opacity > 1 - 1e-9)
                    s.opacity = 1;
            }
            else
                s.opacity = 0;
        }
        this.initialized = true;
        return [...this.slots.values()].flatMap(s => s.current ? [{ accessory: s.current, opacity: s.opacity }] : []);
    }
}
