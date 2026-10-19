import { ACCESSORY_SLOTS } from './design.js';
const same = (a, b) => a?.id === b?.id && a?.preset === b?.preset && a?.color === b?.color;
/** One visible mesh per slot. Replacement is made only at zero coverage. */
export class AccessoryTransition {
    slots = new Map();
    initialized = false;
    get active() { return [...this.slots.values()].some(s => !!s.ramp || !same(s.current, s.target) || s.opacity !== (s.target ? 1 : 0)); }
    /** Includes outgoing and requested mounts for conservative framing. */
    get envelope() { return [...this.slots.values()].flatMap(s => [s.current, s.target].filter((a) => !!a)); }
    aim(s, to) {
        if (s.ramp?.to === to)
            return;
        if (s.opacity === to && s.velocity === 0) {
            s.ramp = undefined;
            return;
        }
        let duration = .1;
        const distance = to - s.opacity, speed = Math.abs(s.velocity);
        if (speed > 0) {
            // A cubic Hermite curve is a cubic Bezier with control points
            // [from, from + velocity * duration / 3, to, to]. Keep its first
            // control point in [0,1] to bound the entire curve analytically.
            // Shortening duration preserves the incoming derivative on reversal.
            const room = s.velocity > 0 ? 1 - s.opacity : s.opacity;
            duration = Math.min(duration, 3 * room / speed);
            if (distance * s.velocity > 0)
                duration = Math.min(duration, 3 * Math.abs(distance) / speed);
        }
        s.ramp = { from: s.opacity, to, velocity: s.velocity, duration, elapsed: 0 };
    }
    sample(target, delta, instant = false) {
        const dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, .25)) : 0;
        for (const slot of ACCESSORY_SLOTS) {
            const next = target.find(a => a.slot === slot);
            let s = this.slots.get(slot);
            if (!s) {
                s = { current: next, target: next, opacity: next ? 1 : 0, velocity: 0 };
                this.slots.set(slot, s);
            }
            if (!this.initialized || instant) {
                s.current = next;
                s.target = next;
                s.opacity = next ? 1 : 0;
                s.velocity = 0;
                s.ramp = undefined;
                continue;
            }
            const changed = !same(s.target, next);
            // Resolution may refresh curated geometry without changing identity.
            s.target = next;
            if (!s.current && next)
                s.current = next;
            const goal = same(s.current, s.target) && s.current ? 1 : 0;
            this.aim(s, goal);
            if (!s.ramp && s.opacity === 0 && !same(s.current, s.target)) {
                s.current = s.target;
                if (s.current)
                    this.aim(s, 1);
            }
            // A command starts at the exact already-presented alpha and derivative.
            // Changing only the pending replacement does not restart the outgoing leg.
            if (changed)
                continue;
            let remaining = dt;
            while (s.ramp) {
                const ramp = s.ramp, step = Math.min(remaining, ramp.duration - ramp.elapsed);
                ramp.elapsed += step;
                remaining -= step;
                if (ramp.elapsed >= ramp.duration - 1e-12) {
                    s.opacity = ramp.to;
                    s.velocity = 0;
                    s.ramp = undefined;
                    if (s.opacity === 0 && !same(s.current, s.target)) {
                        s.current = s.target;
                        if (s.current)
                            this.aim(s, 1);
                    }
                    if (remaining > 0)
                        continue;
                }
                else {
                    const t = ramp.elapsed / ramp.duration, t2 = t * t, t3 = t2 * t;
                    const tangent = ramp.velocity * ramp.duration;
                    s.opacity = (2 * t3 - 3 * t2 + 1) * ramp.from + (t3 - 2 * t2 + t) * tangent + (-2 * t3 + 3 * t2) * ramp.to;
                    s.velocity = ((6 * t2 - 6 * t) * ramp.from + (3 * t2 - 4 * t + 1) * tangent + (-6 * t2 + 6 * t) * ramp.to) / ramp.duration;
                }
                break;
            }
            if (same(s.current, s.target))
                s.current = s.target;
        }
        this.initialized = true;
        return [...this.slots.values()].flatMap(s => s.current ? [{ accessory: s.current, opacity: s.opacity }] : []);
    }
}
