# Real catalog accessories, authored outside the runtime

These are ports of the existing Sidekick halo, glasses, moustache, bow tie, and mirrored earrings, not approximate
triangles or calls into built-in preset factories. The curled moustache prism,
two bow loops, chamfered dark knot, and per-shape fitting data live in these author
modules. They import only the public `@hanana-kick/sidekick-plugin-sdk` and local
files. This directory includes the original license; these derived character
assets remain subject to its character terms.

- `halo.js`: head-slot torus using the body crown envelope, with original material and geometry scale.
- `glasses.js`: eyes-slot rims and bridge using named paired-affine measurements, not a runtime preset adapter.
- `earring.js` / `earring-geometry.js`: left/right hoop and drop with append-only body-following connector tubes.
- `all-slots-animation.js`: independent instance tracks for all six slots.
- `all-slots-integration.js` / `all-slots-lazy-integration.js`: full six-slot eager/lazy integration examples.
- `moustache.js`: mouth-slot asset, with the original continuous two-lobe outline.
- `bow-tie.js`: neck-slot asset, with separate loops and a `.78` knot material.
- `geometry.js`: plugin-owned prism/ear-clipping implementation and normals.
- `mounts.js`: all 35 shape fits, including bow-tie notch overrides. Metadata is
  serializable; it contains no callbacks or built-in preset names.
- `animation.js`: an independent clip targeting `plugin-moustache` and
  `plugin-bow-tie`, not body, face, eye, or built-in reference tracks.
- `eager-integration.js` / `lazy-integration.js`: separate shared-registry examples.
- `integration.js`: equipment, comparison, and animation application helpers.

Install the runtime and standalone SDK from the same release ZIP. In an
application bundler, import `createEagerCatalogRegistry` from `eager-integration.js`
or `createLazyCatalogRegistry` from `lazy-integration.js`, then pass the resulting registry to
`equipCatalogPlugins(bot, registry)` for each avatar. Register the avatar element
as usual with `@hanana-kick/sidekick/register`. Registry ownership belongs to the
application: one plugin factory executes per registered ID, even when several
avatars load concurrently. The lazy entry does not import either asset module
until its first equipment/load request. Dispose the registry after those avatars finish.

Use `compareCatalogPlugins(referenceBot, [pluginBotA, pluginBotB], registry)` to
keep the original catalog visible separately. Change the same shape/orientation
on all three avatars to compare them. `playCatalogAnimation(pluginBotA)` animates
only that avatar's plugin instances; the built-in reference and second avatar
stay unchanged. Pause and seek to inspect the pose deterministically.

The `contained-front` attachment is generic, not a preset adapter. The runtime
interpolates the plugin's UV/rotation/scale metadata with the visible morph
snapshot, handles interruptions, and solves front clearance against the current
body. Factory geometry is cached; workers receive only copied mesh buffers and
plain attachment/material data. Bow-tie colors are multiplied and rounded once
per RGB channel, exactly like the original flat knot material.

For the complete six-slot comparison use `compareAllSlots(reference, external)`
from `all-slots-integration.js`. Supply `createAllSlotsLazyRegistry()` from the
separate lazy entry when deferred loading is desired. Each ID loads once per
registry; the two earrings share a JavaScript module but retain distinct asset IDs.
The authored modules never import private runtime source or delegate geometry to
built-in accessories. Calibration values are explicit author-owned data.

The full set fits within the 4,096-vertex / 8,192-triangle combined fitted-equipment
budget. A single composed fitted asset is limited to 2,048 vertices / 4,096 triangles;
connector geometry is counted before allocation. Procedural recipes are bounded
numeric data, not expression strings or worker-executed callbacks.

After installing/extracting the SDK, run `node examples/catalog/validate.mjs`
from its package directory to validate every author module and the shared clip
without importing the runtime or initializing a renderer. This validates author
inputs, not a claim of browser rendering or collision-free animation.
