import { lifecycleDefaults } from '../playground/lifecycle-example.js';
import { readFileSync } from 'node:fs';
import * as schema from '../playground/state-reference-schema.js';
import { stateCopy } from '../playground/state-reference-copy.js';
import { stateLessons } from '../playground/guide-state-lessons.js';
export function installStateReferenceHarness(window){
 window.structuredClone=structuredClone;
 window.IntersectionObserver=class{observe(){}disconnect(){}};
 Object.assign(window,schema,{stateCopy,stateLessons,lifecycleDefaults});
 const source=readFileSync(new URL('../playground/state-reference.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
 window.mountStateReference=window.eval(`(function(){${source};return mountStateReference;})()`);
}
