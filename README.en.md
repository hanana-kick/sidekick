# Sidekick

[한국어](README.md) · [English](README.en.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

**A transparent, flat-style character library built from 35 Material shapes.** Start with a single `<sidekick-avatar>` and control it through HTML attributes, JavaScript APIs, or a React wrapper. It supports shape morphing, independent eye expressions, pointer tracking, body orientation, six accessory slots, and directional movement across the page. The framework-independent core uses TypeScript, Web Components, and WebGL2.

- [Installation](#installation) · [HTML](#using-html-directly) · [React](#using-react)
- [All attributes](#html-attributes-and-react-props) · [Design and accessories](#design-json-and-accessories) · [Animation/API](#animation-and-imperative-apis)
- [Declarative behavior](#declarative-behavior) · [Movement/flight](#rendering-and-movement-standard-v03) · [Events/cleanup](#events-and-cleanup) · [SSR](#ssr-and-browser-support) · [Studio/development](#studio-and-development)

## Installation

**Install the prebuilt package directly from the public GitHub repository.** Run this command in your project:

```sh
npm install https://github.com/hanana-kick/sidekick.git
```

To pin a version, specify a release tag:

```sh
npm install https://github.com/hanana-kick/sidekick.git#v0.12.0
```

The repository includes built ESM, type declarations, and browser bundles, so **consumers do not need to build Sidekick from source.** Commit your dependencies and lockfile so your team uses the same version. The package name is `@hanana-kick/sidekick`, and this version is `0.12.0`. **It has not been published to the npm registry: do not run `npm install @hanana-kick/sidekick` using the name alone.**

For an HTML site without npm, download the prebuilt files from [GitHub Releases](https://github.com/hanana-kick/sidekick/releases). ESM, classic `<script>` JavaScript, and a dedicated rendering worker are provided. The browser core requires no React, bundler, Node.js, separate CSS, or fonts.

### Downloading from GitHub Releases

1. Open [Releases](https://github.com/hanana-kick/sidekick/releases).
2. Under the chosen tag's **Assets**, download `sidekick-browser-0.12.0.zip` or `hanana-kick-sidekick-0.12.0.tgz`. For another version, use the filename matching its tag. The automatically generated **Source code (zip/tar.gz)** archives contain source code, not the browser distribution ZIP.
3. For a plain HTML site, extract the browser ZIP and copy the following files into your site's static directory. Read the included `START-HERE.txt` and open your preferred `esm.html`, `classic.html`, or `react.html` example. `/vendor/sidekick/` in the examples is **a path on your site**; adjust it to your deployment.

| Built file | Purpose | Required files/dependencies |
| --- | --- | --- |
| `sidekick-browser-0.12.0.zip` | Plain HTML/React browser distribution | Includes `esm.html`, `classic.html`, `react.html`, the six JS files below, optional `vendor/`, README, and notices |
| `sidekick.js` | Browser ESM for `import` and `<script type="module">` | Keep `sidekick.worker.js` in the same directory |
| `sidekick.iife.js` | Classic `<script>` exposing `window.Sidekick` | Keep `sidekick.worker.js` alongside it; do not use `type="module"` |
| `sidekick-react.js` | ESM component for React 19 | Keep `sidekick-element.js`, `sidekick-fallback.js`, and `sidekick.worker.js` alongside it, and provide the `react` peer |
| `sidekick-element.js` | Renderer loaded lazily by the React wrapper | Do not import directly; use the same version as `sidekick-react.js` |
| `sidekick-fallback.js` | Renderer loaded by the React element when workers are unavailable | Do not import directly; keep all files on the same version |
| `sidekick.worker.js` | Dedicated OffscreenCanvas worker | Place beside the browser entry files; do not load with a separate script tag |
| `vendor/react.js`, `vendor/react-dom-client.js` | Optional React 19/ReactDOM ESM in the browser ZIP | For the no-build React example below, connected via an import map; unnecessary when your app already provides React |
| `hanana-kick-sidekick-0.12.0.tgz` | Package for an existing npm-based project | Built ESM, type declarations, browser bundles, and notices |
| `SHA256SUMS` | Verify ZIP and tarball download integrity | Checksum file in the same release |

Keep the README and third-party license/attribution notices included in the ZIP. **Download GitHub Release assets and serve them from your own site.** Their download URLs are not browser JavaScript hosting URLs; asset MIME/CORS behavior differs from static hosting. The `src`/`import` paths below refer to your site's copies of the downloaded files.

Both `sidekick.js` and `sidekick.iife.js` export the complete public core/element API and automatically register `<sidekick-avatar>`. **Choose only one.** Classic JS means a browser global script, not a Node.js CommonJS `require()` build. The React wrapper does not bundle React. `SidekickAvatar` from `sidekick.js` is the custom element class; the same name from `sidekick-react.js` is the React component.

### Optional: installing the prebuilt tarball

Install the downloaded release tarball in your project. This command neither compiles Sidekick source nor builds Studio.

```sh
npm install /absolute/path/to/hanana-kick-sidekick-0.12.0.tgz
```

React 19 is required only for the React wrapper. Supply the matching version of `react-dom` yourself to mount the page. Core-only projects do not require React.

### Package entry points

| Import path | Purpose |
| --- | --- |
| `@hanana-kick/sidekick` | Automatically register the default tag in the browser and export public APIs |
| `@hanana-kick/sidekick/auto` | Explicit auto-registration entry point |
| `@hanana-kick/sidekick/register` | Import `defineSidekick`, the element class, and public APIs without automatic registration |
| `@hanana-kick/sidekick/core` | Create/validate designs and scenes, and use motion, body-orientation, and pixel utilities without a DOM |
| `@hanana-kick/sidekick/react` | React `SidekickAvatar` component and props/ref types |

Package modules use ESM. Runtime modules/types live in `dist/library/`, and ready-to-use browser bundles in `dist/browser/`. `dist/src/` is for internal tests. Browsers cannot resolve bare package specifiers directly, so use a bundler or import map for package imports. The HTML examples below use actual file URLs and do not need that setup.

## Emotions and transient reactions

Emotion is a presentation layer independent of **what the bot is doing**. It coordinates eyes, body lean and rhythm without cancelling waiting, reviewing, activity or movement. The application explicitly supplies the feeling; Sidekick does not infer a human user’s emotions.

`neutral`, `happy`, `sad`, `curious`, `surprised`, `concerned`, `excited`. `intensity` ranges from 0 to 1 and defaults to 1. `neutral` releases the emotional overlay to the current design and behavior.


```ts
import type { SidekickAvatar } from '@hanana-kick/sidekick';
const bot = document.querySelector<SidekickAvatar>('sidekick-avatar')!;
bot.setEmotion('curious', { intensity: 0.6 });
bot.behavior = { type: 'wait', target: '#loading' };
await bot.reactTo('happy', { intensity: 0.9, duration: 1600 });
bot.setEmotion('neutral');
```

```html
<sidekick-avatar emotion="curious" emotion-intensity="0.6"></sidekick-avatar>
```

```tsx
<SidekickAvatar emotion="curious" emotionIntensity={0.6}
  behavior={{ type: 'wait', target: '#loading' }}
  onEmotionChange={event => console.log(event.detail)}
  onReactionEnd={event => console.log(event.detail.reason)} />
```

`setEmotion()` sets the persistent state and replaces an active reaction. `reactTo()` reacts for 1200ms by default, then returns to the persistent emotion. `duration` is the dwell time including the incoming blend (0–60000ms), not a wait for the outgoing blend to settle. `cancelReaction()` cancels only the reaction. A newer reaction, persistent setting or disconnection settles the previous reaction with `finished: false`; stale timers cannot overwrite newer state.

The `emotion`/`emotionIntensity` properties read the persistent setting. `emotionState` includes the live reaction: `{ emotion, intensity, baseline: { emotion, intensity }, reacting }`. `sidekick-emotion-change` carries this state. `sidekick-reaction-end` and the Promise carry `{ finished, emotion, reason }`, where `reason` is `completed`, `replaced`, `cancelled` or `disconnected`. Completion means dwell ended, not that the return blend has visually settled.

Emotion never writes or restores saved design, activity, gaze or body orientation. Explicit `setExpression()`, `setEyeWeights()`, `motion.to({ eyes: … })`, eye changes through `updateDesign()` or design replacement, and HTML/React eye controls take presentation control of the affected eye or eyes. Editing only the left eye preserves the right eye's emotional expression and the body's emotional motion. These eye commands remain visible while emotion is active; clearing emotion first is not required.

A new explicit `setEmotion()` or `reactTo()` returns both eyes to emotional control, including when the same emotion is specified again. Reaction completion or `cancelReaction()` returns to the persistent emotion without reclaiming eyes manually edited after the reaction began. `setEmotion('neutral')` releases the emotional overlay. Automatic blinking and the legacy shared `eyes.openness` limit remain independent and can still close an otherwise open eye. Target-directed behavior takes priority over secondary emotional gaze. Rendering sleeps offscreen while the reaction dwell uses wall-clock time. Reconnecting does not replay expired reactions.

| HTML / API | React | Description |
| --- | --- | --- |
| `emotion` | `emotion` | Emotion name; default neutral |
| `emotion-intensity` | `emotionIntensity` | Emotion strength 0–1; default 1 |
| `sidekick-emotion-change` | `onEmotionChange` | Persistent emotion or transient reaction changed |
| `sidekick-reaction-end` | `onReactionEnd` | Reaction completed, replaced, cancelled or disconnected |

### Transitions and immediate authored settings

`design`, `setDesign()`, `updateDesign()`, `equipAccessory()` and `removeAccessory()` persist the requested settings immediately, while rendering blends smoothly from the currently displayed appearance. Default eye transitions take 400ms and body-shape transitions 450ms; explicit transition durations take precedence. Body orientation also changes smoothly. Retargeting mid-transition does not restart from the original appearance.

Direct equipment additions, removals and replacements use a renderer-only 200ms per-slot fade: old equipment fades out, swaps at zero opacity, then new equipment fades in. The body and other slots do not fade with it. An explicit `transitionTo()` uses its own fade and skips the extra renderer fade.

Paused or reduced-motion mode settles immediately at the target. Reading settings already returns the new target during the visual transition, so do not treat an authored-state read as a signal that the animation has finished.

## Using the CDN without a build

The currently recommended CDN version is **0.12.0**. These URLs serve **already built JavaScript** committed to a GitHub tag through jsDelivr: no source build, npm installation, or npm account is needed. Pin an **exact tag**, not `main`, `latest`, or a version range. Earlier `v0.2.7` files have not been changed. Version 0.2.7 is also downloadable through the same CDN path, but cross-origin pages cannot create its worker and fall back to the main thread; use the current pinned version for new CDN integrations.

### Plain HTML / classic script

```html
<script defer src="https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.12.0/dist/browser/sidekick.iife.js"></script>
<sidekick-avatar shape="ghostish" head-accessory="beret"
  eyes-accessory="glasses" neck-accessory="bowTie"
  left-smile="1" right-smile="1"
  style="display:block;width:240px;height:240px"></sidekick-avatar>
```

### ESM

```html
<sidekick-avatar id="bot" shape="heart"></sidekick-avatar>
<script type="module">
  import { createDesign } from 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.12.0/dist/browser/sidekick.js';
  console.log(createDesign());
</script>
```

ESM and classic scripts automatically register the same element. Use only one on a page.

### React: running in the browser without a build

Prebuilt ESM for matching React and ReactDOM 19.3.1 is provided. Declare the import map before all module scripts. This example uses `createElement` without JSX transformation.

```html
<div id="root"></div>
<script type="importmap">
{
  "imports": {
    "react": "https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.12.0/cdn/react-19.3.1/react.js",
    "react-dom/client": "https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.12.0/cdn/react-19.3.1/react-dom-client.js"
  }
}
</script>
<script type="module">
  import { createElement } from 'react';
  import { createRoot } from 'react-dom/client';
  import { SidekickAvatar } from 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.12.0/dist/browser/sidekick-react.js';
  createRoot(document.getElementById('root')).render(createElement(SidekickAvatar, {
    shape: 'ghostish', headAccessory: 'beret', eyesAccessory: 'glasses',
    neckAccessory: 'bowTie', leftSmile: 1, rightSmile: 1,
    style: { width: 240, height: 240 }
  }));
</script>
```

In an existing React app, reuse the app's React instance. Do not load a second React using this import map; install through npm/GitHub and import `@hanana-kick/sidekick/react` instead.

### Workers, CORS, CSP, and self-hosting

- CDN JS responses require a JavaScript MIME type and `Access-Control-Allow-Origin: *`; jsDelivr provides these. Do not put GitHub Release download URLs into `script src`.
- Since 0.2.8, when the page and CDN origins differ, a local Blob module worker statically imports the CDN's `sidekick.worker.js`. Rendering still runs in an OffscreenCanvas worker. Blob URLs are revoked after startup, on errors, and on teardown.
- With CSP, permit `worker-src 'self' blob:` and `https://cdn.jsdelivr.net` in `script-src`. The inline examples and import map also require a nonce/hash appropriate for your policy. There is no need to weaken the entire CSP or add `unsafe-inline`.
- If workers/WebGL2/OffscreenCanvas are unsupported or CSP blocks workers, the existing main-thread renderer is used as a fallback. Serve over HTTPS; use localhost for local HTTP development.
- For self-hosting, keep **all six JS files** from the browser ZIP in the same directory. React lazily loads matching `sidekick-element.js` and `sidekick-fallback.js` files. Do not replace just the worker or a chunk with a different version.
- Tagged distributions are immutable. Fixes are released under a new patch version. jsDelivr retains first-requested files for a long time; do not treat deletion as a rollback mechanism.

Official CDN behavior and caching policy: [jsDelivr GitHub distribution documentation](https://github.com/jsdelivr/jsdelivr#github).

## Using HTML directly

### Minimal ESM example

Place the downloaded `sidekick.js` and `sidekick.worker.js` in your site's `/vendor/sidekick/` directory, then start with these two lines:

```html
<script type="module" src="/vendor/sidekick/sidekick.js"></script>
<sidekick-avatar></sidekick-avatar>
```

After registration, a transparent 200 × 200px character appears. Defaults are a yellow `#FFCC37` `square`, dark eyes, no accessories, and the `idle` activity. Set its size with ordinary CSS. Configure appearance through catalog/equipment choices and colors; individual part geometry dimensions, depth, and positions are not public settings.

### Complete HTML example: ESM import

Save the following as `index.html` and serve it with the downloaded files over HTTP(S). It runs without building source, installing npm packages, or using an import map. Listeners are attached before `import()` to catch initial error/ready events.

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sidekick ESM</title>
  <style>sidekick-avatar { width: 200px; height: 200px; }</style>
</head>
<body>
  <sidekick-avatar id="bot" shape="verySunny" body-color="#ffcc37"
    eye-color="#24242c" head-accessory="beret" head-color="#b84742"
    tracking-mode="eyes-and-body" interaction="box" shape-duration="450"
    aria-label="작업 도우미"></sidekick-avatar>
  <button id="change" disabled>도형 바꾸기</button>
  <p id="status" role="status">불러오는 중</p>
  <script type="module">
    const bot = document.querySelector('#bot');
    const button = document.querySelector('#change');
    const status = document.querySelector('#status');
    bot.addEventListener('sidekick-ready', () => { status.textContent = '준비 완료'; });
    bot.addEventListener('sidekick-error', event => { status.textContent = event.detail.message; });
    try {
      const { createAccessory } = await import('/vendor/sidekick/sidekick.js');
      // 기본 태그는 이미 자동 등록됨. defineSidekick() 호출 불필요.
      await bot.equipAccessory(createAccessory('glasses', 'frames'));
      button.disabled = false;
      button.addEventListener('click', async () => {
        try {
          const shape = bot.design.body.shape === 'heart' ? 'verySunny' : 'heart';
          await bot.setShape(shape, { duration: 450, easing: 'smooth' });
        } catch (error) { status.textContent = error.message; }
      });
    } catch (error) { status.textContent = error.message; }
  </script>
</body>
</html>
```

Static ESM imports work as well. Public functions can be imported from the single `sidekick.js` entry:

```js
import { createDesign, createAccessory, defineSidekick } from '/vendor/sidekick/sidekick.js';
```

### Complete HTML example: classic JS script

Copy `sidekick.iife.js` and `sidekick.worker.js` into the same directory and load without `type="module"`. Registration is automatic, and the same public API is available on the `Sidekick` global. Execute the external script before using the API below it. Do not arbitrarily add `async`/`defer` to this ordered example.

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sidekick classic JS</title>
  <style>sidekick-avatar { width: 200px; height: 200px; }</style>
</head>
<body>
  <sidekick-avatar id="bot" shape="heart" body-color="#8bba9c"
    tracking-mode="eyes-and-body" interaction="box" aria-label="작업 도우미"></sidekick-avatar>
  <button id="change">도형 바꾸기</button>
  <p id="status" role="status">불러오는 중</p>
  <script>
    const bot = document.querySelector('#bot');
    const status = document.querySelector('#status');
    bot.addEventListener('sidekick-ready', () => { status.textContent = '준비 완료'; });
    bot.addEventListener('sidekick-error', event => { status.textContent = event.detail.message; });
  </script>
  <script src="/vendor/sidekick/sidekick.iife.js"></script>
  <script>
    if (window.Sidekick) {
      bot.equipAccessory(Sidekick.createAccessory('halo', 'aura'))
        .catch(error => { status.textContent = error.message; });
      document.querySelector('#change').addEventListener('click', async () => {
        try {
          const shape = bot.design.body.shape === 'heart' ? 'puffy' : 'heart';
          await bot.setShape(shape, { duration: 600 });
        } catch (error) { status.textContent = error.message; }
      });
    } else { status.textContent = 'Sidekick JS 파일을 불러오지 못했습니다.'; }
  </script>
</body>
</html>
```

Serve through HTTP(S), rather than double-clicking a `file://` URL. `.js` responses must have a JavaScript MIME type; avoid SPA fallbacks that return `index.html` for missing files. If JS is served from another origin, configure module CORS too. These examples use the same origin. The two core bundles require no additional JS, image, or font downloads.

### Explicit registration and commands

```ts
import {
  defineSidekick,
  createDesign,
  createAccessory,
  type SidekickAvatar,
} from '@hanana-kick/sidekick/register';

defineSidekick(); // 여러 번 불러도 이미 등록된 기본 태그는 재등록하지 않음
await customElements.whenDefined('sidekick-avatar');
const bot = document.querySelector<SidekickAvatar>('#bot');
if (!bot) throw new Error('봇 요소를 찾을 수 없습니다.');

await bot.setDesign(createDesign({
  body: { shape: 'puffy', color: '#8bba9c' },
  accessories: [createAccessory('glasses', 'frames')],
}));
await bot.setShape('cookie9Sided', { duration: 600, easing: 'smooth' });
bot.trackingMode = 'off';
bot.lookAt({ space: 'view', x: 0.6, y: 0.2 });
```

You can register another tag using `defineSidekick('my-companion')`. The React wrapper uses the default `sidekick-avatar`. `whenDefined()` indicates class registration, not GPU rendering readiness. `ready` is a read-only boolean, not a Promise. Before exporting PNG, check `bot.ready === true` or wait for `sidekick-ready`.

## Using React

### Existing React 19 projects

Install using the GitHub URL or release `.tgz` above, then render this component in your app. Your existing tooling handles JSX/TSX; Sidekick itself does not need rebuilding.

```tsx
import { useRef, useState } from 'react';
import {
  SidekickAvatar,
  type SidekickAvatarRef,
} from '@hanana-kick/sidekick/react';

export function Companion() {
  const bot = useRef<SidekickAvatarRef>(null);
  const [shape, setShape] = useState<'square' | 'heart'>('square');
  const [tracking, setTracking] = useState(true);

  return (
    <>
      <SidekickAvatar
        ref={bot}
        shape={shape}
        bodyColor="#8bba9c"
        headAccessory="beret"
        trackingMode={tracking ? 'eyes-and-body' : 'off'}
        interaction="box"
        shapeDuration={450}
        shapeEasing="smooth"
        aria-label="나의 도우미"
        style={{ width: 160, height: 160 }}
        onReady={() => console.log('렌더 준비 완료')}
        onError={event => console.error(event.detail.message)}
      />
      <button onClick={() => setShape(value => value === 'square' ? 'heart' : 'square')}>
        도형 바꾸기
      </button>
      <button onClick={() => setTracking(value => !value)}>마우스 추적 전환</button>
      <button onClick={() => void bot.current?.setExpression('left', 'smile')}>
        왼쪽 눈 웃기
      </button>
    </>
  );
}
```

The wrapper registers the element in the browser and maps camelCase props to HTML attributes. Its `ref` is the actual element, so the existing imperative API is available. `design`, `accessories`, and `motion` accept typed objects rather than strings. Ordinary `id`, `className`, `style`, `aria-*`, and `data-*` props are forwarded too.

```tsx
import { createAccessory, createDesign } from '@hanana-kick/sidekick/core';
import { SidekickAvatar } from '@hanana-kick/sidekick/react';

const design = createDesign({
  body: { shape: 'clover4Leaf', color: '#8bba9c' },
  accessories: [createAccessory('halo', 'aura')],
});

<SidekickAvatar design={design} trackingMode="off" />;
```

Attribute changes update the existing element. Keep a stable `key`: changing it or conditionally removing the element during animation recreates the runtime. If both props and imperative APIs control a value, changing the corresponding prop later reapplies the declarative value. Use the `shape` prop or `setShape()` for animated transitions. The React `design` prop maps to the HTML `design` attribute, so post-connection shape changes use `shapeDuration`. In contrast, the element's JavaScript `design` property and `setDesign()` apply the whole design immediately.

### No-build React HTML example

Keep `sidekick-react.js`, `sidekick-element.js`, and `vendor/` from the browser ZIP in place. Open the included `react.html`, or save the following HTML **in the same directory**. Served over HTTP(S), it runs React without installation, JSX transformation, or a source build. For example, if you copied the files to `/vendor/sidekick/`, open `/vendor/sidekick/react.html`.

This example uses **production ESM for React/ReactDOM 19.3.1** included in the ZIP. The React peer and ReactDOM page mounting are separate from the core. Keep both vendor files and the included React, ReactDOM, and scheduler licenses. In an existing React app, use its peer rather than adding another React copy. There are no runtime requests to an external CDN or GitHub download URLs.

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sidekick React</title>
  <script type="importmap">
    {
      "imports": {
        "react": "./vendor/react.js",
        "react-dom/client": "./vendor/react-dom-client.js"
      }
    }
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import { createElement as h, useRef, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { SidekickAvatar } from './sidekick-react.js';

    function App() {
      const bot = useRef(null);
      const [shape, setShape] = useState('square');
      const [tracking, setTracking] = useState(true);
      const [ready, setReady] = useState(false);
      const [error, setError] = useState('');
      return h('main', null,
        h(SidekickAvatar, {
          ref: bot, shape, bodyColor: '#8bba9c', headAccessory: 'beret',
          trackingMode: tracking ? 'eyes-and-body' : 'off', interaction: 'box', shapeDuration: 450,
          style: { width: 200, height: 200 }, 'aria-label': '작업 도우미',
          onReady: () => setReady(true),
          onError: event => setError(event.detail.message),
        }),
        h('button', { onClick: () => setShape(value => value === 'square' ? 'heart' : 'square') }, '도형 바꾸기'),
        h('button', { onClick: () => setTracking(value => !value) }, '마우스 추적 전환'),
        h('button', {
          disabled: !ready,
          onClick: async () => {
            try { await bot.current?.setExpression('left', 'smile'); }
            catch (error) { setError(error.message); }
          },
        }, '왼쪽 눈 웃기'),
        h('p', { role: 'status' }, error || (ready ? '준비 완료' : '불러오는 중')),
      );
    }
    createRoot(document.querySelector('#root')).render(h(App));
  </script>
</body>
</html>
```

The `react` import in `sidekick-react.js` must be resolved by an import map or your app's bundler. Renderer files load relative to the wrapper; do not move or rename `sidekick-element.js`. The React example does not additionally need `sidekick.js` or `sidekick.iife.js`.

## HTML attributes and React props

These tables list **all supported HTML configuration attributes and React-specific props**. camelCase names are React prop names, not necessarily JavaScript properties on the element. In plain HTML, use `setAttribute()`/`removeAttribute()`; use imperative APIs for compound operations. Read-only state, events, and PNG output are available through APIs.

- All configuration props are optional. Defaults describe a new element without a `design` or other underlying input. **Omission means no override.** For example, if `design` specifies `heart`, omitting `shape` does not change it to `square`.
- HTML values are strings. Write numbers as `shape-duration="450"` and JSON as `motion='{"body":{"rotation":[0,0,0.2]}}'`. React uses numbers like `{450}`, booleans `{true}`/`{false}`, and actual objects/arrays for compound values.
- Clear a React configuration prop by setting **`undefined` or omitting it**. The wrapper removes attributes it previously set. Configuration props do not accept `null`, except `behavior`, where `null` explicitly cancels the behavior. `ref={null}` follows React's normal reference-clearing rules.
- See the [complete shape catalog](#shape-rendering-scope-and-licenses) for all 35 `MaterialShapeName` values, [design JSON](#design-json-and-accessories) for `AvatarDesign`/`AccessoryDesign`, and the table below for every `MotionTarget` field. String enums are case-sensitive.

### Basics, body, and eyes

| HTML attribute | React prop | React type | Allowed values / defaults |
| --- | --- | --- | --- |
| `design` | `design` | `AvatarDesign` | Complete design JSON string in HTML; defaults to the v7 design from `createDesign()` |
| `shape` | `shape` | `MaterialShapeName` | 35 catalog names; underlying design's shape, otherwise `square` |
| `body-color` | `bodyColor` | `string` | `#RRGGBB`; underlying design color, otherwise `#FFCC37` |
| `eye-color` | `eyeColor` | `string` | `#RRGGBB`; underlying design color, otherwise `#24242c` |
| `expression` | `expression` | `EyeExpression` | `neutral` / `smile` / `blink`; omission preserves both design weights, initially `neutral` |
| `left-expression` | `leftExpression` | `EyeExpression` | Left `neutral` / `smile` / `blink`; omission uses shared expression/design |
| `right-expression` | `rightExpression` | `EyeExpression` | Right `neutral` / `smile` / `blink`; omission uses shared expression/design |
| `smile` | `smile` | `number` | Both smile weights, 0–1; omission uses expression/design, initially 0 |
| `blink` | `blink` | `number` | Both blink weights, 0–1; omission uses expression/design, initially 0 |
| `left-smile` | `leftSmile` | `number` | Left smile, 0–1; omission uses shared smile/expression/design, initially 0 |
| `right-smile` | `rightSmile` | `number` | Right smile, 0–1; omission uses shared smile/expression/design, initially 0 |
| `left-blink` | `leftBlink` | `number` | Left blink, 0–1; omission uses shared blink/expression/design, initially 0 |
| `right-blink` | `rightBlink` | `number` | Right blink, 0–1; omission uses shared blink/expression/design, initially 0 |
| `accessories` | `accessories` | `readonly AccessoryDesign[]` | Array JSON in HTML; omission uses design equipment, initially `[]`; specifying replaces the whole array |
| `render-style` | `renderStyle` | `RenderStyle` (`'flat'`) | Only `flat` is publicly supported, default `flat`; legacy HTML `3d` is normalized to `flat` |

### Equipment slots

There are **12 presets and six independent slots**. All slots start empty. Omitting a slot choice uses equipment from `accessories`/`design`; `none` unequips it even if present in underlying data. Selection props are unions of the preset strings below, and color props are `string`.

| HTML attribute | React prop | Allowed values / behavior when omitted |
| --- | --- | --- |
| `head-accessory` | `headAccessory` | `beret` / `halo` / `crown` / `none`; uses underlying `head` equipment, initially empty |
| `head-color` | `headColor` | `#RRGGBB`; preserves existing head equipment color; new equipment uses the preset default |
| `eyes-accessory` | `eyesAccessory` | `glasses` / `sunglasses` / `none`; uses underlying `eyes` equipment, initially empty |
| `eyes-color` | `eyesColor` | `#RRGGBB`; preserves existing eye equipment color; new equipment uses the preset default |
| `mouth-accessory` | `mouthAccessory` | `moustache` / `goatee` / `none`; uses underlying `mouth` equipment, initially empty |
| `mouth-color` | `mouthColor` | `#RRGGBB`; preserves existing mouth equipment color; new equipment uses the preset default |
| `neck-accessory` | `neckAccessory` | `bowTie` / `scarf` / `necklace` / `none`; uses underlying `neck` equipment, initially empty |
| `neck-color` | `neckColor` | `#RRGGBB`; preserves existing neck equipment color; new equipment uses the preset default |
| `left-ear-accessory` | `leftEarAccessory` | `earring` / `starEarring` / `none`; uses underlying `leftEar` equipment, initially empty |
| `left-ear-color` | `leftEarColor` | `#RRGGBB`; preserves existing left-ear equipment color; new equipment uses the preset default |
| `right-ear-accessory` | `rightEarAccessory` | `earring` / `starEarring` / `none`; uses underlying `rightEar` equipment, initially empty |
| `right-ear-color` | `rightEarColor` | `#RRGGBB`; preserves existing right-ear equipment color; new equipment uses the preset default |

Preset default colors: beret/bow tie/scarf `#b84742`; halo/ring earring `#f7cc5b`; glasses/sunglasses/moustache/goatee `#31323d`; crown `#e5ad35`; necklace `#9b6c2a`; star earring `#a66a22`.

`eye-color`/`eyeColor` colors **the eyes themselves**; `eyes-color`/`eyesColor` colors **eye-slot equipment such as glasses**. You can specify a color before equipping an empty slot. Removing a slot choice may reveal equipment from underlying `accessories`/`design`, so removal differs from `none`. Use `accessories` JSON for custom IDs.

```html
<sidekick-avatar
  head-accessory="halo"
  eyes-accessory="glasses" eyes-color="#334155"
  mouth-accessory="moustache"
  neck-accessory="scarf"
  left-ear-accessory="earring" left-ear-color="#f7cc5b"
  right-ear-accessory="earring" right-ear-color="#a4b8c9"
></sidekick-avatar>
```

### Runtime, body orientation, and animation

| HTML attribute | React prop | React type | Allowed values / defaults |
| --- | --- | --- | --- |
| `behavior` | `behavior` | `BotBehavior \| null` | JSON string in HTML; actual object/Element in React; `null` or removal cancels; see declarative behavior below |
| `activity` | `activity` | `Activity` | `idle` / `thinking` / `listening` / `speaking` / `celebrating` / `still`; default `idle` |
| `paused` | `paused` | `boolean` | Default `false`; pause looping motion |
| `interaction` | `interaction` | `'none' \| 'box'` | Default `none`; `box` enables dragging, clicking, and keyboard input |
| `tracking-mode` | `trackingMode` | `TrackingMode` | `off`, `eyes`, `eyes-and-body` (default); track with eyes only or eyes and body |
| `mouse-tracking` | `mouseTracking` | `boolean` | Legacy eye-tracking alias; `true` → `eyes`, `false` → `off`; explicit `tracking-mode` takes precedence |
| `body-orientation` | `bodyOrientation` | `BodyOrientationPreset \| Partial<BodyOrientation>` | HTML: `front` / `three-quarter` / `side`, default `front`; React also accepts partial `{yaw,pitch,roll}` objects |
| `body-yaw` | `bodyYaw` | `number` | -360–360 degrees; bodyOrientation preset yaw, otherwise 0 |
| `body-pitch` | `bodyPitch` | `number` | -90–90 degrees; bodyOrientation preset pitch, otherwise 0 |
| `body-roll` | `bodyRoll` | `number` | -180–180 degrees; bodyOrientation preset roll, otherwise 0 |
| `zoom` | `zoom` | `number` | 0.5–3×, default 1; centered zoom; removal restores 1 |
| `gaze-x` | `gazeX` | `number` | -1–1, default 0; explicit gaze used when pointer tracking is off |
| `gaze-y` | `gazeY` | `number` | -1–1, default 0 |
| `shape-duration` | `shapeDuration` | `number` | Shape attribute transition, 0–60000ms; default 450 |
| `shape-easing` | `shapeEasing` | `MotionOptions['easing']` | `smooth` / `linear`; default `smooth` |
| `motion-duration` | `motionDuration` | `number` | Eye/pose attribute transition, 0–60000ms; default 400 |
| `motion-easing` | `motionEasing` | `MotionOptions['easing']` | `smooth` / `linear`; default `smooth` |
| `motion` | `motion` | `MotionTarget` | JSON string in HTML; initial rotation/face shift 0, shared eye openness 1, individual eyes use design weights |
| `time` | `time` | `number` | Loop animation time, 0–86400 seconds, default 0; a seek input, not a per-frame readback |

React `bodyOrientation={{ yaw: 35 }}` maps to `body-yaw`. Providing the separate `bodyYaw` prop for that axis takes precedence. Zoom uses the independent `zoom={1.4}` prop; removing it restores 1. Omitted object axes are 0 for a new element; removing previously wrapper-owned axes restores declarative defaults. Imperative `setBodyOrientation({yaw:35})` preserves current unspecified axes.

`MotionTarget` is partial: unspecified channels are preserved. All supported nested fields are listed here:

| `motion` field | Type/range | Initial value / meaning |
| --- | --- | --- |
| `body.rotation` | `[number, number, number]`, each -2π–2π radians | `[0,0,0]`, body rotation |
| `face.uv` | `[number, number]`, each -0.5–0.5 | `[0,0]`, runtime face-position offset |
| `eyes.left.weights.smile`, `eyes.right.weights.smile` | `number`, 0–1 | Each eye's design weight, initially 0 |
| `eyes.left.weights.blink`, `eyes.right.weights.blink` | `number`, 0–1 | Each eye's design weight, initially 0 |
| `eyes.openness` | `number`, 0–1 | 1, shared eye-openness limit |
| `accessories.<id>.rotation` | `[number, number, number]`, each -π–π radians | `[0,0,0]`, rotation for a currently equipped unique ID |
| `eyes.left.expression`, `eyes.right.expression` | `EyeExpression` | Legacy compatibility input; converts `neutral` / `smile` / `blink` to weights |
| `eyes.left.openness`, `eyes.right.openness` | `number`, 0–1 | Legacy compatibility input; converts to blink weight |

Combining `weights` with legacy `expression`/`openness` on one eye is an error. Use `weights` in new code. `motion={}`/`motion="{}"` specifies no new target channels and does not reset anything. Removing the `motion` prop/attribute restores the default pose according to the removal rules below. Body orientation uses **degrees**; pose rotation uses **radians**.

### React references and event props

These props are not HTML attributes. In HTML, subscribe to the DOM events below with `addEventListener()`. Callbacks receive the original `CustomEvent`, not a React SyntheticEvent, and return `void`. All callbacks default to `undefined`; omitted callbacks are not invoked.

| React prop | Type | Value/behavior |
| --- | --- | --- |
| `ref` | `React.Ref<SidekickAvatarRef>` | None by default; object or callback ref; assigned after custom-element upgrade and cleared on cleanup |
| `onBehaviorChange` | `SidekickEventHandler<'sidekick-behavior-change'>` | `CustomEvent<BehaviorState>`; behavior state and review progress |
| `onBehaviorEnd` | `SidekickEventHandler<'sidekick-behavior-end'>` | `CustomEvent<BehaviorResult>`; completion, cancellation, or runtime failure |
| `onReady` | `SidekickEventHandler<'sidekick-ready'>` | `CustomEvent<{}>`; rendering ready after props are applied |
| `onError` | `SidekickEventHandler<'sidekick-error'>` | `CustomEvent<SidekickErrorDetail>`; `message: string`, optional `attribute: string`, `value: string \| null`, `recoverable: boolean` |
| `onDesignChange` | `SidekickEventHandler<'sidekick-design-change'>` | `CustomEvent<{design: AvatarDesign}>` |
| `onBodyOrientationChange` | `SidekickEventHandler<'sidekick-body-orientation-change'>` | `CustomEvent<{bodyOrientation: BodyOrientation}>` |
| `onZoomChange` | `SidekickEventHandler<'sidekick-zoom-change'>` | `CustomEvent<{zoom: number}>` |
| `onMotionEnd` | `SidekickEventHandler<'sidekick-motion-end'>` | `CustomEvent<{finished: boolean}>` |
| `onShapeEnd` | `SidekickEventHandler<'sidekick-shape-end'>` | `CustomEvent<{finished: boolean}>` |
| `onActivate` | `SidekickEventHandler<'sidekick-activate'>` | `CustomEvent<{}>`; click or Enter/Space activation |

Other props follow `HTMLAttributes<SidekickAvatarRef>`: for example `id?: string`, `className?: string`, `style?: React.CSSProperties`, `aria-*`, `data-*`, and ordinary DOM events. The wrapper does not support `children` or `dangerouslySetInnerHTML`. `onError` is the Sidekick error callback defined above. React's `key` identifies an element; it is not an HTML attribute or Sidekick setting.

### Change, removal, and error rules

- Unlike native HTML booleans, string `"false"` is parsed too. `mouse-tracking`, `mouse-tracking=""`, `mouse-tracking="true"`, and `mouse-tracking="1"` enable tracking; `="false"` and `="0"` disable it. Removing `mouse-tracking` restores default `eyes-and-body` unless `tracking-mode` is present and takes precedence. `paused` uses the same notation and is disabled when removed. React uses `{true}`/`{false}`. React `false` explicitly disables and differs from omission. `null`, `"TRUE"`, and `"yes"` are unsupported boolean inputs.
- Invalid supported shape names, presets, JSON, numeric ranges, or color formats are errors. Unobserved arbitrary HTML attributes remain ordinary browser attributes and do not configure the library. Shorthand `#fff`, named CSS colors, `NaN`, and `Infinity` are unsupported. Remove an attribute to omit it instead of supplying an empty string.
- React `undefined`/omission and HTML `removeAttribute()` release only that input's override. Underlying `design` inputs are used when present. Use `none` to explicitly empty a slot, or `[]` to explicitly empty the equipment array.
- Attributes changed within one JavaScript task are validated/applied together in the next microtask. Invalid batches retain the previous valid runtime state and emit `sidekick-error`. The original input strings remain in the DOM; fix or remove the offending attributes.
- Initial HTML attributes apply before the first render. Once connected, `shape`, eye weights, and `motion` changes transition using their timing attributes. Changing timing alone does not restart an active transition.
- Design attributes use `design` as the base, with individual attributes overriding only their own portions. Removing an override reveals underlying declarative data or defaults. `accessories` replaces the base equipment array; slot attributes apply on top.
- Eye precedence is `design` → shared `expression` → individual expression → shared `smile`/`blink` → individual weights. Individual body axes override orientation presets. Removing `gaze-x`/`gaze-y` resets that axis to 0. Removing `motion` restores default body/face/accessory rotation and shared eye openness, with individual eyes restored to saved design weights.
- Unrelated attribute changes do not reset other values changed imperatively or other animations. Design JSON does not store body orientation, activity, pause state, pointer tracking, transition timing, or runtime pose.

```js
bot.setAttribute('shape-duration', '600');
bot.setAttribute('shape', 'heart');
bot.setAttribute('left-smile', '0.8');
await Promise.resolve(); // 같은 작업의 속성 적용 이후

bot.setAttribute('tracking-mode', 'off');
bot.removeAttribute('body-color'); // design의 색 또는 기본 색으로 복원
bot.setAttribute('head-accessory', 'none'); // design에 모자가 있어도 해제
```

## Declarative behavior

`behavior` is a deterministic API declaring what the app wants the bot to do. It uses no LLM, natural-language reasoning, or network requests. Your app determines actual loading, saving, and validation state; Sidekick composes movement and existing activities/expressions to match the declaration. `wait` does not inspect a server task, and `review` does not validate item content.

```ts
import { defineSidekick } from '@hanana-kick/sidekick/register';
import type { BotBehavior, SidekickAvatar } from '@hanana-kick/sidekick/register';

defineSidekick();
const bot = document.querySelector<SidekickAvatar>('#bot')!;
const intent: BotBehavior = { type: 'wait', target: '#results' };
bot.behavior = intent;
// 현재 행동을 교체합니다. Promise가 필요하면 perform()을 사용하세요.
const result = await bot.perform({ type: 'celebrate' });
console.log(result.status); // completed, cancelled 또는 error
bot.stopBehavior(); // bot.behavior = null 과 같은 취소
```

| Declaration | Target/timing | Behavior |
| --- | --- | --- |
| `{ type: 'wait', target }` | CSS selector or same-document `Element` | Move to the target and wait until replaced/cancelled |
| `{ type: 'follow', target }` | CSS selector or same-document `Element` | Move to the target and follow position changes until replaced/cancelled |
| `{ type: 'guide', target }` | CSS selector or same-document `Element` | Move to the target and provide guidance until replaced/cancelled |
| `{ type: 'review', targets }` | CSS selector or `readonly Element[]` | Visit the target list in order; default `dwell` at each target is 1000ms |
| `{ type: 'celebrate' }` | Default `duration` 1600ms | Complete after celebrating |
| `{ type: 'error' }` | Default `duration` 1800ms | Complete after an error indication |
| `{ type: 'idle' }` | Indefinite by default | Idle until replaced/cancelled |

- `wait`, `follow`, `guide`, and `idle` optionally accept `duration` for automatic completion. For targeted behaviors, duration starts after arrival. All times are milliseconds.
- Targeted behaviors accept `side: 'right'` (default) / `'left'` / `'above'` / `'below'`, `gap: 16` (default CSS px), and `timeout: 5000` (default ms). Speed/acceleration use existing movement settings. Parent DOM and `placement` are preserved; the bot is not reparented.
- Selectors query the document. `wait`, `follow`, and `guide` use the first matching connected element. If missing, they wait for DOM changes and end with `error` if it does not appear before `timeout`. An `Element` is also awaited until connected to the same document. Malformed selectors are input errors.
- A `review` selector snapshots the list once connected matches are first found. An explicit `Element[]` is snapshotted immediately; disconnected entries are skipped, and an empty remaining list completes immediately. Selectors follow document order; arrays preserve supplied order. Items added after the snapshot are excluded; removed items are skipped. Start a new `perform()` to reread the list.
- The `behavior` property and HTML declaration may be set before the element is added to the document; they begin after connection. Call `perform()` on a connected element; on a disconnected one it returns a `status: 'error'` result.
- A new declaration ends the previous behavior as `cancelled` and replaces it. `stopBehavior()`, `behavior = null`, removing the HTML attribute or React prop, and disconnecting the element also cancel. Supply an `AbortSignal` to `perform(declaration, { signal })` to cancel with `abort()`.
- A new command affecting behavior-owned movement, activity, or gaze releases that behavior's control. For example, calling `moveTo()` or `motion.to()` directly, or changing activity/tracking attributes, cancels the behavior and applies the new input. Cleanup from the previous behavior does not overwrite the new input.
- Invalid declarations are validated before changing the current behavior. JavaScript method/property inputs throw; HTML/React input errors surface through `sidekick-error` / `onError`. A valid `perform()` Promise resolves with `BehaviorResult` when the behavior actually ends. Runtime failures such as target timeout use `status: 'error'`; replacement/cancellation uses `status: 'cancelled'`. Check completion before starting the next step.
- `bot.behaviorState` and `sidekick-behavior-change` detail contain `{ id, type, status, itemIndex, itemCount, completedItems }`. Status is `idle`, `resolving`, `moving`, `acting`, `completed`, `cancelled`, or `error`. `itemIndex` is zero-based and -1 before target selection. End events and Promise results contain `{ id, type, status, reason?, completedItems }`.

### Waiting until real loading finishes

The target container must exist in the DOM before the request starts. The app waits for server completion, then changes to a celebration or error behavior. Do not assign an arbitrary completion duration while the request is still pending.

```ts
import { defineSidekick } from '@hanana-kick/sidekick/register';
import type { SidekickAvatar } from '@hanana-kick/sidekick/register';

defineSidekick();
const bot = document.querySelector<SidekickAvatar>('#bot')!;
const results = document.querySelector<HTMLElement>('#results')!;

export async function loadResults(): Promise<void> {
  bot.behavior = { type: 'wait', target: results, side: 'left' };
  results.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/results');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: unknown = await response.json();
    results.textContent = JSON.stringify(data, null, 2);
    await bot.perform({ type: 'celebrate' });
  } catch (error) {
    results.textContent = error instanceof Error ? error.message : String(error);
    await bot.perform({ type: 'error' });
  } finally {
    results.removeAttribute('aria-busy');
  }
}
```

### Reviewing items in sequence

`review` is the visual action of visiting each item. Handle actual validation results in separate application logic. The example does not celebrate after cancellation or when no targets exist.

```ts
import { defineSidekick } from '@hanana-kick/sidekick/register';
import type { SidekickAvatar } from '@hanana-kick/sidekick/register';

defineSidekick();
const bot = document.querySelector<SidekickAvatar>('#bot')!;
const cancel = new AbortController();
const result = await bot.perform({
  type: 'review', targets: '.review-item', side: 'left', gap: 12, dwell: 1000,
}, { signal: cancel.signal });
if (result.status === 'completed') await bot.perform({ type: 'celebrate' });
// 페이지 전환이나 취소 버튼에서는 cancel.abort() 또는 bot.stopBehavior().
```

### React: connecting app state to behavior

`behavior` is passed as an actual JavaScript property after element upgrade, not serialized to a string attribute. Element identity and array order are preserved; rerendering an inline object with identical contents does not restart the behavior. React does not query the DOM or run behaviors during SSR. Use selectors for server rendering, and supply actual `Element` objects only after obtaining them on the client. To deliberately restart a finite behavior, call `perform()` through the ref.

```tsx
'use client';
import { useState } from 'react';
import { SidekickAvatar } from '@hanana-kick/sidekick/react';
import type { BotBehavior, BehaviorState } from '@hanana-kick/sidekick/react';

type RequestStatus = 'idle' | 'loading' | 'success' | 'error';
export function ResultsCompanion({ status }: { status: RequestStatus }) {
  const [behaviorStatus, setBehaviorStatus] = useState<BehaviorState['status']>('idle');
  const behavior: BotBehavior = status === 'loading'
    ? { type: 'wait', target: '#results', side: 'left' }
    : status === 'success' ? { type: 'celebrate' }
    : status === 'error' ? { type: 'error' }
    : { type: 'idle' };
  return <>
    <section id="results" aria-busy={status === 'loading'}>검색 결과</section>
    <SidekickAvatar behavior={behavior} aria-label="결과 안내 도우미"
      onBehaviorChange={event => setBehaviorStatus(event.detail.status)}
      onBehaviorEnd={event => {
        if (event.detail.status === 'error') console.warn(event.detail.reason);
      }} />
    <output aria-live="polite">{behaviorStatus}</output>
  </>;
}
```

### HTML JSON declarations

HTML `behavior` is JSON, so targets use selector strings. Actual `Element` / `Element[]` values can only be supplied through a JavaScript property or React prop.

```html
<section id="results">결과를 기다리는 중</section>
<sidekick-avatar id="bot"
  behavior='{"type":"wait","target":"#results","side":"left"}'></sidekick-avatar>
```

```js
bot.setAttribute('behavior', JSON.stringify({ type: 'review', targets: '.review-item' }));
bot.removeAttribute('behavior'); // 실행 중인 행동 취소
bot.behavior = null; // JavaScript에서도 명시적으로 취소
```

## Pointer tracking and dragging

`tracking-mode` / `trackingMode` selects the overall tracking behavior with one value. The default is `eyes-and-body`: omitting the attribute or React prop still makes both eyes and body follow the mouse.

- `off`: no mouse tracking; return to the last explicit gaze from `lookAt()` or `gaze-x`/`gaze-y`.
- `eyes`: only the eyes follow the mouse; existing body pose and motion remain unchanged.
- `eyes-and-body`: the body turns slightly and smoothly along with the eyes. Body turning is a separate render layer added over existing motion; it does not change `pose.rotation`, the motion timeline, or body orientation.

```ts
import type { TrackingMode } from '@hanana-kick/sidekick/core';
const mode: TrackingMode = 'eyes-and-body';
bot.trackingMode = mode;
// HTML: <sidekick-avatar tracking-mode="eyes-and-body"></sidekick-avatar>
// React: <SidekickAvatar trackingMode="eyes-and-body" />
```

Legacy `mouse-tracking` / `mouseTracking` remains supported. Without a named mode, `true` means `eyes` and `false` means `off`. When both are present, `tracking-mode` always wins; removing it reveals any remaining `mouse-tracking` setting. With neither, the default is `eyes-and-body`. `bot.mouseTracking = false` leaves explicit `mouse-tracking="false"`, disabling tracking as before. Reading `bot.mouseTracking` returns `true` for either tracking mode. After using a named mode, disable it with `bot.trackingMode = 'off'`.

Tracking observes the mouse throughout the document and ignores touch/pen input. Changing modes, disabling tracking, pointer leave, or focus loss smoothly releases offsets from their current state. Listeners are removed while hidden/disconnected. Disconnection resets the invisible body layer; reconnection waits for fresh pointer input. Tracking pauses during dragging to avoid competing with body-orientation control. Reduced motion suppresses body tracking and smoothly releases existing offsets. While `paused`, body tracking freezes at its current position and eye gaze updates immediately; disabling tracking or switching to eyes-only still smoothly releases the body layer while activity/base-pose time stays paused.

`interaction` is a separate setting:

- `none` (default): the entire element passes clicks through. Pointer tracking may still be enabled.
- `box`: drag anywhere in the rectangular box to rotate body orientation; click, Enter, or Space emits `sidekick-activate`. Transparent pixels are part of the hit area too.

`paused` stops looping motion and completes active transitions at their targets. `activity="still"` disables looping activity while preserving explicit shape/eye/pose transitions. New transitions also apply immediately under `prefers-reduced-motion`.

## Design JSON and accessories

The current saved format is **v7**. Appearance consists of body `shape`/`color`, eye `color`, and accessory `id`/`preset`/`slot`/`color`. Each eye's `weights` represent expression animation state.

```ts
import {
  createDesign, createAccessory, patchDesign,
  parseDesign, serializeDesign, equipAccessory,
} from '@hanana-kick/sidekick/core';

let design = createDesign({
  body: { shape: 'puffy', color: '#8bba9c' },
  eyes: {
    color: '#24242c',
    left: { weights: { smile: 0.7, blink: 0.2 } },
    right: { weights: { smile: 0, blink: 0 } },
  },
  accessories: [
    createAccessory('beret', 'hat'),
    { ...createAccessory('glasses', 'frames'), color: '#334155' },
    createAccessory('earring', { slot: 'leftEar', id: 'left-earring' }),
    createAccessory('earring', { slot: 'rightEar', id: 'right-earring' }),
  ],
});

design = equipAccessory(design, createAccessory('halo', 'aura')); // 머리만 교체
design = patchDesign(design, { eyes: { left: { weights: { blink: 0.5 } } } });
const json = serializeDesign(design);
await bot.setDesign(parseDesign(json));
```

- `createDesign(patch)` fills defaults. Both eyes default to `{ smile: 0, blink: 0 }`, and equipment to `[]`. Only Studio adds a beret on startup.
- `patchDesign(current, patch)` deeply merges eye weights without mutating the original. Passing `accessories` replaces the entire array. `bot.updateDesign()` follows the same rules.
- One accessory per slot, six total. Beret/halo/crown share the head slot; bow tie/scarf/necklace share the neck slot. Ring/star earrings require an explicit `leftEar` or `rightEar`.
- IDs are unique lowercase-letter/digit/hyphen strings beginning with a lowercase letter, up to 40 characters. `createAccessory()` generates a default ID; specify IDs to avoid duplicates when combining accessories.
- `equipAccessory(design, item)` replaces only the item's slot. `removeAccessory(design, id)` removes only that instance. The element provides asynchronous methods with the same names.
- `parseDesign(objectOrJson)` strictly validates versions, unknown keys, numbers, colors, IDs, slots, and duplicate equipment, then returns an independent copy. JSON strings must be at most 64KiB. Validation failure throws or rejects a Promise and retains the prior design.

Each of the 35 body shapes has an authored support peak and wearing angle for the crown. Like the beret, its hollow opening accommodates the body, but the metal crown mesh is never bent or stretched per axis. Only position, rotation, and uniform scale change; shape transitions preserve the same rigid form. Natural gaps may remain where a rounded body meets the rigid ring.

Supply compound HTML data as a valid JSON string.

```html
<sidekick-avatar
  shape="clover4Leaf"
  accessories='[{"id":"frames","preset":"glasses","slot":"eyes","color":"#334155"}]'
  left-smile="0.7"
  right-blink="0.4"
></sidekick-avatar>
```

Body size/depth/deformation/`profiles`, eye width/height/spacing/position/`targets`, and accessory size/mounting/follow settings are not public appearance parameters. They are rejected in v7 JSON. Shape-specific proportions and mounting positions are handled internally; runtime pose motion is provided separately.

### Scene JSON files

Studio JSON files and code examples use a `sceneVersion: 3` envelope combining the current design with runtime settings. This is a separate version from `design.version: 7`. The filename is `sidekick.scene.json`; earlier design-only files can also be imported.

```ts
import { createScene, parseScene, serializeScene, migrateScene } from '@hanana-kick/sidekick/core';

const scene = createScene({
  design,
  bodyOrientation: { yaw: 35, pitch: 12 },
  zoom: 1.5,
  trackingMode: 'eyes-and-body',
  activity: 'thinking',
  interaction: 'box',
  shapeDuration: 600,
});
const json = serializeScene(scene);
const checked = parseScene(json);
const { scene: imported, warnings, legacyDesign } = migrateScene(oldOrSceneJson);
```

`createScene()` defaults to `eyes-and-body` tracking and fills `design`, `bodyOrientation: {yaw,pitch,roll}`, independent `zoom`, `activity`, `paused`, `trackingMode`, `interaction`, `renderStyle`, `gaze: {x,y}`, `time`, `motion`, `shapeDuration`, `shapeEasing`, `motionDuration`, and `motionEasing` with defaults. `parseScene()` strictly validates a complete `sceneVersion: 3` envelope. Earlier scene versions and `camera`/`view` setting keys are unsupported and not automatically converted. Rewrite them with the new keys or reset in Studio. Arbitrary geometry, unknown keys, invalid equipment-ID motion, and unsupported versions are rejected. `migrateScene()` can add default runtime settings to design-only files.

Studio import/reset calls `resetTracking()` to immediately clear previous live tracking offsets so they do not leak into the new scene. Ordinary mode changes retain the smooth return described above.

Scenes reproduce **configured targets and time values**. They do not record the exact intermediate animation frame, automatic blink phase, live mouse coordinates, or browser background. With pointer tracking enabled, the imported page follows its own mouse input. `motion` is a runtime target separate from the saved design.

Studio's Open JSON file and Apply JSON text actions validate all data before applying it atomically. Maximum size is 64KiB (UTF-8). Failure preserves the current design, body orientation, ongoing animations, and local storage. Selecting files repeatedly applies only the latest selection; reset, direct edits, and unmount cancel pending file reads. Scene files also restore body orientation, tracking, activity, pause, time, and pose targets; legacy design files reset preview settings to defaults.

### Importing earlier files

`parseDesign()` also validates v1–v6 and converts them to v7. Use `{ design, warnings }` from `migrateDesign(input)` when you need migration notices. The old `face` slot becomes `eyes`, preserving IDs, colors, and expressions. Earlier custom bodies are approximated by the closest catalog contour; removed geometry fields are validated before discarding. This does not exactly reconstruct the original appearance. Unknown keys, invalid geometry, and duplicate slots are rejected rather than silently dropped.

v1 `capsule`/`round` eyes become neutral, and `arc` becomes smiling. v2/v3 `expression`/`openness` becomes smile/blink weights; v4–v6 weights are retained. v6 equipment accepts only the existing `beret`, `halo`, `glasses`, and `head`/`face` slots. Use v7 for new equipment and six slots.

## Animation and imperative APIs

### Shapes and expressions

```ts
const first = bot.setShape('puffy'); // 450ms, smooth
const next = bot.setShape('pixelTriangle', { duration: 650, easing: 'linear' });
console.log(await first); // { finished: false }: 새 목표로 대체
console.log(await next);  // { finished: true }

await bot.setEyeWeights('left', { smile: 0.85 }, { duration: 300 });
await bot.setEyeWeights('right', { blink: 0.4 }, { duration: 180 });
await bot.setExpression('both', 'neutral');
```

Transitions between the 35 shapes continue from the currently visible contour toward the next target. The target name is stored immediately in `design.body.shape`; intermediate morph geometry is not put into JSON. Color/equipment edits preserve active shape transitions. The element's JavaScript `design` property and `setDesign()` apply shape changes immediately. HTML `design` and React `design` changes use `shape-duration`/`shapeDuration`. Reduced motion, pause, or a disconnected element applies transitions immediately.

Eye `smile` and `blink` each range from 0 to 1; their sum is not normalized to 1. `left` is model -X, screen-left in the front view; `right` is +X. Partial weight updates preserve omitted values and the other eye. Presets are exactly `neutral → {smile:0,blink:0}`, `smile → {smile:1,blink:0}`, and `blink → {smile:0,blink:1}`. `blink` holds the eyes closed; send `neutral` or new weights to reopen them.

Imperative transition defaults are 450ms for `setShape()`, 400ms for `setEyeWeights()`/`motion.to()`, and 90ms blink / 180ms neutral / 280ms smile for `setExpression()`. Explicit `options` take precedence; `duration` is 0–60000ms, and `easing` is `smooth` or `linear`. HTML timing attributes configure declarative attribute transitions.

### Body orientation and pose

```ts
bot.setBodyOrientation({ yaw: 35, pitch: 12, roll: -5 }); // 도(degree)
bot.setBodyOrientationPreset('three-quarter'); // yaw 45°, pitch/roll 0°
bot.zoom = 1.5;          // 중앙 기준 150% 확대
bot.setBodyOrientationPreset('front'); // 방향만 초기화, 확대 유지
bot.zoom = 1;                       // 확대 별도 초기화
bot.trackingMode = 'off';
bot.lookAt({ space: 'view', x: 0.6, y: 0.2 });

// 포즈 회전은 라디안. 아래 예제는 id 'hat' 장비가 있을 때 사용합니다.
await bot.motion.to({
  body: { rotation: [0, 0, 0.2] },
  face: { uv: [0.2, 0.1] },
  eyes: { left: { weights: { smile: 0.5, blink: 0.2 } } },
  accessories: { hat: { rotation: [0, 0.2, 0] } },
}, { duration: 500, easing: 'smooth' });
```

`BodyOrientation` contains only `{yaw, pitch, roll}` angles in degrees. `createBodyOrientation()` initializes all axes to 0. `setBodyOrientation()` changes only specified axes, and `setBodyOrientationPreset()` preserves zoom. `zoom` is independent, defaults to 1, and accepts 0.5–3. The core also provides `createZoom()` and `ZOOM_RANGE`. Scene JSON separately stores `bodyOrientation` and `zoom` in `sceneVersion: 3`; design JSON contains neither. No legacy `camera`/`view` API, attribute, prop, or event aliases are provided.

In an `interaction="box"` preview, single-finger/mouse dragging rotates; the wheel/trackpad (including pinch-generated Ctrl+wheel) and two-finger pinching zoom about the center. Pixel/line/page wheel units are normalized and applied multiplicatively. Moving the pinch center does not pan. Settings-panel scrolling remains unchanged; `interaction="none"` disables rotation/zoom input. Shape/body/eye animations continue while zooming; pointer tracking returns to neutral and resumes on fresh pointer movement.

At high zoom, the avatar or accessories may be clipped by the canvas. PNG export saves only the pixels visible at the current zoom; reset or reduce zoom to export the full figure. Zoom affects only the renderer's orthographic projection, preserving model dimensions and aspect ratio.


Body orientation describes where the character faces within a fixed view. `front` is yaw 0°, `three-quarter` 45°, and `side` 90°; each preset has pitch/roll 0°. Positive yaw turns the front toward screen-right, positive pitch downward, and positive roll counterclockwise on screen. Body orientation does not alter the saved design or base pose.

`MotionTarget` accepts three body-rotation axes (each -2π–2π), two face UV axes (each -0.5–0.5), individual eye weights, the shared `eyes.openness` limit (0–1), and three rotation axes per equipped ID (each -π–π). Shared openness is a compatibility runtime limit, not a separate saved expression. Pose motion does not modify design JSON.

Body, face, left/right eyes, shared openness, and each accessory have independent timelines. Controlling one channel does not restart unrelated channels. Interrupted requests finish with `{ finished: false }`; completed requests with `{ finished: true }`. Frame loops stop offscreen or in inactive tabs.

| Element API | Purpose |
| --- | --- |
| `design`, `setDesign(designOrJson)` | Read/replace the entire design; the `design` getter returns a copy |
| `updateDesign(patch)` | Partially update appearance/eye weights |
| `equipAccessory(item)`, `removeAccessory(id)` | Replace a slot/remove an instance |
| `setShape(name, options)` | Save and transition to a shape target |
| `setEyeWeights(side, weights, options)` | Save and transition partial weights for either/both eyes |
| `setExpression(side, preset, options)` | Save and transition an expression preset |
| `setActivity(name)`, `activity` | Set/read the activity |
| `resetTracking()` | Immediately clear live pointer gaze/body offsets and restore the last manual gaze; preserve mode/base pose/body orientation |
| `trackingMode`, `mouseTracking`, `paused`, `interaction`, `renderStyle` | Read/set the corresponding behavior |
| `lookAt({space:'view',x,y})` | Explicit gaze in the -1–1 range |
| `bodyOrientation`, `setBodyOrientation(patch)` | Read/partially set `BodyOrientation` in degrees; getter returns a copy |
| `setBodyOrientationPreset(name)` | Front/three-quarter/side preset, preserving zoom |
| `zoom` | Read/set independent zoom, 0.5–3, default 1 |
| `motion.to(target,options)`, `motion.cancel()` | Transition pose/cancel all pose channels |
| `seek(seconds)` | Set looping animation time, 0–86400 seconds |
| `pose` | Read-only copy of the latest pose acknowledged by the render engine; asynchronously updated in worker mode |
| `snapshot({crop,padding}?)` | Transparent PNG `Promise<Blob>` after render readiness; alpha-bounds cropping by default |
| `capturePixels()` | Synchronously read the last displayed full canvas; does not wait for the latest worker commands |
| `capturePixelsAsync()` | `Promise<{width,height,pixels}>` waiting for a fresh frame after the latest commands; bottom-up RGBA |
| `ready`, `diagnostics` | Readiness, `worker`/`main` backend, generation/command acknowledgments, animation time, frames/draw calls/buffers |

## OffscreenCanvas and rendering

Supported browsers transfer the element's canvas to a dedicated Web Worker through `transferControlToOffscreen()`. Meshes, motion/shape transitions, gaze springs, and WebGL rendering run in the worker. The main thread handles DOM, accessibility, input, size observation, and command delivery. Check `bot.diagnostics.backend` for the actual `worker` or `main` execution path.

For same-origin self-hosting, serve the worker file with a correct JavaScript MIME type. Browser security does not permit a direct cross-origin Worker URL. CSP must allow that worker, for example through `worker-src 'self'`; this same-origin setup needs no Blob worker or special security headers. Cross-origin CDN usage instead uses the Blob module-worker bootstrap described above. Unsupported features, CSP/file-loading failures, or worker initialization failures replace the internal canvas and recover through the main-thread renderer.

Design/body-orientation settings and validation apply immediately, while worker poses/pixels arrive asynchronously. For an exact frame after a command, use `await bot.capturePixelsAsync()` or `await bot.snapshot()`. PNG export waits for a fresh render frame. Disconnection disposes the worker, GPU resources, and input listeners; reconnection starts a new rendering generation.

For browser contracts, see [OffscreenCanvas transfer](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen) and [CSP worker-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src). A canvas already transferred or with a created context cannot be transferred again, so recovery replaces the internal canvas. The host element and React ref remain intact.


## Events and cleanup

Events are `CustomEvent` objects that bubble across Shadow DOM boundaries. The React wrapper passes the same event objects to callbacks.

| DOM event | React callback | `detail` |
| --- | --- | --- |
| `sidekick-behavior-change` | `onBehaviorChange` | `BehaviorState`: id, type, status, itemIndex, itemCount, completedItems |
| `sidekick-behavior-end` | `onBehaviorEnd` | `BehaviorResult`: id, type, status, reason?, completedItems |
| `sidekick-ready` | `onReady` | `{}` |
| `sidekick-error` | `onError` | `{ message, ... }`; `recoverable: true` for recoverable context loss |
| `sidekick-design-change` | `onDesignChange` | `{ design }` |
| `sidekick-body-orientation-change` | `onBodyOrientationChange` | `{ bodyOrientation }` |
| `sidekick-zoom-change` | `onZoomChange` | `{ zoom }` |
| `sidekick-motion-end` | `onMotionEnd` | `{ finished }` |
| `sidekick-shape-end` | `onShapeEnd` | `{ finished }` |
| `sidekick-activate` | `onActivate` | `{}` |
| `sidekick-move-progress` | `onMoveProgress` | `MovementState`: phase, progress, position, velocity, acceleration, speed |
| `sidekick-move-end` | `onMoveEnd` | `{ finished, position: { x, y } }` |
| `sidekick-play-end` | `onPlayEnd` | `{ finished }` |
| `sidekick-transition-end` | `onAssetTransitionEnd` | `{ finished }` |

PNG defaults `crop: true`, `padding: 0` crop to all opaque/translucent character pixels, including equipment, while preserving transparency. `padding` is an integer from 0 to 4096 pixels; use `snapshot({ crop: false })` to retain the original canvas size. An entirely empty frame returns transparent 1×1px plus optional padding. Read exact latest pixels with `await capturePixelsAsync()`; synchronous `capturePixels()` reads only the most recently displayed worker frame. Both retain full canvas dimensions. `/core` also provides `alphaBounds()` and `cropPixels()`.

To receive initial ready/error events, attach listeners before inserting the element into the document, or use React callbacks. For an already-connected element, check `ready` first. Handle Promise errors from methods such as `setDesign()` with `try/catch` too.

```js
const bot = document.createElement('sidekick-avatar');
const events = new AbortController();
bot.addEventListener('sidekick-error', event => {
  console.error(event.detail.message);
}, { signal: events.signal });
document.body.append(bot);

// 화면/페이지 정리 시:
events.abort(); // 애플리케이션이 붙인 리스너 제거
bot.remove();   // RAF, 관찰자, 마우스 리스너, WebGL 자원 해제
```

On unmount, React cleans up wrapper listeners and the element. Revoke manually created PNG download Object URLs with `URL.revokeObjectURL()` after use. Reconnecting recreates the renderer with the saved design; ongoing transitions are cancelled. WebGL context loss emits an error, and restoration reinitializes the renderer.

## SSR and browser support

On the server, create and serialize designs with `/core`. Module imports themselves do not require DOM globals, but actual Custom Element registration, construction, and WebGL rendering must happen in the browser. During SSR the React wrapper creates an empty host with ordinary HTML/aria/style only, then registers and applies props on the client. Do not assume SSR produces configured character pixels or design attributes. The ref becomes available after upgrade; `onReady` follows prop application. Put a `'use client'` boundary on Next.js components using the React wrapper. There is no server PNG-generation API.

Default tags in server HTML upgrade after browser registration. Keep the same DOM instance and a fixed CSS size to reduce layout shift while loading. When server-rendering HTML directly, initial attributes are strings/JSON, not DOM-property assignments. See [React Custom HTML Elements guidance](https://react.dev/reference/react-dom/components#custom-html-elements).

A modern browser supporting WebGL2 and Custom Elements is required. Graphics initialization failure displays a readable fallback inside the element and emits `sidekick-error`. The element has an image role by default, or a keyboard-activatable button role with `interaction="box"`. Supply an `aria-label` describing its purpose. Offscreen/inactive-tab suspension, reduced motion, resizing, and GPU cleanup on removal are handled.

## Studio and development

The global Guide selector chooses Custom Element or React for examples and parameter names. Bot state pages include settable fields, accepted values, defaults, a live preview and its complete source. Enable a field to override it; disabled fields retain the Studio scene. Preview changes do not overwrite saved Studio values.

Studio is a separate editor built with **React 19, Vite 8, Tailwind CSS 4, and actual shadcn/ui Radix/Nova components**, using Slate color tokens. Sites consuming the core do not receive these UI dependencies. The following commands are for source development and require Node.js 22.22.2 or newer.

```sh
npm ci
npm run dev
# http://127.0.0.1:5173

npm run build:library   # 패키지 모듈/타입과 dist/browser의 prebuilt 번들 생성
npm run check:library   # 소스와 체크인된 산출물 일치 검사
npm run build:studio    # Vite 편집기 빌드
npm run build:all       # 라이브러리 + dist/src + 편집기 + 고지
npm start              # 빌드한 편집기 제공
npm run pack:library   # 라이브러리 재빌드 후 tarball 생성
npm run pack:release   # 커밋된 깨끗한 checkout에서 release/에 ZIP·tarball·SHA256SUMS 생성
```

Use `HOST=0.0.0.0` only when external access is needed; change the port with `PORT`. Static Studio deployment uses the complete `dist/` directory. Builds generate root `dist/index.html`, compatible `dist/playground/index.html`, and hashed `dist/assets/`. The npm package contains `dist/library/` and `dist/browser/` rather than Studio output. Consumers do not need these development build commands. `pack:release` requires a clean checkout with changes/prebuilt outputs committed and the system `zip` command; it does not automatically publish a GitHub Release.

### Studio features

- Appearance: 35 silhouette tiles with search/keyboard navigation, body/eye colors, 12 equipment presets with actual-render thumbnails, and per-slot colors
- Animation: activity/pause, off/eyes-only/eyes-and-body tracking, explicit gaze, shape transition duration/easing, and individual smile/blink weights
- Body orientation: yaw/pitch/roll, front/three-quarter/side presets, synchronized bidirectionally with preview dragging
- JSON: file/text import/export, HTML/React code reflecting current settings with copy buttons, and transparent alpha-cropped PNG export

Desktop places preview and settings side by side. Portrait mobile fixes the preview and scrolls only settings below; short landscape screens use a side-by-side layout. The layout uses `100dvh` and safe-area insets. Tabs, sliders, and toggles retain shadcn/Radix keyboard behavior. Fonts are bundled locally. Checkerboard/light/dark preview backgrounds are DOM backgrounds and are not included in PNGs.

Automatic saving stores the complete scene in this browser's `sidekick.studio.scene.v3`: design, body orientation, zoom, gaze, activity, tracking, time, interaction, motion, pause, and transition settings. Host-page placement, movement coordinates, and active behaviors are excluded. File export uses the same scene envelope. Earlier `sidekick.design.v7` design data remains a fallback; without v7, v6 through v1 are checked in order and migrated while preserving original keys. Invalid originals open in the JSON tab; saving edits requires a successful `.recovery` backup first. If storage is blocked, use JSON export. Reset restores the default square with beret, front body orientation, and eyes-and-body tracking. API playground and Guide experiments do not overwrite the saved Studio scene.

UI configuration lives in `components.json` and `playground/components/ui/`; persistence, commands, and recovery live in `studio-controller.ts`. React rerenders and tab changes preserve one stable element without resetting ongoing morphs or body orientation. The actual component source was generated using the [official shadcn/ui Vite setup](https://ui.shadcn.com/docs/installation/vite).

### Deploying to GitHub Pages

The public repository's Actions-based Pages address is [hanana-kick.github.io/sidekick/](https://hanana-kick.github.io/sidekick/). `.github/workflows/pages.yml` manually updates the existing public Studio. Select a CI-passing commit and **explicitly approve `approve_public_deployment` when dispatching** to build/deploy. Merely pushing a commit or adding the workflow does not deploy.

The workflow uses `actions/configure-pages` only to read existing configuration; it does not enable Pages or change domains, visibility, or security settings. Vite's default base is `./`, so **the same `dist/` produced by `npm run build:all`** works at a custom domain's `/` and GitHub Pages' `/sidekick/`. `index.html`, `playground/`, and `playground/index.html` entries are supported at both locations, loading scripts, styles, fonts, equipment thumbnails, and favicon from that deployment. Home links and computed thumbnail URLs resolve relative to the built module location rather than document depth.

For deployment to one fixed path, explicitly override with `SIDEKICK_BASE=/my-path/ npm run build:all` and serve the output at that path. The manual Pages workflow does not change base according to a custom domain's `base_path`. `node --test tests/pages-build.test.mjs` checks root/subpath asset references in the same default build; `npm run test:browser` checks actual rendering/interactions. After deployment, the `verify` job opens the live project URL in Chromium and saves screenshots as Actions artifacts. Check both deployment and verification results for the chosen commit.

### Tests

```sh
npm run typecheck
npm test
npm run test:studio
npm run check:library
npm run test:package

# 허용된 Chromium 환경에서만 실행:
node node_modules/playwright-core/cli.js install --with-deps chromium
npm run test:browser
# Linux 소프트웨어 GPU / headed 환경:
SIDEKICK_HEADED=1 xvfb-run -a npm run test:browser
```

Unit tests cover minimal designs, strict migration, attribute validation, morphs, motion, geometry, and server imports. Studio tests exercise real Radix interactions and mocked renderer boundaries in ReactDOM/jsdom; they do not replace layout/WebGL validation. Package tests check installed artifacts, public entry points, and React contracts.

Browser tests cover WebGL, transparency, animation, equipment, mobile layout, lifecycle, and fallback on an actual HTTP origin. Set `CHROMIUM_PATH` for the executable and `SIDEKICK_SCREENSHOTS=artifacts` for screenshots. In network-blocked QA, `SIDEKICK_OFFLINE_BROWSER=1` serves actual build files for `http://sidekick.test` requests and also tests local storage/reloading. Safari/Firefox and real mobile GPU testing are separate. The existence of a test command does not mean it passed in a particular environment.

### Performance checks and operation

- An unchanged static scene draws no frames. Offscreen/hidden-document animations stop; disconnecting disposes workers and GPU buffers.
- Idle breathing without other motion/gaze movement draws at most 30 times per second. The animation clock continues; automatic blinking, shape transitions, explicit motion, and tracking movement are not subject to this cap. Settings changes and PNG/pixel capture immediately request a new frame.
- Inputs and resizing are coalesced per frame. Color/gaze/body-orientation changes reuse existing meshes, and redundant vertex uploads during body changes are eliminated.
- Complex morphs with multiple accessories still incur CPU cost inside a worker. On small devices, connect only needed elements and use `activity="still"` for static displays. `paused` is a separate action that immediately completes animations.
- `diagnostics.renderCpu` measures CPU time inside actual render calls, not GPU completion time or FPS. `backend`, `running`, `frames`, and `buffers` help verify execution location, suspension, and disposal.
- Development benchmark: `node --expose-gc scripts/profile-renderer.mjs artifacts/cpu.json`. It emits ES2022 JavaScript into a temporary directory and measures actual geometry CPU time and buffer uploads/allocations. GPU commands are counting stubs, not GPU-time or browser-FPS measurements. Real Chromium worker/main paths, 6× CPU throttling, 1/2/4 instances, wide screens, and DPR are included in `npm run test:browser`. CI SwiftShader/CPU-throttling results do not guarantee FPS on real ultra-low-end devices.

## Shape, rendering scope, and licenses

Build shape-selection UIs with `MATERIAL_SHAPE_NAMES`, `MATERIAL_SHAPE_LABELS`, and `MaterialShapeName`.

- Geometric: `circle`, `square`, `slanted`, `arch`, `fan`, `arrow`, `semiCircle`, `oval`, `pill`, `triangle`, `diamond`, `clamShell`, `pentagon`, `gem`
- Stars/sunbursts/cookies: `verySunny`, `sunny`, `cookie4Sided`, `cookie6Sided`, `cookie7Sided`, `cookie9Sided`, `cookie12Sided`, `burst`, `softBurst`, `boom`, `softBoom`
- Organic/other: `ghostish`, `clover4Leaf`, `clover8Leaf`, `flower`, `puffy`, `puffyDiamond`, `pixelCircle`, `pixelTriangle`, `bun`, `heart`

`star` is not an API name. Official curve data preserves aspect ratios, concavities, corners, smoothing, rotations, and repetition. Bodies retain catalog XY contours while forming rounded front-to-back volumes. Flat means unlit solid-color rendering, not flat geometry. Actual body rotation, depth occlusion, and transparent alpha are used.

Eyes are capsule/curve color masks in the body-surface shader, not protruding meshes. They project with body tilt and are not drawn outside the body, on the back, or in occluded areas. Even an exact side view may show part of the nearer eye on the rounded front. Eye proportions, spacing, and placement are internal defaults interpolated with the shape. Expressions do not change body silhouette/alpha coverage. Face movement and gaze are independent; face equipment such as glasses follows face movement only.

Accessories use internal shape-specific mounting rules. Glasses have a single planar rigid front. A beret's opening/cuff wraps the actual upper-body cross-section, allowing part of the top inside the opaque hat; on a heart it wraps one broad lobe. The crown's lower band fits its support surface. The scarf combines a closed cloth band around the lower front/sides/back and two hanging ends connected to a knot; the broad band follows body cross-sections at each height. Equipment stays visible during shape transitions. Public accessory rotation remains supported; the beret refits its opening/support in the current rotated wearing coordinates. It follows body rotation/breathing without separately applying delayed inertial wobble to an already-fitted hat. This is shape-specific modeling, not real-time cloth physics. Body meshes and surface queries use the same volume function `h = sqrt(d / (d + 0.65 × r²))`, with front/back height `±depth × h / 2`. Height is zero on the XY contour and total central depth is `depth`. This is Sidekick's volume model, not a reproduction of an AndroidX 3D model.

Curve-to-polyline tolerance is `0.00005` in normalized `[-1,1]` coordinates. Mesh subdivision targets (surface distance `0.010`, midpoint height `0.006`) are sampled criteria, not error guarantees for every point/pixel. With up to eight subdivision passes and 12,000 front-face vertices, small triangle-approximation errors may remain visible. Morph correspondences use Sidekick's algorithm, not guaranteed pixel parity with Android Material `Morph`.

Each element uses one WebGL context and reusable buffers. Default body plus beret uses three draw calls; eyes add none. DPR is capped at 2; if the longer axis exceeds 2048px, both axes are scaled equally. Character proportions remain stable in wide/tall hosts. CPU geometry benchmarks do not guarantee GPU frame times/FPS. Arbitrary SVG, custom meshes, part plugins, cloth physics, pixel hit-testing, context pooling, and AI-service integration are outside scope.

The repository package license is `UNLICENSED`. This does not grant a public open-source license; confirm usage/distribution rights with the repository owner. Preserve the following third-party notices separately:

- Material contours: pinned [AndroidX MaterialShapes source](https://github.com/androidx/androidx/blob/9a589fa61f8661e0cbef9123dcc98d3c1f655fc7/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt), calculated with `graphics-shapes-android:1.1.0`. Apache 2.0 notice/attribution: [`third_party/material-shapes/`](third_party/material-shapes/). Regeneration uses `scripts/generate-material-shapes.mjs`; only this task requires Java 21+, unzip, and network access.
- Studio shadcn/ui source: [`playground/components/ui/LICENSE.md`](playground/components/ui/LICENSE.md). The static Studio build includes this notice too.

### Version history and ongoing improvements

0.2.2 added a scarf wrapping the front, sides, and back with freely hanging ends. Reduced duplicate body-mesh allocations/queries produced byte-identical results across 322 meshes and 12 native renders. Isolated CPU ABBA tests reduced total body computation by approximately 7.9%, but tail latency did not improve consistently. This is not a browser-FPS or all-device performance guarantee. OffscreenCanvas, tracking modes, aspect-ratio correction, wheel/pinch zoom, and default `#FFCC37` color remain.

0.2.4 uses small, tilted, shape-specific beret placements: one heart peak, or an inner support point on pointed bodies, with asymmetric drape. Folded rim and crown connect continuously; the scarf uses broad cloth around per-height cross-sections and twisted hanging excess. Accessories stay visible through shape transitions. During some intermediate complex protrusion changes, the body may occlude parts of the scarf band. Beret rim/crown deform locally relative to the heart's appropriate size, rather than stretching over the whole body. Scarves wrap an appropriate lower support area and hang downward. Fits are cached and refreshed when body shape/state changes; this does not guarantee arbitrary morph cost or low-end GPU FPS.

0.2.5 added thick beret lining connected to the opening rim. It reduced low-angle gaps while retaining a head opening, but lining intersections and placement discontinuities on some shapes/animations led to the 0.2.6 reconstruction. Exposed cuff joins on shapes including arch, square, and flower were also adjusted. Scarf geometry matches 0.2.4. Extreme gaze now moves both eyes as a pair, fixing one eye stopping independently and collapsing spacing.


Beret angle/animation regression checks live in [`scripts/beret-qa/`](scripts/beret-qa/README.md). They combine GLES diagnostics using production vertex shaders/matrices with triangle self-intersection, body penetration, normal, and opening-structure checks. The test documentation specifies angle-grid/time-sample coverage. Finite tests are not guarantees for all continuous angles or arbitrary inputs.

0.2.6 connects beret lining, opening, cuff, and crown into a thick structure, positioning the body's support area inside its hollow cavity. It wraps a heart peak; when both opening edges cannot fit, as on a flower, cloth drapes naturally from support. Shape-specific placement, tilt, and deformation limits interpolate, and breathing applies the body's deformation. Free-edge curling temporarily relaxes during transitions; actual triangle penetration is tested separately. Some intermediate frames may widen the opening or quickly regain wearing depth. Reports document finite angle/time coverage and remaining small fit changes. Scarf and gaze behavior remain unchanged.

### Studio scene editor and social cards

The **Scene** tab composes the native character and editable text onto a fixed-size canvas. The **Character / Scene** preview switch keeps the character mounted; appearance, body orientation, and zoom controls continue to update the composition. Scene previews are still frames. Use **New frame** to capture the current animation frame.

- Canvas presets: OG 1200 × 630, square 1080 × 1080, wide 1920 × 1080; custom integer dimensions 320–4096, up to 8 megapixels.
- Background color, character center X/Y and height, multiline text, text position, and font size/family/color. Drag the character or text directly in the scene preview; sliders remain available for precise placement.
- **Apply Sidekick OG preset** explicitly replaces the current avatar with a smiling yellow Ghostish wearing glasses, a beret, and a bow tie, with a white background and “Sidekick” text.
- **Save scene PNG** exports the entire canvas at the selected dimensions. The existing header **Save PNG** exports the transparent, alpha-cropped character.
- **Save/open scene JSON** round-trips `{ compositionVersion: 1, composition, avatar }`. The nested `avatar` is the existing `SidekickScene`; legacy character scene and design JSON can also be opened with default composition placement. Existing character JSON/API exports remain unchanged.
- Composition positions are canvas percentages. `characterHeight` is the cropped character height as a percentage of the canvas. Text X is its left edge; Y is the center of its multiline block. Exports deliberately clip content outside the canvas.
- Scene PNG export creates a temporary independent 2048 × 2048 native renderer, captures the configured character at its saved scene time, and disposes it afterwards. It does not enlarge the low-resolution preview or resize the active character canvas. The normal renderer's 2048-pixel ceiling remains; very large compositions may still enlarge the resulting crop. Live pointer reaction is excluded from deterministic exports. The published OG asset is managed separately.

HTML entry pages include static Open Graph and Twitter card tags with the canonical URL `https://sidekick.hananakick.cc/` and a versioned absolute social-image URL. `public/og-sidekick.png` (1200 × 630) is the exact owner-selected image, preserved independently of later geometry changes. Builds and `node scripts/generate-og-image.mjs` do not overwrite it. That development-only script updates `public/og-avatar.png` using the native production renderer and requires a C compiler, EGL/GLES, and Pillow/fontTools. Optional `SIDEKICK_RENDERER_ROOT` selects a source worktree. Studio's editable scene preset is a separate starting point, not a reconstruction of the selected static social image.

## Rendering and movement standard (v0.3)

The standard is **a character-sized transparent canvas plus DOM-element movement**. No fullscreen WebGL canvas is created. An OffscreenCanvas worker renders the small surface while the main thread moves the element using CSS `translate`. DOM movement does not change WebGL resolution, body-orientation settings, or saved body design. Default flight is composed as a runtime pose inside the small canvas. Screen-size/DPR changes retain the existing ResizeObserver and resolution limits.

Try movement, cancellation, playback, and asset transitions in the [movement/animation API playground](https://sidekick.hananakick.cc/api-playground.html).

- `placement="inline"` (default) preserves document flow. x/y are offsets from the original layout position and do not displace other content. Viewport bounds do not apply in this mode.
- `placement="viewport"` uses `position: fixed`; x/y are CSS pixels from the layout viewport's top-left. The anchor is **the canvas box's top-left**, not the character's feet or center. Its screen position remains stable during scrolling.
- Default `movement-bounds="viewport"` constrains the entire element box to the screen. If larger than the viewport, its top-left is fixed at 0. Use `none` to permit offscreen movement. Movement bounds do not restore accessories already clipped inside the canvas by zoom/orientation.
- Changes to viewport/element size reclamp current position and the remaining target. `position` returns actual clamped coordinates; input attributes retain requested coordinates.
- Place viewport elements directly under `body` or an untransformed overlay container. Ancestor CSS `transform`, `filter`, `perspective`, or certain `contain` values may change the fixed-position containing block. The library never secretly reparents React-owned DOM.
- The API owns the individual CSS `translate` property. It does not overwrite `style.transform`, but bounds do not account for additional rotation/scaling/user translation. Manage custom transforms on a separate wrapper.
- Default `interaction="none"` passes clicks, scrolling, and touch through while allowing global gaze tracking. `box` accepts dragging/zoom **only inside the small canvas box**. Alpha hit-testing that passes through only transparent pixels is not provided.
- Character scene JSON excludes host-page placement/movement coordinates. Store `position` separately in app layout state. Explicit saved colors are preserved; new characters default to body color `#FFCC37`.

### Declarative HTML / React placement

| HTML attribute | React prop | Meaning / default |
| --- | --- | --- |
| `placement` | `placement` | `inline` default / `viewport` fixed overlay |
| `position-x` | `positionX` | CSS px x coordinate, default `0` |
| `position-y` | `positionY` | CSS px y coordinate, default `0` |
| `movement-bounds` | `movementBounds` | `viewport` default / `none`; not applied to inline |
| `move-duration` | `moveDuration` | 0–60000ms, default `0` (immediate); positive values ignored for natural, exact movement time for none |
| `move-easing` | `moveEasing` | `smooth` default / `linear`; applies only to `none` |
| `move-travel` | `moveTravel` | `natural` default: inertial acceleration/flight/braking; `none`: time-based DOM interpolation |
| `move-max-speed` | `moveMaxSpeed` | Natural maximum speed, CSS px/s, 1–100000; fixed 1350 when omitted |
| `move-acceleration` | `moveAcceleration` | Natural acceleration limit, CSS px/s², 1–100000; default `1800` |
| `move-deceleration` | `moveDeceleration` | Natural braking limit, CSS px/s², 1–100000; default `2200` |
| Event `sidekick-move-progress` | `onMoveProgress` | `MovementState`: `{ phase, progress, position, velocity, acceleration, speed }` |
| Event `sidekick-move-end` | `onMoveEnd` | `{ finished, position: { x, y } }` |
| Event `sidekick-play-end` | `onPlayEnd` | `{ finished }`, playback interval completed/cancelled |
| Event `sidekick-transition-end` | `onAssetTransitionEnd` | `{ finished }`, bundled shape/expression/equipment transition completed/cancelled |

Changing `position-x/y` together is one attribute transaction. Direct method calls use `MoveOptions`, default duration 400ms, and natural travel. `move-*` attributes/React props apply only to declarative coordinate changes. Omit move-duration for immediate initial placement. For declarative natural flight at the fixed default maximum speed, use `move-duration="1000" move-travel="natural"`, or React `moveDuration={1000} moveTravel="natural"`. Omitting move-max-speed/moveMaxSpeed uses fixed 1350 CSS px/s; specifying it uses that cap. Positive move-duration does not affect natural-flight speed or time. Default acceleration/deceleration do not vary with distance. A duration of 0 applies immediately even with a maximum speed.

### Methods and actual completion

| Method | Meaning |
| --- | --- |
| `moveTo({ x, y }, options?: MoveOptions)` | Move from the current displayed coordinates; `Promise<MoveResult>` |
| `moveToElement(target, options?: MoveToElementOptions)` | Match the same alignment points on target and bot, then apply X/Y offsets; `anchor: true` keeps following |
| `elementAnchor` | Read-only `{ target, x, y, alignX, alignY }` snapshot or `null` |
| `detachAnchor()` | Detach persistent following; the first movement already in progress continues; subsequent pursuit brakes to rest |
| `moveBy({ x, y }, options?)` | Relative movement from the current in-flight position |
| `cancelMove()` | Natural flight brakes from current velocity, settles pose for 180ms, then returns `finished: false`; none immediately stops position movement |
| `position` | Read-only copy of actual DOM coordinates `{ x, y }` |
| `movementState` | Read-only copy of phase/progress/position/velocity/acceleration/speed |
| `play(activity, { duration? })` | Play an activity loop; duration is **wall-clock milliseconds of playback**, not one loop cycle |
| `stop()` | Cancel playback and smoothly return to idle over 200ms |
| `transitionTo({ shape?, expression?, accessories? }, options?)` | Transition shape/both-eye expression/whole accessory list together |
| `cancelTransition()` | Cancel an active bundled transition, completing with `finished: false` |

Timing easing is `linear` or `smooth`, and duration is 0–60000ms. `play` does not accept easing. Activity values are `idle`, `thinking`, `listening`, `speaking`, `celebrating`, and `still`.

Retargeting natural flight preserves current coordinates, velocity, and flight pose, then accelerates toward the new target. Clicking the opposite side first brakes and turns rather than instantly reversing velocity. Switching to `travel: 'none'` uses time interpolation without inheriting velocity. The previous Promise and `sidekick-move-end` complete once with `finished: false` without waiting for landing. Use the new Promise for the new movement's completion. Since `sidekick-move-end` also includes cancellation of replaced requests, inspect `movementState` for the current phase. Disconnection immediately cleans up RAF, timers, fades, and flight pose and cancels pending movement/playback/bundled transitions.

`cancelMove()` stops movement only; `stop()` stops activity playback only. Call both to stop both. Calling `play()`, `setActivity()`, or changing expressions while moving does not restart the path.

Without duration, `play(activity)` loops until `stop`, the next play/setActivity, or disconnection; its Promise then completes with `finished: false`. Finite playback ends with `finished: true`, then blends to idle over 200ms. That Promise does not wait for the idle blend to finish. Activity changes also blend from the last displayed pose over 200ms; automatic startup activity receives no additional effect.

Shapes use existing contour morphs; expressions use existing shape-key transitions, and `transitionTo` awaits actual worker completion. `accessories` is the **whole equipment list**, so include items to retain. Duplicate slots are rejected before changes. Different accessory meshes are not forcibly interpolated: **fade out the character canvas → replace equipment → confirm a new rendered frame → fade in**. Both fades together span duration, concurrently with shape/expression channels. The page, sibling DOM, and text do not fade. PNG snapshots exclude this CSS fade and save actual character pixels.

Cancellation before the equipment swap retains old equipment; cancellation after it retains new equipment. Cancelled fades are removed so the character is not left transparent. A cancelled shape stops at the current contour while design retains the requested target. New shape/expression/equipment setters or attributes cancel the relevant bundle. Use `updateDesign` for color-only changes; this also cancels an active bundled transition.

`paused` or OS reduced motion immediately applies movement targets, contours, expressions, and fades and clears flight pose, without waiting for takeoff/landing or 180ms cancellation settling. Playback intervals use wall-clock time and elapse while paused. Background tabs may throttle RAF/timers. Natural flight integrates at fixed 1/240-second steps and limits catch-up to 100ms per frame after returning. It does not teleport across the entire hidden interval and may take longer to finish. `travel: 'none'` and activity playback intervals use wall-clock time. A contour-morph Promise whose rendering is suspended offscreen awaits actual resume/completion or cancellation. On disconnected elements, move/transition immediately apply settings; play returns `finished: false`.

### Natural directional flight and real acceleration

`moveTo()` and `moveBy()` default to `travel: 'natural'`. DOM coordinates move by actual velocity/acceleration integration, not merely a visual body lean. Starting from rest, the bot accelerates, calculates braking distance from remaining distance and braking limits, and slows before arrival. Maximum speed is fixed regardless of distance/duration (default 1350 CSS px/s). It accelerates toward that same cap but brakes upon entering braking distance even before reaching it. Acceleration/deceleration do not grow with distance; defaults remain 1800/2200 CSS px/s², so farther destinations take longer. Turns continue from existing velocity and may produce curved paths or brief movement away from the target. Maximum speed caps the desired speed; lowering it while moving causes braking rather than immediately clipping existing velocity.

| `MoveOptions` field | Meaning / default |
| --- | --- |
| `travel` | `'natural'` default / `'none'` |
| `maxSpeed` | Natural maximum speed, CSS px/s, 1–100000; fixed `1350` when omitted (1.5× the earlier explicit 900 example); independent of distance/duration, explicit values used unchanged |
| `acceleration` | Target acceleration-force limit, CSS px/s², 1–100000, default `1800`; actual acceleration approaches it along the response curve below |
| `deceleration` | Target braking-force limit, CSS px/s², 1–100000, default `2200`; used for arrival, reversal, and cancelMove braking |
| `duration` | 0–60000ms, direct-method default `400`; positive natural values ignored without a completion-time guarantee; `0` applies immediately in both modes |
| `easing` | `'smooth'` default / `'linear'`; applies only to time interpolation with `travel: 'none'` |

Distance, current velocity, and acceleration/braking limits determine natural flight time. Positive duration and easing do not affect natural path speed whether or not maxSpeed is specified. Short trips may brake before reaching maximum speed. Use `travel: 'none'` when movement must finish at an exact time. The earlier 15% takeoff / 70% travel / 15% landing timing split does not apply to natural flight.

Acceleration approaches target force with a 60ms exponential response instead of switching instantly. It changes quickly at first and then more gradually; no mathematical logarithm is applied to position. Starting from rest under constant target force, actual acceleration is a(t)=A(1−exp(−t/0.06)). Velocity and position are exact integrals of that acceleration, and event acceleration reports the actual instantaneous value. Braking calculations include force-response delay: predicted position x+τv and velocity v+τa, plus a conservative remaining-distance speed limit min(maxSpeed, 0.9√(2·deceleration·d)). Force is therefore reduced earlier than the simple v²/(2b) formula to prepare smooth braking.

New targets inherit both current velocity and acceleration. A lower cap or opposite direction does not instantly cut force, so previous acceleration persists briefly. acceleration/deceleration limit requested forces; with very different limits, old braking force may briefly remain in the new direction during a turn. Default 1350 is 1.5× the earlier 900 baseline; short distances may never reach it because of acceleration/braking. Acceleration is not forcibly increased to finish distant trips in the same time.

Gaze/yaw/pitch follow actual travel direction, while body lean follows actual acceleration/braking. It does not flip the body by 180 degrees or change body-orientation settings. Hover lift is a runtime pose inside the small canvas, excluded from `position`, bounds, and progress coordinates. After position reaches the target and velocity reaches zero, pose must settle for 180ms before `finished: true`.

Flight is a temporary runtime offset. It does not overwrite saved activity, expression, manual pose, or body orientation, and `play()` timers continue. Landing returns to **the activity active at that moment**; it never restarts finite playback that ended in flight or restores stale pre-flight activity. Changing activity/expression mid-flight preserves position, velocity, and target.

```ts
import '@hanana-kick/sidekick';
import type { MoveOptions, MovementState } from '@hanana-kick/sidekick';

const bot = document.querySelector('sidekick-avatar')!;
const options: MoveOptions = {
  duration: 1000, travel: 'natural', acceleration: 1800, deceleration: 2200,
  // maxSpeed 생략: 거리와 무관한 고정 상한 1350 CSS px/s
};
// 활동은 비행과 동시에 계속 재생됩니다. stop()으로 활동만 중단합니다.
const playback = bot.play('speaking');
const result = await bot.moveBy({ x: 180, y: -60 }, options);
console.log(result.finished, result.position);
bot.stop();
await playback;

// 정확한 시간에 비행 포즈 없이 DOM만 이동합니다.
await bot.moveTo({ x: 24, y: 80 }, { duration: 400, easing: 'smooth', travel: 'none' });
const state: MovementState = bot.movementState;
console.log(state.phase, state.progress, state.position, state.velocity, state.acceleration, state.speed);
```

`travel: 'none'` uses the full duration for DOM movement without takeoff/landing. Physics options are validated but unused in interpolation. When replacing natural flight, the previous flight pose fades for at most 180ms. With `duration: 0`, pause, reduced motion, or disconnection, targets apply immediately and velocity/acceleration/flight pose clear to zero. Even identical coordinates require braking if velocity remains, so natural flight may not complete immediately.

### Movement state and cancellation

`movementState` and `sidekick-move-progress` event detail have the same shape:

| Field | Meaning |
| --- | --- |
| `phase` | `idle`, `takeoff`, `flight`, `landing`, `braking`, `settling`; natural phases describe physics, not fixed timing slices |
| `progress` | Natural: remaining-distance-based 0–1 indicator, not a time estimate; resets on retargeting. None: elapsed fraction of duration. 1 after normal completion |
| `position` | Current DOM coordinates `{ x, y }`, CSS px |
| `velocity` | Actual DOM velocity `{ x, y }`, CSS px/s; right/down positive |
| `acceleration` | Actual velocity change `{ x, y }`, CSS px/s², distinct from configured acceleration limits |
| `speed` | Velocity magnitude `Math.hypot(velocity.x, velocity.y)`, CSS px/s |

State is a copy; reading or modifying it does not control movement. The DOM already accelerates/moves in `takeoff`; `landing` means braking toward the target, and `braking` means cancelMove braking. `settling` clears flight pose with velocity/acceleration zero. Progress events occur at start, animation samples, resize, cancellation, and completion. Render only needed values in your UI; use the Promise or `sidekick-move-end` for definitive completion/cancellation. Avoid streaming frame events into a screen-reader live region.

`cancelMove()` reduces current natural-flight velocity using deceleration; it does not stop immediately at the call position. From steady speed, approximate braking distance is `speed² / (2 × deceleration) + 0.06 × speed`; residual acceleration can make it longer. Smooth force changes may briefly increase speed initially, but a stop request does not rebound in the opposite direction. At zero velocity, `settling` clears direction/lean/lift over 180ms, then the original movement Promise and `sidekick-move-end` complete with `finished: false`. Retargeting during braking continues naturally from residual velocity. `cancelMove()` itself returns no Promise. `travel: 'none'` immediately stops position movement and clears any remaining flight pose. Pause, reduced motion, and disconnection apply immediately without waiting for braking/settling.

With `movement-bounds="viewport"`, the whole canvas box remains inside the viewport. Only outward velocity on the contacting axis is zeroed; the other axis can continue. This boundary clipping is an exception to normal acceleration limits. `inline` and `movement-bounds="none"` have no such constraint; the app must manage container bounds, braking distance, and turning space. Clamping only the destination does not constrain the inertial path or stopping point.

The API playground enables “Default maximum speed · 1350 CSS px/s” by default and omits only maxSpeed from the call. acceleration=1800 and deceleration=2200 remain distance-independent defaults. Disabling the default-speed option uses the entered maxSpeed cap. All three physics limits can be adjusted and compared with actual velocity/acceleration. Natural always uses physical integration, never a time-based flight substitute. The last-six-seconds graphs show speed and acceleration magnitudes on independent axes. Click/tap movement is distinguished from dragging, scrolling, and long presses; mobile includes a movement-stop control. Playback interval `0` means looping only in the playground; the actual API omits duration.

### Command APIs in CDN HTML

```html
<script type="module">
  import { createAccessory } from 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.12.0/dist/browser/sidekick.js';
  const bot = document.querySelector('#companion');
  // import 평가 뒤에는 이미 등록된 엘리먼트 API를 사용할 수 있습니다.
  await bot.moveTo({ x: 80, y: 240 }, { maxSpeed: 320, acceleration: 900, deceleration: 1200 });
  await bot.play('celebrating', { duration: 1500 });
  await bot.transitionTo({
    shape: 'heart', expression: 'smile',
    accessories: [createAccessory('beret'), createAccessory('glasses')],
  }, { duration: 700 });
</script>
<sidekick-avatar id="companion" placement="viewport" position-x="24" position-y="200"
  body-color="#FFCC37" style="width:180px;height:180px;z-index:1000"></sidekick-avatar>
```

Run after `sidekick-ready` to see the first transition animate. Before readiness, shape/expression commands apply immediately as in the existing API. The script above is a module and executes after HTML parsing. The same methods work on elements registered by the classic bundle.

### HTML stage: move to a click or touch

This stage absolutely positions a small 144px canvas in `inline` mode; there is no stage-sized canvas. Pointer coordinates are converted into stage coordinates, and the app clamps the canvas destination inside the stage. Mobile taps use Pointer Events.

```html
<style>
  #flight-stage { position: relative; height: 360px; overflow: hidden;
    background: #f4f4f5; touch-action: manipulation; }
  #flight-avatar { position: absolute; left: 0; top: 0; width: 144px; height: 144px; }
</style>
<div id="flight-stage" role="group" aria-label="누른 곳으로 이동하는 무대">
  <sidekick-avatar id="flight-avatar" placement="inline" interaction="none"
    move-duration="1000" move-travel="natural" body-color="#FFCC37"
    aria-label="이동하는 도우미"></sidekick-avatar>
</div>
<button id="flight-center" type="button">가운데로 이동</button>
<button id="flight-cancel" type="button">이동 중단</button>
<button id="flight-play" type="button">말하기 재생</button>
<button id="flight-stop" type="button">활동 중단</button>
<p id="flight-status" aria-live="off">idle</p>
<script type="module">
  import 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.12.0/dist/browser/sidekick.js';
  const stage = document.getElementById('flight-stage');
  const bot = document.getElementById('flight-avatar');
  const status = document.getElementById('flight-status');
  function flyTo(localX, localY) {
    const x = Math.max(0, Math.min(stage.clientWidth - bot.offsetWidth, localX - bot.offsetWidth / 2));
    const y = Math.max(0, Math.min(stage.clientHeight - bot.offsetHeight, localY - bot.offsetHeight / 2));
    void bot.moveTo({ x, y }, { duration: 1000, travel: 'natural', acceleration: 1800, deceleration: 2200 });
  }
  stage.addEventListener('pointerup', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = stage.getBoundingClientRect();
    flyTo(event.clientX - rect.left, event.clientY - rect.top);
  });
  document.getElementById('flight-center').onclick = () => flyTo(stage.clientWidth / 2, stage.clientHeight / 2);
  document.getElementById('flight-cancel').onclick = () => bot.cancelMove();
  document.getElementById('flight-play').onclick = () => void bot.play('speaking', { duration: 2000 });
  document.getElementById('flight-stop').onclick = () => bot.stop();
  bot.addEventListener('sidekick-move-progress', event => { status.textContent = event.detail.phase; });
  bot.addEventListener('sidekick-move-end', event => {
    status.textContent = event.detail.finished ? '도착' : '이동 중단됨';
  });
</script>
```

The move-to-center button also works by keyboard. If your app shrinks the stage dynamically, call `moveTo()` to reclamp for the new size. `inline` does not automatically calculate app-container bounds. Inertial braking may move outside the stage, so this example clips overflow. Its `moveTo()` calls pass options directly and do not read HTML movement attributes. For declarative control, update `position-x/y` together.

### React: using the same element API through a ref

```tsx
import { useRef, useState } from 'react';
import { SidekickAvatar, type SidekickAvatarRef } from '@hanana-kick/sidekick/react';
import { createAccessory } from '@hanana-kick/sidekick';

export function Companion() {
  const bot = useRef<SidekickAvatarRef>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState('idle');
  function flyTo(localX: number, localY: number) {
    const avatar = bot.current;
    const area = stage.current;
    if (!avatar || !area) return;
    const x = Math.max(0, Math.min(area.clientWidth - avatar.offsetWidth, localX - avatar.offsetWidth / 2));
    const y = Math.max(0, Math.min(area.clientHeight - avatar.offsetHeight, localY - avatar.offsetHeight / 2));
    void avatar.moveTo({ x, y }, { duration: 1000, travel: 'natural', acceleration: 1800, deceleration: 2200 });
  }
  return <>
    <div ref={stage} role="group" aria-label="누른 곳으로 이동하는 무대"
      style={{ position: 'relative', height: 360, overflow: 'hidden', background: '#f4f4f5', touchAction: 'manipulation' }}
      onPointerUp={event => {
        if (!event.isPrimary || event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        flyTo(event.clientX - rect.left, event.clientY - rect.top);
      }}>
      <SidekickAvatar ref={bot} placement="inline" interaction="none"
        moveDuration={1000} moveTravel="natural" bodyColor="#FFCC37"
        style={{ position: 'absolute', left: 0, top: 0, width: 144, height: 144 }}
        onMoveProgress={event => setPhase(event.detail.phase)}
        onMoveEnd={event => setPhase(event.detail.finished ? '도착' : '이동 중단됨')} />
    </div>
    <button type="button" onClick={() => {
      if (stage.current) flyTo(stage.current.clientWidth / 2, stage.current.clientHeight / 2);
    }}>가운데로 이동</button>
    <button type="button" onClick={() => bot.current?.cancelMove()}>이동 중단</button>
    <button type="button" onClick={() => void bot.current?.play('speaking', { duration: 2000 })}>말하기 재생</button>
    <button type="button" onClick={() => bot.current?.stop()}>활동 중단</button>
    <button type="button" onClick={() => void bot.current?.transitionTo({
      shape: 'heart', expression: 'smile', accessories: [createAccessory('beret')],
    }, { duration: 600 })}>외형 전환</button>
    <p aria-live="off">{phase}</p>
  </>;
}
```

React SSR remains safe; refs are published after client registration. Declarative `positionX/Y` apply only when values change, so ordinary parent rerenders do not undo imperative movement. The ref calls above pass `MoveOptions` directly; `moveDuration`, `moveTravel`, `moveMaxSpeed`, `moveAcceleration`, and `moveDeceleration` props govern declarative `positionX/Y` changes. React `onAssetTransitionEnd` is the Sidekick bundled-transition event, distinct from native CSS `onTransitionEnd`.

Public types `AvatarPlacement`, `AvatarPosition`, `MovementBounds`, `MoveOptions`, `MoveResult`, `MovementState`, `PlayOptions`, and `AssetTransitionTarget` are available from the main/`register` entries. `MoveOptions.travel` is `'natural' | 'none'`; do not pass `travel` to shape/expression/pose APIs taking `MotionOptions`.


## API playground: turn intended actions into code

In the [API playground](https://sidekick.hananakick.cc/api-playground.html), select movement, activity/state, individual eye expressions, pointer tracking, body direction, appearance transitions, or entry/exit. HTML + JavaScript or React code updates immediately as values change. Execution and code generation use the same command data. Installation and Studio-bot initialization code are provided in a separate setup area.

One small transparent canvas moves across the full page with `placement="viewport"`; no fullscreen canvas is created. Coordinates are CSS pixels from the viewport top-left, without adding page scroll height. Clicking/tapping empty space moves the bot center there. Selected tasks, inputs, and configuration code remain intact; actual click-movement/stop calls can be inspected/copied separately as the last executed code. Switching task types and back preserves each task's inputs. Buttons, forms, links, code selection, and scrolling do not trigger movement. Pointer events pass through the bot so it does not block page controls.

Saved Studio design and scene settings are read in the same browser and origin. Temporary playground commands do not overwrite Studio data. Invalid data or unavailable browser storage shows guidance and a default bot without deleting the original. Use Studio JSON export/import to transfer to another browser/device.

### Natural entry and exit

```js
// placement="viewport" 요소에서 사용합니다.
await avatar.enter({ x: 120, y: 200 }, { from: 'left' });
await avatar.exit({ to: 'right' });
// 다시 입장할 수 있습니다.
await avatar.enter({ x: 240, y: 120 }, { from: 'top', maxSpeed: 1350 });
```

- `enter(point, options?)`: fly from outside the screen to `point`. `from` is `left` (default), `right`, `top`, or `bottom`.
- `exit(options?)`: fly beyond the selected screen edge, then hide. `to` is `right` (default), `left`, `top`, or `bottom`.
- Both accept existing `MoveOptions` speed, acceleration, braking, travel, and duration settings. Natural flight uses real inertia; pause/reduced motion applies immediately.
- Results are `{ finished, position, presence }`. Read-only `presenceState` is `visible`, `entering`, `exiting`, or `hidden`. End events are `sidekick-enter-end` / `sidekick-exit-end`, with React props `onEnterEnd` / `onExitEnd`; the same methods work via React refs.
- Unsupported for `inline` placement. A new entry/exit during an existing one retargets from current position/inertia. Ordinary `moveTo` / `moveBy` cancels entry/exit and makes the bot visible. `cancelMove()` brakes without hiding.
- Once exit fully completes, rendering and tracking subscriptions deactivate. Design/activity/tracking settings remain and restore on reentry. Resizing adjusts an in-progress exit destination to the new screen edge.

| React prop | Type | Meaning |
| --- | --- | --- |
| `onEnterEnd` | `SidekickEventHandler<'sidekick-enter-end'>` | Entry completed/cancelled `{finished, position, presence}` |
| `onExitEnd` | `SidekickEventHandler<'sidekick-exit-end'>` | Exit completed/cancelled `{finished, position, presence}` |

### Element-relative movement

`moveToElement(target: Element, options?: MoveToElementOptions): Promise<MoveResult>` moves relative to a specific DOM element. React's `SidekickAvatarRef` exposes the same method.

```js
const target = document.querySelector('#message');
if (target) {
  await bot.moveToElement(target, {
    anchor: true,    // false (기본값): 한 번 이동 / true: 도착 후 계속 연결
    alignX: 'center', // left (기본값) | center | right
    alignY: 'bottom', // top (기본값) | center | bottom
    x: 12, y: -16,   // 기본값 0. 화면 기준 오른쪽 / 아래쪽이 양수
    maxSpeed: 1350, acceleration: 1800, deceleration: 2200,
  });
}
```

It matches **the same alignment point** on target and bot: `center/center` aligns box centers; `right/bottom` aligns bottom-right corners. X/Y offsets apply afterwards. The reference is the element's displayed border-box including transparent canvas, not the character's opaque pixel bounds.

```tsx
import { useRef } from 'react';
import { SidekickAvatar, type SidekickAvatarRef } from '@hanana-kick/sidekick/react';

export function Example() {
  const bot = useRef<SidekickAvatarRef>(null);
  const target = useRef<HTMLButtonElement>(null);
  return <>
    <SidekickAvatar ref={bot} placement="viewport" />
    <button ref={target} onClick={() => {
      if (target.current) void bot.current?.moveToElement(target.current, {
        anchor: true, alignX: 'center', alignY: 'center', x: 0, y: -100,
      });
    }}>이 버튼을 기준으로 이동</button>
  </>;
}
```

- `anchor: false` (default) moves once to the position sampled at call time; subsequent scrolling/layout changes are not followed.
- `anchor: true` continually maintains the chosen alignment/offset. During initial movement, only that request's destination updates, preserving velocity, acceleration, and Promise. After arrival, the same speed/acceleration/braking settings naturally pursue the target. Sudden target movement never snaps bot coordinates. The first-arrival Promise and completion event occur only once; later pursuit does not repeat them. At rest, errors up to 0.5 CSS px are ignored. Nested scrolling, resizing, layout changes, and CSS/WAAPI transforms are tracked. A continually moving target can delay initial completion. If bot or target leaves layout through `display: none`, tracking suspends without detaching and realigns when visible again.
- When the bot is completely offscreen and its aligned destination is also offscreen, physics/rendering become idle. If either position or destination intersects the viewport again, pursuit resumes with inertia, without integrating the entire hidden interval. Rendering resumes only when the bot itself intersects the screen. Active anchor checks share one RAF per document; when all connections are idle, polling drops to 250ms. Scroll/resize triggers the next frame; transform-only returns are detected within approximately 250ms. Hidden tabs stop position checks too. Thus fully offscreen GPU frames stop, while a small amount of DOM measurement remains to detect return.
- Supported environments render WebGL2 in a dedicated worker using transferred OffscreenCanvas. Hidden resizes are coalesced until the next actual render. Unsupported/CSP-limited environments use main-thread WebGL2 fallback. DOM measurement and position updates remain on the DOM-capable main thread.
- Parent DOM and CSS positioning stay unchanged. Absolute/fixed/inline placement remains; only the bot's movement offset updates. `detachAnchor()` detaches; an initial movement already in progress continues to its last target. Pursuit after first arrival brakes to rest from current inertia. Use `cancelMove()` to stop movement too.
- Other `moveTo / moveBy / moveToElement`, `cancelMove / enter / exit`, or bot disconnection release the old anchor. Target removal, adoption into another document, or unsupported ancestor-transform changes also detach; initial movement continues to the last valid target. Persistent circular anchoring to the bot itself or its descendants is rejected.
- Active anchors read layout in one document-wide RAF before writing positions. Unchanged positions are not rewritten, but frame-by-frame measurement remains necessary to track transform-only animations observers cannot detect. Hidden documents suspend the loop; the last detachment removes it. Anchor only while needed.
- Both `inline` and `viewport` convert coordinates using the bot's current screen position. The bot's own CSS transform contributes to measured dimensions. Its own CSS zoom is unsupported; use transform: scale(). Ancestor transform/rotate/scale/perspective/CSS zoom changes coordinate units and is explicitly rejected. Place the bot directly under an untransformed body in that case.
- Accepts connected HTML/SVG Elements in the same document. Disconnected targets, other documents, and invalid options are rejected synchronously before cancelling current movement or showing the bot. A zero-sized target is still a valid anchor point.
- Existing `MoveOptions` acceleration/braking, cancellation, and reduced-motion behavior applies. With `movementBounds="viewport"`, screen constraints take precedence over alignment; use `movementBounds="none"` for exact offscreen target alignment.
- Selecting `moveToElement` in the playground movement reference displays CSS selector, alignment, offsets, and matching executable code. Selectors are a playground convenience; the actual API receives an Element. Provide a matching target element in your app when copying the example.

### Guide: from simple use to deep customization

The [Guide](https://sidekick.hananakick.cc/guide.html) documents declarative bot state first, followed by usage examples and direct control. The old use-cases.html address redirects to the guide. Studio, API playground, and Guide share the same navigation.

Guide example links retain the source section, learning level, applied options, and application outcome. The API playground opens the same target DOM, event controls, and executable code. Opening a link does not start a behavior; use the run button. The return link restores the source section, level, and scroll position. Installation, appearance, coordinates, anchoring, lifecycle, and performance sections link to their corresponding example or dedicated controls. URLs contain only allowlisted example settings and outcomes, never entered names, email addresses, search text, or arbitrary JavaScript.

- **[Bot state](https://sidekick.hananakick.cc/guide.html?lang=en#state-emotion)**: Define emotion, position/target and behavior first, then gaze/orientation, appearance/eyes and transition/execution settings. Reference tables cover types, accepted values, defaults and ownership, with HTML/React/JavaScript declarations.
- **[Usage examples](https://sidekick.hananakick.cc/guide.html?lang=en#loading)**: Compose state in 18 app scenarios covering loading, uploads, review, forms, onboarding and emotional reactions. Input is a typed declaration, not natural-language interpretation.
- **[Direct control](https://sidekick.hananakick.cc/guide.html?lang=en#html-start)**: Installation and initialization prerequisites, followed by DOM placement/anchoring, movement/gaze/expressions, lifecycle and rendering controls.

Each scenario progresses through **simple usage → adjust options → connect app events → compose actions directly**. See the running bot alongside the actual executable code and copy it. Installation/concept lessons are distinguished from live demos. A three-level table of contents and URL hashes link directly to each step; navigation collapses on mobile.

Only one example runs at a time to avoid unnecessary renderers. Instances are removed on exit/switching, and rendering pauses for invisible sections or hidden pages. Studio settings are read-only; experiments do not save over them. Unless otherwise stated, asynchronous demo tasks are local simulations; connect real service requests and result events in your app.
