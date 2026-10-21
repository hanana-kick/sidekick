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


## Text dialogue API

say(text, options) shows a plain-text bubble without audio and immediately returns void. Each call replaces the previous message and timer; there is no queue. clearSpeech() returns void and is idempotent. There is no completion Promise or end event.

duration accepts 0–60000ms, default 5000. Zero persists until dismissal. placement accepts auto (default), top or bottom, with opposite-side fallback when space is limited. dismissible defaults to false. Supply a localized accessible dismissLabel when enabling its close button.

Blank text, text over 1000 characters and invalid options throw TypeError without replacing current speech. HTML is never interpreted. Document hiding, moving offscreen, exit(), hidden presence and DOM removal dismiss speech permanently. Call clearSpeech() on application reset.

The small DOM bubble follows conservative avatar DOM bounds, not exact ink bounds, and stays within its current iframe/viewport. Long text wraps inside a bounded, scrollable message region. Only an overflowing message becomes keyboard-focusable and accepts pointer/touch scrolling; the close button stays outside the scrolling text. The full text is also available as a polite live status. It never moves focus and only the optional close button and overflowing text intercept input. There is no extra rendering loop, GPU pass, audio or enlarged canvas.

```js
const bot = document.querySelector('sidekick-avatar');
bot.say("This one costs less!", {
  duration: 5000, placement: 'auto',
  dismissible: true, dismissLabel: "Dismiss message"
});
// React: botRef.current?.say(text, options);
// Reset / cleanup:
bot.clearSpeech();
```

TypeScript: `SpeechOptions` from `@hanana-kick/sidekick/register` or `@hanana-kick/sidekick/react`. Method-only API; no HTML attributes or declarative React speech props.

Geometry restriction: say() throws TypeError before replacing current speech if the avatar uses CSS zoom or any composed ancestor uses transforms (including individual translate/rotate/scale), perspective or CSS zoom. Body and html must not establish a fixed-position containing block through filter, backdrop-filter, containment, will-change or content-visibility. Own avatar transforms are supported. Keep these restrictions for the message lifetime; clear speech before changing ancestor geometry.
