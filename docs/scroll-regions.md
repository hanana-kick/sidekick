# Scroll regions: wait nearby, react intentionally

`createScrollRegions` separates three concerns:

- `region`: the section whose visibility selects the active scene.
- `target`: the element the scene is about, supplied to `onChange` (defaults to `region` when omitted). It does not automatically become the movement destination.
- `waitAt`: where the companion waits. Omit it for a stable place near the viewport's right edge (20 CSS-pixel margin, its center 56% down the viewport), use viewport coordinates, or follow an element's live position.

This is useful for a long landing-page section, a product collection, or a community feed. Small scrolls within one section should not send the companion chasing each newly visible card. An element-based waiting point still allows the companion to travel with a particular element when that is intentional.

## A section and its reaction target

Run this after the avatar and the referenced elements are connected to the same document. The avatar must use `placement="viewport"` (the default inline placement is not supported). With `/register`, explicitly register the element first. The helper is also exported by the automatic `/auto` and package-root entries.

```ts
import { createScrollRegions, defineSidekick, type SidekickAvatar } from '@hanana-kick/sidekick/register';

defineSidekick();
const bot = document.querySelector<SidekickAvatar>('sidekick-avatar')!;
bot.placement = 'viewport';
const collection = document.querySelector<HTMLElement>('#collection')!;
const cheaperProduct = document.querySelector<HTMLElement>('#cheaper-product')!;
const mentions = document.querySelector<HTMLElement>('#mentions')!;

const regions = createScrollRegions(bot, {
  regions: [
    { id: 'collection', region: collection, target: cheaperProduct },
    { id: 'mentions', region: mentions, target: mentions, waitAt: { x: 24, y: 180 } },
  ],
  activationLine: 0.5,
  hysteresis: 48,
  movement: { travel: 'natural', maxSpeed: 700, acceleration: 1800, deceleration: 2200 },
  onChange(active) {
    if (active?.id === 'collection') bot.say('A similar item here costs less.');
    if (active?.id === 'mentions') bot.say('You have a new mention.');
  },
});

// For example, call this from your component/router teardown.
function disposeScene() {
  regions.dispose();
}
void disposeScene;
```

Use meaningful section IDs and only announce a meaningful scene change. `onChange` is not a scroll callback. The application decides what to say or highlight; an active region is not evidence of a purchase, a new message, or user intent.

## Wait beside a live element inside a scrolling area

A scrolling container can be supplied as `root`. Coordinates in `waitAt: { x, y }` remain viewport CSS pixels, not root-content coordinates. To move with an element, use the element form instead:

```ts
import { createScrollRegions, type SidekickAvatar } from '@hanana-kick/sidekick/register';

declare const bot: SidekickAvatar;
const scroller = document.querySelector<HTMLElement>('#feed-scroll')!;
const thread = document.querySelector<HTMLElement>('#featured-thread')!;
const reply = document.querySelector<HTMLElement>('#latest-reply')!;
const restingSpot = document.querySelector<HTMLElement>('#companion-resting-spot')!;

const controller = createScrollRegions(bot, {
  root: scroller,
  regions: [{
    id: 'thread',
    region: thread,
    target: reply,
    waitAt: { element: restingSpot, alignX: 'left', alignY: 'top', x: 8, y: -8 },
  }],
});

controller.pause();
// Your application can now give the bot a manual task.
controller.resume();
// Request a fresh measurement after an application-owned layout update.
controller.refresh();
controller.dispose();
```

The waiting point and reaction target may deliberately be different elements. Do not use the avatar itself or its descendants as a waiting point. Keep the avatar under an untransformed container; the element-anchor restrictions also apply here.

## Options

| Option | Meaning |
| --- | --- |
| `regions` | Scene definitions, each with a unique `id`, a connected `region`, and optional `target` and `waitAt`. |
| `root` | Optional scrolling element containing the regions. Omit for the document viewport. |
| `activationLine` | Position of the activation line in the visible portion of the root, from `0` to `1`; default `0.5`. |
| `hysteresis` | CSS-pixel tolerance around the active region to avoid repeated switches; default `48`. |
| `movement` | Existing `MoveOptions` for natural travel. This does not change the bot's design or size. |
| `onChange` | Receives the selected scene's `id`, `region`, and `target`, or `null` when no scene is active. |

The visible region nearest the activation line is selected. The current region is retained while the line remains within its hysteresis band. If several candidates are equally near, their array order breaks the tie. Invisible or detached regions are not selected.

`waitAt: { x, y }` specifies the avatar's top-left position in viewport CSS pixels. Requested waiting positions are clamped to the visible viewport. It is not the avatar's internal translation and is not a document/page coordinate. A fixed viewport waiting point stays steady while the user scrolls within the same scene. The element form uses `alignX`, `alignY`, and CSS-pixel offsets to align the avatar with the current element rectangle, rather than saving a stale destination at the start of travel.

## Ownership and lifecycle

- Read `controller.activeRegion` for the selected ID or `null`, and `controller.paused` for its paused state. These are read-only.
- `pause()` stops this controller's own movement and yields automatic control; `resume()` explicitly enables it again. `refresh()` requests a new measurement without creating a second controller.
- A manual movement or visibility command that takes over the anchor pauses automatic region control. It must not immediately undo `hide()` or steal control back from `moveTo()`. Call `resume()` when the application is ready to return control.
- Respect reduced-motion preferences. Do not add a separate JavaScript chase loop to override the library's motion policy.
- `pause()` and `dispose()` leave an anchor owned by a later manual command untouched.
- Call `dispose()` when leaving the page or unmounting the owning component. Do not create another controller on every scroll event or React render.
- Within an iframe, use elements and an avatar from that iframe's document. A controller does not grant access to a cross-origin embedded site.

Region selection and waiting are distinct from continuous element anchoring: use a stable waiting point while a section is active, and an element waiting point when following is useful. Region changes retarget the existing movement rather than teleporting to a newly computed start position. Functional behavior tests alone do not establish a reduction in CPU or GPU usage.
