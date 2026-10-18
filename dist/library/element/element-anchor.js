/** One read-then-write loop per document. Visible pursuit samples each frame;
 * sleeping bindings check transforms at 4 Hz, with immediate scroll/resize wake.
 * Hidden documents do no geometry polling. */
class AnchorScheduler {
    document;
    bindings = new Set();
    frame = 0;
    timer = 0;
    forceRead = false;
    constructor(document) {
        this.document = document;
    }
    stop() {
        if (this.frame)
            this.document.defaultView.cancelAnimationFrame(this.frame);
        if (this.timer)
            this.document.defaultView.clearTimeout(this.timer);
        this.frame = this.timer = 0;
    }
    wake = () => { this.stop(); this.forceRead = true; this.schedule(true); };
    add(binding) {
        if (!this.bindings.size) {
            this.document.addEventListener('visibilitychange', this.wake);
            this.document.addEventListener('scroll', this.wake, true);
            this.document.defaultView.addEventListener('resize', this.wake);
        }
        this.bindings.add(binding);
        this.wake();
        return () => {
            this.bindings.delete(binding);
            if (!this.bindings.size) {
                this.stop();
                this.document.removeEventListener('visibilitychange', this.wake);
                this.document.removeEventListener('scroll', this.wake, true);
                this.document.defaultView.removeEventListener('resize', this.wake);
            }
        };
    }
    schedule(immediate = false) {
        if (this.frame || this.timer || !this.bindings.size || this.document.hidden)
            return;
        if (!immediate && [...this.bindings].every(binding => binding.idle())) {
            this.timer = this.document.defaultView.setTimeout(() => { this.timer = 0; this.schedule(true); }, 250);
        }
        else
            this.frame = this.document.defaultView.requestAnimationFrame(this.tick);
    }
    tick = () => {
        this.frame = 0;
        const writes = [];
        const now = this.document.defaultView.performance.now(), force = this.forceRead;
        this.forceRead = false;
        for (const binding of [...this.bindings]) {
            if (!force && binding.idle() && now < binding.nextRead)
                continue;
            binding.nextRead = now + 250;
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
export function observeElementAnchor(document, read, idle = () => false) {
    let scheduler = schedulers.get(document);
    if (!scheduler) {
        scheduler = new AnchorScheduler(document);
        schedulers.set(document, scheduler);
    }
    return scheduler.add({ read, idle, nextRead: 0 });
}
