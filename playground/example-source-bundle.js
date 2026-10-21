import html from '../api-demo.html?raw';
import runtime from './api-demo.js?raw';
import sharedCSS from './api-demo.css?raw';
import scenarios from './demo-scenarios.js?raw';
import { sourceRanges } from './example-source-map.js';
const sites = {
 company: () => Promise.all([import('./demos/company.js?raw'), import('./demos/company.css?raw')]),
 shop: () => Promise.all([import('./demos/shop.js?raw'), import('./demos/shop.css?raw')]),
 community: () => Promise.all([import('./demos/community.js?raw'), import('./demos/community.css?raw')]),
};
export async function loadExampleSource(site) {
 if (!sites[site]) throw new Error('Unknown example');
 const [js, css] = await sites[site]();
 return [ ['api-demo.html', html], [`playground/demos/${site}.js`, js.default], [`playground/demos/${site}.css`, css.default], ['playground/demo-scenarios.js', scenarios], ['playground/api-demo.js', runtime], ['playground/api-demo.css', sharedCSS] ].map(([path, text]) => ({ path, text, ranges: sourceRanges(text) }));
}
export { eventRanges } from './example-source-map.js';
