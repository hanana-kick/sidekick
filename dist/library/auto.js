/** Register the default tag in a browser; safe to import during SSR. */
export * from './register.js';
import { defineSidekick } from './element/avatar.js';
defineSidekick();
