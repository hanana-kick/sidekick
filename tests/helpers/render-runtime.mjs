// Exercise the production runtime behind the element's normal command/request
// boundary. Only graphics and the frame source are fakes; clocks and reducers are real.
export function installRuntime(avatar, RenderEngine) {
  const callbacks = new Map(), draws = [], events = [];
  let nextFrame = 0, disposed = false;
  const generation = ++avatar.generation;
  avatar.acknowledgedRevision = 0; avatar.poseRevision = 0; avatar.timeRevision = 0;
  avatar.snapshotState = undefined;
  const canvas = avatar.canvas ?? new EventTarget();
  canvas.width = 200; canvas.height = 200;
  canvas.hasPointerCapture ??= () => false;
  avatar.canvas = canvas; avatar.fallback ??= { hidden: true, textContent: '' };
  const scheduler = { request(callback) { callbacks.set(++nextFrame, callback); return nextFrame; }, cancel(id) { callbacks.delete(id); } };
  const renderer = {
    canvas, stats: { drawCalls: 1, buffers: 3 }, disposals: 0,
    resize(width, height, dpr) { canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr)); },
    render(design, state) { draws.push({ design: structuredClone(design), ...state, pose: structuredClone(state.pose) }); },
    readPixels() { return new Uint8Array(canvas.width * canvas.height * 4); },
    dispose() { this.disposals++; },
  };
  const bridge = {
    backend: 'main', generation, revision: 0, transferred: false,
    start() {},
    send(command) { if (!disposed) engine.command(command, ++this.revision); },
    dispose() { if (!disposed) { disposed = true; engine.dispose(); } },
  };
  const engine = new RenderEngine(canvas, avatar.runtimeState(), (event, revision = bridge.revision) => {
    if (disposed) return;
    events.push({ ...event, revision });
    if ('snapshot' in event) avatar.acceptSnapshot(event.snapshot, revision);
    if (event.kind === 'complete') avatar.resolveRequest(event.request, event.result);
    else if (event.kind === 'pixels') avatar.resolveRequest(event.request, event.image);
    else if (event.kind === 'error') avatar.runtimeFailure(new Error(event.message), generation, false);
  }, scheduler, renderer);
  avatar.bridge = bridge; avatar.readyState = true;
  avatar.acceptSnapshot(engine.snapshot, bridge.revision);
  avatar.updateMouseTracking();
  const publish = () => avatar.acceptSnapshot(engine.snapshot, bridge.revision);
  return {
    engine, bridge, renderer, callbacks, draws, events,
    shape: engine.shape, timeline: engine.timeline, tracking: engine.tracking,
    advanceMotion(ms) { engine.timeline.advance(ms); publish(); },
    advanceShape(ms) { engine.shape.advance(ms); publish(); },
    finishShape() { engine.shape.finish(); publish(); },
    advanceTracking(seconds) { engine.tracking.advance(seconds); publish(); },
    render() { engine.capture(); publish(); return draws.at(-1); },
    frame(now) { const pending = [...callbacks.values()]; callbacks.clear(); for (const callback of pending) callback(now); },
  };
}

export function bareAvatarFixture(Avatar, RenderEngine, connected = false) {
  const avatar = new Avatar(), attributes = new Map(), events = [];
  const document = new EventTarget(); document.hidden = false; document.defaultView = new EventTarget(); document.defaultView.devicePixelRatio = 1;
  avatar.isConnected = false; avatar.ownerDocument = document; avatar.currentActivity = 'still';
  avatar.hasAttribute = name => attributes.has(name);
  avatar.getAttribute = name => attributes.get(name) ?? null;
  avatar.setAttribute = (name, value) => {
    const old = attributes.get(name) ?? null; attributes.set(name, String(value));
    if (Avatar.observedAttributes.includes(name)) avatar.attributeChangedCallback(name, old, String(value));
  };
  avatar.removeAttribute = name => { const old = attributes.get(name) ?? null; attributes.delete(name); if (Avatar.observedAttributes.includes(name)) avatar.attributeChangedCallback(name, old, null); };
  avatar.toggleAttribute = (name, enabled) => enabled ? avatar.setAttribute(name, '') : avatar.removeAttribute(name);
  avatar.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 });
  avatar.dispatchEvent = event => { events.push(event); return true; };
  avatar.removeEventListener = () => {};
  // Pointer-input coalescing has separate worker element tests. These fixtures
  // flush pending input explicitly, without adding a second fake animation clock.
  avatar.queueInput = () => {};
  const result = { avatar, attributes, events, document, runtime: undefined,
    connect() { avatar.isConnected = true; avatar.connected = true; result.runtime = installRuntime(avatar, RenderEngine); return result.runtime; },
    move(x, y, pointerType = 'mouse') { const event = new Event('pointermove'); Object.assign(event, { clientX: x, clientY: y, pointerType }); document.dispatchEvent(event); avatar.flushInput(); },
  };
  if (connected) result.connect();
  return result;
}
