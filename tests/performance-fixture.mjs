/** Counting GL double: executes production CPU geometry, never simulates GPU time. */
export function countingCanvas(width = 280, height = 280) {
  let nextID = 0;
  const live = { buffers: new Set(), vaos: new Set(), programs: new Set(), shaders: new Set() };
  const totals = { bufferData: 0, bufferSubData: 0, uploadedBytes: 0, drawCalls: 0, peakBuffers: 0, peakVAOs: 0 };
  const bound = new Map(), sizes = new Map();
  const create = kind => { const object = { id: ++nextID }; live[kind].add(object); totals.peakBuffers = Math.max(totals.peakBuffers, live.buffers.size); totals.peakVAOs = Math.max(totals.peakVAOs, live.vaos.size); return object; };
  const remove = (kind, object) => { live[kind].delete(object); if (kind === 'buffers') sizes.delete(object); };
  const values = { ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963, DYNAMIC_DRAW: 35048, STATIC_DRAW: 35044, VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, COMPILE_STATUS: 35713, LINK_STATUS: 35714, FLOAT: 5126, TRIANGLES: 4, UNSIGNED_SHORT: 5123, DEPTH_TEST: 2929, CULL_FACE: 2884, BACK: 1029, COLOR_BUFFER_BIT: 16384, DEPTH_BUFFER_BIT: 256, RGBA: 6408, UNSIGNED_BYTE: 5121 };
  const gl = new Proxy({ ...values,
    createBuffer: () => create('buffers'), deleteBuffer: object => remove('buffers', object),
    createVertexArray: () => create('vaos'), deleteVertexArray: object => remove('vaos', object),
    createProgram: () => create('programs'), deleteProgram: object => remove('programs', object),
    createShader: () => create('shaders'), deleteShader: object => remove('shaders', object),
    getShaderParameter: () => true, getProgramParameter: () => true, getUniformLocation: (_, name) => ({ name }), isContextLost: () => false,
    bindBuffer: (target, buffer) => bound.set(target, buffer),
    bufferData: (target, data) => { const bytes = typeof data === 'number' ? data : data.byteLength; totals.bufferData++; totals.uploadedBytes += bytes; sizes.set(bound.get(target), bytes); },
    bufferSubData: (_, __, data) => { totals.bufferSubData++; totals.uploadedBytes += data.byteLength; },
    drawElements: () => totals.drawCalls++,
  }, { get: (object, key) => key in object ? object[key] : () => {} });
  const canvas = { width, height, getContext: kind => kind === 'webgl2' ? gl : null, addEventListener() {}, removeEventListener() {} };
  return { canvas, gl, totals, snapshot: () => ({ ...totals, liveBuffers: live.buffers.size, liveVAOs: live.vaos.size, livePrograms: live.programs.size, liveShaders: live.shaders.size, retainedGPUBytes: [...sizes.values()].reduce((a, b) => a + b, 0) }) };
}
export function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = q => sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)] ?? 0;
  return { count: sorted.length, medianMs: at(.5), p95Ms: at(.95), maxMs: sorted.at(-1) ?? 0, totalMs: sorted.reduce((a, b) => a + b, 0) };
}
export function numericDelta(after, before) {
  return Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value - (before[key] ?? 0)]));
}
