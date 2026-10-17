import { parseScene } from '../src/core/scene.js';
import type { SidekickScene } from '../src/core/scene.js';

/** Attribute-safe serialization, including strings placed inside a double-quoted HTML attribute. */
export const escapeHTMLAttribute = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const javascript = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');

export function sceneSnippets(input: SidekickScene): { html: string; react: string } {
  const scene = parseScene(input);
  const values: [string, string, unknown][] = [
    ['design', 'design', scene.design],
    ['camera-yaw', 'cameraYaw', scene.camera.yaw], ['camera-pitch', 'cameraPitch', scene.camera.pitch], ['camera-roll', 'cameraRoll', scene.camera.roll],
    ['mouse-tracking', 'mouseTracking', scene.mouseTracking], ['activity', 'activity', scene.activity], ['paused', 'paused', scene.paused], ['interaction', 'interaction', scene.interaction],
    ['gaze-x', 'gazeX', scene.gaze.x], ['gaze-y', 'gazeY', scene.gaze.y], ['time', 'time', scene.time],
    ['shape-duration', 'shapeDuration', scene.shapeDuration], ['shape-easing', 'shapeEasing', scene.shapeEasing],
    ['motion-duration', 'motionDuration', scene.motionDuration], ['motion-easing', 'motionEasing', scene.motionEasing], ['motion', 'motion', scene.motion],
  ];
  const htmlAttributes = values.map(([name, , value]) => `  ${name}="${escapeHTMLAttribute(typeof value === 'object' ? JSON.stringify(value) : String(value))}"`).join('\n');
  const jsxProps = values.map(([, name, value]) => `      ${name}={${javascript(value)}}`).join('\n');
  return {
    html: `<script type="module">\n  import '@hanana-kick/sidekick/auto';\n</script>\n\n<sidekick-avatar\n${htmlAttributes}\n  aria-label="나의 도우미"\n  style="width:200px;height:200px"\n></sidekick-avatar>`,
    react: `import { SidekickAvatar } from '@hanana-kick/sidekick/react';\n\nexport default function Companion() {\n  return (\n    <SidekickAvatar\n${jsxProps}\n      aria-label="나의 도우미"\n      style={{ width: 200, height: 200 }}\n    />\n  );\n}\n`,
  };
}
