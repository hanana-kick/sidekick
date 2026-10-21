// Only a bounded authored event ID crosses the frame boundary, never content or speech.
export function emitSourceEvent(id, win = window) {
 const params = new URL(win.location.href).searchParams;
 if (win.parent === win || !params.has('sourceGeneration')) return;
 win.parent.postMessage({ type: 'sidekick-example-source', id, site: params.get('site'), generation: params.get('sourceGeneration') }, win.location.origin);
}
