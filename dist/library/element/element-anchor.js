/** A single read-then-write frame loop per document, only while bindings exist.
 * Geometry polling is intentional: observers do not detect transform-only motion
 * (including Web Animations). Hidden documents suspend it entirely. */
class AnchorScheduler {
    document;
    bindings = new Set();
    frame = 0;
    constructor(document) {
        this.document = document;
    }
    visibility = () => {
        if (this.document.hidden && this.frame) {
            this.document.defaultView.cancelAnimationFrame(this.frame);
            this.frame = 0;
        }
        else
            this.schedule();
    };
    add(binding) {
        if (!this.bindings.size)
            this.document.addEventListener('visibilitychange', this.visibility);
        this.bindings.add(binding);
        this.schedule();
        return () => {
            this.bindings.delete(binding);
            if (!this.bindings.size) {
                if (this.frame)
                    this.document.defaultView.cancelAnimationFrame(this.frame);
                this.frame = 0;
                this.document.removeEventListener('visibilitychange', this.visibility);
            }
        };
    }
    schedule() {
        if (!this.frame && this.bindings.size && !this.document.hidden)
            this.frame = this.document.defaultView.requestAnimationFrame(this.tick);
    }
    tick = () => {
        this.frame = 0;
        const writes = [];
        for (const binding of [...this.bindings]) {
            const write = binding.read();
            if (write)
                writes.push(write);
        }
        for (const write of writes)
            write();
        this.schedule();
    };
}
const schedulers = new WeakMap();
export function observeElementAnchor(document, read) {
    let scheduler = schedulers.get(document);
    if (!scheduler) {
        scheduler = new AnchorScheduler(document);
        schedulers.set(document, scheduler);
    }
    return scheduler.add({ read });
}
