# API playground: website preview and bot controls

The API page is now a preview-first workspace. Open **Bot controls** in the bottom-right corner to configure actions, run them, copy JavaScript/React code or inspect diagnostics. Close the non-modal drawer or press Escape to return focus to its launcher. Closing it does not reset the bot, draft, generated code, Studio scene, language or framework. It is not a second browser window. The drawer scrolls independently and becomes a single column on narrow screens.

The built-in demo is part of the parent document. Click its empty space to move the bot; use `#preview-target` with `moveToElement` to try element-relative movement. Lifecycle examples also run in the built-in demo. Selecting Run for a lifecycle example returns to this demo so its targets remain usable. Explicit technical lesson and editor hash links open the drawer; Guide scenario/context links retain their existing lesson-specific exercise view.

## External websites

Enter a full HTTP(S) URL, then choose **Load site**. Loading is explicit: query-string URLs are not automatically visited. HTTPS pages reject HTTP previews rather than attempting mixed-content loading. Credentials in URLs and non-HTTP(S) schemes are rejected. Refresh reloads the last submitted URL, not an unsubmitted draft. **Built-in demo** unloads the frame.

An embedded site may refuse framing with CSP `frame-ancestors` or X-Frame-Options. The playground never proxies pages, removes these protections, or claims reliable success/failure detection from iframe load events. A blank/rejected frame can be replaced by the built-in demo. The status means “preview requested,” not “loaded successfully.”

The bot belongs to the parent page and uses its viewport coordinates. It does not inject Sidekick into the embedded website. Selectors and pointer tracking cannot access iframe content. By default, clicks/scrolling inside the frame belong to that site. Optional **Capture clicks to move the bot** adds a clearly labeled interaction layer; turn it off to interact with the site again. It starts off. A closed controls drawer has no invisible overlay or focus trap.

The iframe allows scripts for rendering, but uses an opaque sandboxed origin without forms, popups, downloads, top navigation, or privileged device access. Login, storage and some site features may consequently fail. This is a preview, not a way to authenticate or submit remote forms. Browser cookie/network policy still applies; this is not a guarantee of anonymous navigation.

## Analytics and privacy

The entered URL, path, query, fragment and input text stay in memory and the iframe's navigation only. The playground does not put them into local/session storage, page history, generated code, GA4. Existing site-only, allowlisted action/setting analytics remain unchanged; the library and distributed examples have no analytics. Loading a URL necessarily makes a browser request to that destination. No referrer is sent.

## Verification

Unit tests cover drawer state/focus, preserved drafts, URL validation, no automatic navigation, sandbox policy, uncertain load status, demo restoration and analytics exclusion. Browser regression coverage includes 320px/1280px viewports, pointer passthrough, keyboard handling and framing rejection. Browser results must be checked in supported CI; unit tests do not prove visual layout.

References: [MDN iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe), [CSP frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).
