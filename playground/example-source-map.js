// Stable authored markers survive minification because the viewer imports raw files.
export const sourceEvents = Object.freeze({
 company: ['nova-design', 'nova-sound', 'nova-compare', 'nova-configure'],
 shop: ['shop-cheaper'], community: ['community-post', 'community-mention', 'community-post-present', 'community-mention-present'],
});
export function sourceRanges(source) {
 const ranges = {}, starts = {};
 source.split('\n').forEach((line, i) => {
  const match = line.match(/^\s*\/\/ @source-(start|end) ([a-z0-9-]+)\s*$/);
  if (!match) return;
  const [, kind, id] = match;
  if (kind === 'start') { if (starts[id] || ranges[id]) throw new Error(`Duplicate marker: ${id}`); starts[id] = i + 2; }
  else { if (!starts[id]) throw new Error(`Missing start: ${id}`); ranges[id] = { start: starts[id], end: i }; delete starts[id]; }
 });
 if (Object.keys(starts).length) throw new Error('Unclosed source marker');
 return ranges;
}
export function validSourceEvent(event, { frame, origin, site, generation }) {
 const d = event.data;
 return event.source === frame?.contentWindow && event.origin === origin && d?.type === 'sidekick-example-source' && d.site === site && d.generation === generation && sourceEvents[site]?.includes(d.id);
}

export function eventRanges(site, id, file) {
 const keys = site === 'company' ? [id, 'company-section', 'present'] : site === 'shop' ? ['shop-match', 'shop-cheaper', 'present'] : id.endsWith('-present') ? ['community-notice', 'present'] : ['community-arrival'];
 return keys.flatMap(key => file.ranges[key] ? [file.ranges[key]] : []);
}
