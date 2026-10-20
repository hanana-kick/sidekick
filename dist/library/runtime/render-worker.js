import { RenderEngine } from './render-engine.js';
import { PROTOCOL_VERSION } from './protocol.js';
// DOM and WebWorker lib declarations overlap; this narrow private port is sufficient.
const scope = globalThis;
let engine, generation = 0, sequence = 0;
const send = (event, revision = sequence) => {
    const response = { ...event, version: PROTOCOL_VERSION, generation, sequence: revision };
    scope.postMessage(response, event.kind === 'pixels' ? [event.image.pixels.buffer] : []);
};
scope.onmessage = ({ data }) => {
    if (!data || data.version !== PROTOCOL_VERSION)
        return;
    try {
        if (data.kind === 'init') {
            if (engine || generation)
                throw new Error('Worker surface was already initialized');
            generation = data.generation;
            sequence = data.sequence;
            engine = new RenderEngine(data.canvas, data.state, send);
            scope.postMessage({ kind: 'ready', version: PROTOCOL_VERSION, generation, sequence, snapshot: engine.snapshot });
            return;
        }
        if (!engine || data.generation !== generation || data.sequence <= sequence)
            return;
        sequence = data.sequence;
        engine.command(data.command, sequence);
        if (data.command.kind === 'dispose') {
            engine = undefined;
            scope.close();
        }
    }
    catch (error) {
        send({ kind: 'error', message: error instanceof Error ? error.message : String(error), rendererFallback: error instanceof Error && error.name === 'RendererInitializationError' });
        engine?.dispose();
        engine = undefined;
    }
};
