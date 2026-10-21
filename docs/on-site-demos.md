# Contextual on-site examples

The API Playground defaults to local, content-driven examples rather than floating corner controls. The optional API editor lives in normal document flow. Opening it pauses autonomous examples; after an explicit manual API command, the page remains in manual mode until Reset demo. Studio supplies appearance only. The authored 115px host fits the default visible artwork to about 64 CSSpx, without changing library defaults or user-selected sizes.

- NOVA: scrolling into design, listening modes, comparison and configuration sections moves the companion to the real element and explains that section once per demo session.
- MUSE: saving a heart adds the real SKU to the local wishlist. Encountering a cheaper product in a comparable fixture group can trigger an offer. Prices and savings are calculated from the same catalog used by product cards; saved products and equal/more expensive products are excluded. Skirts have their own comparison group so they cannot be compared to tees despite legacy broad navigation categories. Advice explicitly says fit/details may differ.
- THREAD: the first feed scroll schedules one clearly labeled local new-post arrival; publishing a local post schedules one local mention. These insert real local feed rows and notifications. They do not represent remote people or external service notifications.

All three use the public `moveToElement`, `say` and `clearSpeech` methods. Messages replace rather than accumulate. Each content/offer event is shown once, with a 7.5-second cooldown and at most one latest pending message. Scroll-away, hidden document, editor pause, reset and disposal clear speech, cancel motion and release anchors. Reduced-motion uses immediate positioning. No polling/continuous animation loop is added by these scenarios.

The analytics entry is no longer a viewport overlay. API/Guide use a normal-flow footer; Studio's non-scrolling shell uses a compact normal-flow header entry. Its panel starts closed and opens only on request. Consent version/storage, default-off behavior, providers, revocation, payload restrictions and four-language copy are unchanged. Opening settings or browsing examples never grants consent.

`tests/demo-scenarios.test.mjs` covers real-target routing, strict cheaper comparison, queued-arrival races, offscreen cancellation and locale coverage. `tests/demo-sites.test.mjs` also covers actual wishlist snapshots and local feed insertion. Browser regressions exercise actual scrolling and native controls, not artificial notification injection.

## Package budget

The speech implementation adds no runtime dependency. The verified dry-run tarball is 949,129 bytes versus the previous 932,910 bytes (+16,219 bytes). The approved package regression budget is 960,000 bytes, leaving bounded headroom rather than removing the size check.
