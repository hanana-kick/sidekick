import { apiError } from './api-locales.js';

/** One serializable action describes both the invocation and the displayed example. */
const literal = value => {
  if (typeof value === 'string') return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll("\n", "\\n").replaceAll("\r", "\\r")}'`;
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  if (value && typeof value === 'object') return `{ ${Object.entries(value).map(([key, entry]) => `${key}: ${literal(entry)}`).join(', ')} }`;
  return JSON.stringify(value);
};
function argumentSource(action, value, index) {
  if (action.method === 'moveToElement' && index === 0) return `document.querySelector(${literal(value)})`;
  if (action.method === 'transitionTo' && index === 0 && value.accessories) {
    return `{ ${Object.entries(value).map(([key, entry]) => `${key}: ${key === 'accessories' ? `[${entry.map(preset => `createAccessory(${literal(preset)})`).join(', ')}]` : literal(entry)}`).join(', ')} }`;
  }
  return literal(value);
}
export function actionSource(action, target = 'avatar') {
  if (action.steps) return action.steps.map(step => actionSource(step, target)).join('\n');
  if (action.property) return `${target}.${action.property} = ${literal(action.value)};`;
  const call = `${target}.${action.method}(${(action.args ?? []).map((value, index) => argumentSource(action, value, index)).join(', ')});`;
  return ['moveTo', 'moveToElement', 'moveBy', 'setExpression', 'transitionTo', 'enter', 'exit', 'reactTo'].includes(action.method) ? `await ${call}` : call;
}
export function executeAction(avatar, action, createAccessory) {
  if (action.steps && action.sequential) return (async()=>{let result;for(const step of action.steps)result=await executeAction(avatar,step,createAccessory);return result;})();
  if (action.steps) { let result; for (const step of action.steps) result = executeAction(avatar, step, createAccessory); return result; }
  if (action.property) { avatar[action.property] = action.value; return; }
  const args = structuredClone(action.args ?? []);
  if (action.method === 'moveToElement') {
    const selector = args[0];
    args[0] = avatar.ownerDocument.querySelector(selector);
    if (!args[0]) throw apiError('targetNotFound', { selector });
  }
  if (action.method === 'transitionTo' && args[0]?.accessories) args[0].accessories = args[0].accessories.map(preset => createAccessory(preset));
  return avatar[action.method](...args);
}
export function codeForAction(action, format = 'javascript', scene) {
  const source = actionSource(action);
  const accessories = source.includes('createAccessory(');
  if (format === 'react') return `import { useRef } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n${accessories ? "import { createAccessory } from '@hanana-kick/sidekick';\n" : ''}\n${scene ? `const scene = ${JSON.stringify(scene, null, 2)};\n` : ''}export default function Example() {\n  const ref = useRef(null);\n  async function run() {\n    const avatar = ref.current;\n    if (!avatar) return;\n${source.split('\n').map(line => `    ${line}`).join('\n')}\n  }\n  return <>\n    <SidekickAvatar ref={ref} placement="viewport"\n      ${scene ? `design={scene.design} activity={scene.activity} paused={scene.paused}\n      trackingMode={scene.trackingMode} bodyOrientation={scene.bodyOrientation} zoom={scene.zoom}\n      onReady={event => { const bot = event.currentTarget; bot.lookAt({ space: 'view', ...scene.gaze }); bot.seek(scene.time); void bot.motion.to(scene.motion, { duration: 0 }); }}` : 'shape="ghostish" bodyColor="#FFCC37"'}\n      style={{ width: 180, height: 180, pointerEvents: 'none' }} />\n    <button onClick={run}>Run</button>\n  </>;\n}`;
  return `${accessories ? "import { createAccessory } from 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.14.2/dist/browser/sidekick.js';\n" : ''}const avatar = document.querySelector('#bot');\n${source}`;
}
