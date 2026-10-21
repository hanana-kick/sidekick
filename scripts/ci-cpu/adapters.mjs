export function adaptBridge(source) {
 const needle='new RenderEngine(this.canvas, state, (event, revision = this.revision) => { if (!this.disposed) this.callbacks.event(event, revision); })';
 if(source.split(needle).length!==2)throw Error('Bridge injection anchor changed');
 return `import { FixtureRenderer, fixtureReady } from './fixture-renderer.js';\n`+source.replace(needle,needle.slice(0,-1)+", undefined, new FixtureRenderer(this.canvas, {renderer:'canvas2d'}))").replace('this.callbacks.ready(this.engine.snapshot, this.revision)','this.callbacks.ready(fixtureReady(this.engine.snapshot, this.engine.renderer), this.revision)');
}
export function adaptWorker(source) {
 const needle='new RenderEngine(data.canvas, data.state, send)';
 if(source.split(needle).length!==2)throw Error('Worker injection anchor changed');
 return `import { FixtureRenderer, fixtureReady } from './fixture-renderer.js';\n`+source.replace(needle,"new RenderEngine(data.canvas, data.state, send, undefined, new FixtureRenderer(data.canvas, {renderer:'canvas2d'}))").replace('snapshot: engine.snapshot','snapshot: fixtureReady(engine.snapshot, engine.renderer)');
}
export function rendererModule(variant) {
 if(!['baseline','candidate'].includes(variant))throw Error('Unknown variant');
 return `import { ${variant==='candidate'?'FullPresentationRenderer':'AvatarRenderer'} as FixtureRenderer } from '${variant==='candidate'?'../../experiments/full-canvas-crop/full-presentation-canvas.js':'../renderer/webgl.js'}';
export { FixtureRenderer };
export function fixtureReady(snapshot, renderer) { return {...snapshot, fixture: {variant: '${variant}', rendererClass: '${variant==='candidate'?'FullPresentationRenderer':'AvatarRenderer'}', graphics: renderer.graphics, storage: renderer.diagnostics ?? null}}; }
`;
}
