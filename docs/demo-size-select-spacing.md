# Demo sizing and select spacing

The API Playground's three authored example sites start their own bot with
`size="144"`, 20% below the previous 180px CSS footprint. Its installation snippet
uses the same size. This is a demo choice, not a new library default: consumers'
explicit `size` remains authoritative, and the public size default is still 200.
The renderer, canvas allocation, Studio editor preview and original shared-header
avatar are unchanged.

Guide's general state-reference previews now use a 144px CSS footprint. Their
explicit size controls and link context still override that footprint. Deliberately
smaller positioning, behavior and entrance examples, as well as the existing
lifecycle layout, retain their sizes.

Native single-select controls share a 12px-inset chevron and 36px inline-end text
gutter (8px/28px on the compact header). The compact header gives the longer
framework label more room. RTL reverses the arrow position; forced-color mode
restores the platform arrow. Native option lists, labels and keyboard behavior are
preserved. Multi-selects/listboxes are excluded. Studio's existing Radix trigger
keeps its component and uses matching 12px padding.

Regression coverage:

- `tests/demo-size-selects.test.mjs`: demo scope, explicit Guide size preservation,
  shared CSS import, RTL and forced-color fallback.
- `tests/api-demo-browser.test.mjs`: 144px initial footprints for all three demos,
  explicit 231px override, narrow shared-header labels, native options, keyboard
  navigation and computed RTL/forced-color styling.
- `tests/studio-session-browser.test.mjs`: design-only cross-page isolation with
  the new destination size; Studio preview and original header invariants.
