# Built-in example sites

The API playground runs three authored, fictional websites in its same-origin example iframe. They demonstrate the same real Sidekick avatar against substantially different document layouts. These are interactive frontend examples, not live commerce or social services.

- **NOVA**: a cinematic premium-hardware product site with product stories, configurable finishes, comparison, specifications, frequently asked questions, and a local contact preview.
- **MUSE**: an editorial fashion storefront with a long catalog, search, categories, sorting, favorites, product selection, and a local cart.
- **THREAD**: a three-column community with a long mixed-format timeline, local posts and replies, follows, saved posts, polls, and profiles.

## Scope and privacy

All example interactions remain in the current iframe. There is no checkout, payment processing, account creation, upload, external message delivery, or network submission. Reloading or replacing the example resets its local state. The brands, specifications, prices, identities, posts, metrics, and offers are fictional sample content, not statements about an actual business. No real Apple, Zigzag, or X marks are used. Those services inform the three different layout families only.

Images are served from the repository's `public/demo-assets` directory. No third-party image host is contacted by the running examples. Asset provenance is documented alongside the files.

## Runtime boundaries

`playground/api-demo.js` owns the readiness promise, locale selection, document-level event abort signal, actual avatar instance, realm-safe action/session cloning, lifecycle integration, and disposal. The three modules under `playground/demos` own only their respective UI and local state.

Keep the following contracts when extending the sites:

- The iframe contains exactly one actual `sidekick-avatar` with ID `bot`. The original parent header avatar remains separate.
- `#free-space`, `#preview-target`, and `#lifecycle-live` belong to the same child document as the bot.
- All four locales (`ko`, `en`, `zh-CN`, `ja`) apply to the actual example document and its UI, not just the parent selector.
- Preserve `window.sidekickDemoReady`, session application, action execution, movement, lifecycle, and disposal contracts.
- Keep controls and document scrolling usable on narrow viewports, with no horizontal page overflow.
- Local form values and mock shopping/social state must not be included in analytics.

## Verification

The browser suite tests the real iframe, not a static replacement. It covers site actions, document depth and loaded local imagery, all four locales and narrow viewports, scrolling element anchors, command/code parity, lifecycle work, repeated replacement, and separate header/demo worker ownership.

Run after building:

    npm run build:all
    node --test --test-concurrency=1 tests/api-demo-browser.test.mjs

Additional integration coverage is in `tests/api-playground-browser.test.mjs`, `tests/api-playground.test.mjs`, `tests/api-i18n.test.mjs`, and `tests/demo-worker-audit.test.mjs`.
