/** Kept separate so prebuilt ESM/IIFE distributions can supply their sibling URL. */
export function createRenderWorker() {
    return new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module', name: 'sidekick-render' });
}
