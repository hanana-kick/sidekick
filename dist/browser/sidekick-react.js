'use client';
/*! Sidekick 0.16.0 | Sidekick Library and Character License 1.0; see LICENSE.

Sidekick Library and Character License 1.0

Copyright (c) 2026 the respective Sidekick authors and rights holders.

1. Scope and definitions

This license applies only to the Sidekick material distributed with this license
that its respective rights holders are entitled to license (the "Material").
"Library" means the software, source code, compiled bundles, APIs, documentation,
and examples in the Material. "Official Character" means the original expressive
Sidekick character artwork and character designs embodied in this distribution's
built-in character compositions, facial designs, accessories, poses and animations,
including their rendered images and adaptations that retain that expression.
Changing a color, shape option, accessory, name, medium, or file format does not by
itself remove the retained Official Character expression from this definition.

The Official Character does not include the idea of an animated companion, style
alone, generic shapes or familiar symbols, algorithms, public-domain material, or
independently created user or third-party artwork that does not copy protected
Sidekick expression. Using the Library alone does not make an independently
created character an Official Character or transfer ownership of user content.
Third-party material is excluded from this license and remains governed by its
own licenses and notices, even when included in the same file or bundle.

2. Library use and embedding

Permission is granted, free of charge and worldwide, to use, reproduce, modify,
combine, distribute, and provide the Library in source or compiled form, including
in proprietary, paid, subscription-based, advertising-supported, and other
commercial or noncommercial websites, applications, products and services, subject
only to the conditions of this license. There is no embedding fee, revenue limit,
application-category restriction, source-disclosure requirement, or required
on-screen attribution. You may charge for applications, services, integrations,
support and software distributions incorporating the Library.

This permission includes displaying, animating, and customizing the Official
Character as an embedded interface element or companion, and making the copies
and adaptations needed for that use. Normal screenshots, recordings, documentation,
app-store listings, demonstrations and advertising of the embedding product may
show that embedded use. Neither charging for the embedding product nor the mere
presence of the Official Character in it is Character Commercialization.

3. No commercialization of the character itself

No permission is granted to commercialize the Official Character itself, whether
unchanged or adapted ("Character Commercialization"). This includes selling,
licensing, renting, or otherwise monetizing the Official Character or rights to it
as merchandise, physical or digital stickers or emoticons, avatar or skin packs,
digital collectibles (including NFTs), standalone images, animations, models,
character assets, or other character-based goods or content. It also includes
paid character-specific unlocks and offering such items as paid, sponsored,
promotional, or bundled goods, even if called free or included in another price.
Embedding the Library in a character-asset sales or distribution interface does
not authorize the prohibited commercialization of the Official Character.

This restriction does not prohibit the commercial embedding and ordinary product
advertising expressly permitted by section 2, nor the sale or licensing of wholly
independent user-created characters excluded by section 1. Noncommercial personal
use and sharing of the Official Character are permitted under this license.

4. Redistribution and notices

Keep this license and applicable copyright and third-party notices with copies or
substantial portions of the Material that you distribute. Notices may accompany a
product in its license files or legal notices; they need not appear beside the
embedded character. Do not offer the Material under terms that purport to grant
Character Commercialization rights. Recipients receive the permissions in this
license directly from the relevant rights holders. Your own code and independent
content may use different terms. No ownership of the Official Character, or right
to imply endorsement by Sidekick, is granted.

5. Earlier versions and independent rights

This license applies to copies distributed under it. It does not withdraw, replace,
or restrict rights already granted under another license, including any prior MIT
license, or rights independently obtained from other rights holders. Earlier
releases retain their applicable terms. This license does not claim new exclusive
rights over third-party or public-domain material and does not limit uses allowed
by applicable law without permission, including applicable copyright exceptions.

6. Disclaimer

To the extent permitted by applicable law, the Material is provided as is, without
warranties of any kind, express or implied, including merchantability, fitness for
a particular purpose, and noninfringement. To that extent, the authors and rights
holders are not liable for claims, damages, or other liability arising from the
Material or its use, whether in contract, tort, or otherwise.

This is a custom license, not the MIT License or an OSI-approved open-source
license. The English text in this file is authoritative; README summaries are
explanations and do not replace these terms.


Third-party Material Shapes notices and Apache-2.0 license:
Material Shapes contour data and recipe generator
Copyright 2024 The Android Open Source Project
Licensed under the Apache License, Version 2.0. See LICENSE in this directory.

Source: AndroidX Compose MaterialShapes.kt
Snapshot: 9a589fa61f8661e0cbef9123dcc98d3c1f655fc7
File blob: 7e02d245662ff48a5dba19ea0d170356256ed93f
Source SHA-256: 08c29828003344914ee0d6783f213b37caae650175cd004ba321eaf3a7d6e434
https://github.com/androidx/androidx/blob/9a589fa61f8661e0cbef9123dcc98d3c1f655fc7/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt

Sidekick modifications: translated numeric recipes, repeated/mirrored vertices,
and 2D transforms to Java; generated normalized cubic coordinates using the
unmodified official androidx.graphics:graphics-shapes-android:1.1.0 library;
added TypeScript contour tessellation, direct closed-perimeter morph matching,
and a constant-thickness shallow 3D extrusion. Morph alignment minimizes
point travel and merges both contours' vertex breakpoints; there is no ellipse
waypoint. Interrupted snapshots are bounded by microscopic contour simplification.
The 3D extrusion and morph correspondence are not AndroidX Morph and are not
provided or endorsed by Google. Source values are IEEE Float-derived; Sidekick
runtime uses JavaScript numbers.

Regeneration: node scripts/generate-material-shapes.mjs
The generator verifies SHA-256 for every downloaded official build dependency
and the pinned source snapshot. It adds no application runtime dependencies.
All 35 shape recipes are preserved, including per-vertex corner radii/smoothing,
mirroring, rotations, and aspect-preserving AndroidX normalized() bounds.


                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

*/
"use client";import{createElement as e,useCallback as t,useEffect as n,useLayoutEffect as r,useRef as i}from"react";function a(e,t){if(!e||!t)return e===t;let n=e,r=t;return Object.keys(n).length===Object.keys(r).length&&Object.keys(n).every(e=>n[e]===r[e])}const o=`sidekick-avatar`,s={emotion:`emotion`,emotionIntensity:`emotion-intensity`,placement:`placement`,positionX:`position-x`,positionY:`position-y`,movementBounds:`movement-bounds`,moveDuration:`move-duration`,moveEasing:`move-easing`,moveTravel:`move-travel`,moveMaxSpeed:`move-max-speed`,moveAcceleration:`move-acceleration`,moveDeceleration:`move-deceleration`,shape:`shape`,bodyColor:`body-color`,eyeColor:`eye-color`,expression:`expression`,leftExpression:`left-expression`,rightExpression:`right-expression`,smile:`smile`,blink:`blink`,leftSmile:`left-smile`,rightSmile:`right-smile`,leftBlink:`left-blink`,rightBlink:`right-blink`,headAccessory:`head-accessory`,headColor:`head-color`,eyesAccessory:`eyes-accessory`,eyesColor:`eyes-color`,mouthAccessory:`mouth-accessory`,mouthColor:`mouth-color`,neckAccessory:`neck-accessory`,neckColor:`neck-color`,leftEarAccessory:`left-ear-accessory`,leftEarColor:`left-ear-color`,rightEarAccessory:`right-ear-accessory`,rightEarColor:`right-ear-color`,bodyYaw:`body-yaw`,bodyPitch:`body-pitch`,bodyRoll:`body-roll`,size:`size`,zoom:`zoom`,gazeX:`gaze-x`,gazeY:`gaze-y`,activity:`activity`,paused:`paused`,interaction:`interaction`,mouseTracking:`mouse-tracking`,trackingMode:`tracking-mode`,renderStyle:`render-style`,shapeDuration:`shape-duration`,shapeEasing:`shape-easing`,motionDuration:`motion-duration`,motionEasing:`motion-easing`,time:`time`},c={onEmotionChange:`sidekick-emotion-change`,onReactionEnd:`sidekick-reaction-end`,onEnterEnd:`sidekick-enter-end`,onExitEnd:`sidekick-exit-end`,onMoveEnd:`sidekick-move-end`,onMoveProgress:`sidekick-move-progress`,onPlayEnd:`sidekick-play-end`,onAssetTransitionEnd:`sidekick-transition-end`,onBehaviorChange:`sidekick-behavior-change`,onBehaviorEnd:`sidekick-behavior-end`,onLifecycleChange:`sidekick-lifecycle-change`,onReady:`sidekick-ready`,onDesignChange:`sidekick-design-change`,onMotionEnd:`sidekick-motion-end`,onShapeEnd:`sidekick-shape-end`,onBodyOrientationChange:`sidekick-body-orientation-change`,onZoomChange:`sidekick-zoom-change`,onActivate:`sidekick-activate`,onError:`sidekick-error`};function l(e){return JSON.stringify(e,(e,t)=>typeof t==`object`&&t&&!Array.isArray(t)?Object.fromEntries(Object.entries(t).sort(([e],[t])=>e.localeCompare(t))):t)}function u(e,t){if(e===null||t===null)return e===t;if(typeof e!=`object`||typeof t!=`object`)return Object.is(e,t);let n=Reflect.ownKeys(e);return n.length!==Reflect.ownKeys(t).length||Object.getPrototypeOf(e)!==Object.getPrototypeOf(t)?!1:n.every(n=>{let r=Object.getOwnPropertyDescriptor(e,n),i=Object.getOwnPropertyDescriptor(t,n);if(!r||!i||!Object.hasOwn(r,`value`)||!Object.hasOwn(i,`value`)||r.enumerable!==i.enumerable)return!1;let a=r.value,o=i.value;return Array.isArray(a)&&Array.isArray(o)?a.length===o.length&&a.every((e,t)=>Object.is(e,o[t])):Object.is(a,o)})}function d(e){if(typeof e!=`object`||!e)return e;let t=Object.getOwnPropertyDescriptors(e);for(let e of Object.values(t))Object.hasOwn(e,`value`)&&Array.isArray(e.value)&&(e.value=[...e.value]);return Object.create(Object.getPrototypeOf(e),t)}function f(e){let t=Object.getPrototypeOf(e);return Array.isArray(e)||t===Object.prototype||t===null}function p(e,t=new WeakMap){if(typeof e!=`object`||!e||!f(e))return e;let n=t.get(e);if(n)return n;let r=Array.isArray(e)?[]:Object.create(Object.getPrototypeOf(e));t.set(e,r);for(let n of Reflect.ownKeys(e)){let i=Object.getOwnPropertyDescriptor(e,n);Object.hasOwn(i,`value`)&&(i.value=p(i.value,t)),Object.defineProperty(r,n,i)}return r}function m(e,t,n=new WeakMap){if(Object.is(e,t))return!0;if(!e||!t||typeof e!=`object`||typeof t!=`object`||!f(e)||!f(t)||Object.getPrototypeOf(e)!==Object.getPrototypeOf(t))return!1;let r=n.get(e);if(r)return r===t;n.set(e,t);let i=Reflect.ownKeys(e);return i.length===Reflect.ownKeys(t).length&&i.every(r=>{let i=Object.getOwnPropertyDescriptor(e,r),a=Object.getOwnPropertyDescriptor(t,r);return!a||i.enumerable!==a.enumerable||Object.hasOwn(i,`value`)!==Object.hasOwn(a,`value`)?!1:Object.hasOwn(i,`value`)?m(i.value,a.value,n):i.get===a.get&&i.set===a.set})}function h(e){if(typeof e==`string`){if(![`front`,`three-quarter`,`side`].includes(e))throw TypeError(`bodyOrientation must be front, three-quarter, or side`);return}if(!e||typeof e!=`object`||Array.isArray(e))throw TypeError(`bodyOrientation must be a plain object or preset`);let t=Object.getPrototypeOf(e);if(t!==Object.prototype&&t!==null)throw TypeError(`bodyOrientation must be a plain object`);for(let t of Reflect.ownKeys(e)){let n=Object.getOwnPropertyDescriptor(e,t);if(t!==`yaw`&&t!==`pitch`&&t!==`roll`||!Object.hasOwn(n,`value`)||!n.enumerable)throw TypeError(`bodyOrientation accepts only yaw, pitch, and roll; use the separate zoom prop`);let r=t===`yaw`?360:t===`pitch`?90:180,i=n.value;if(typeof i!=`number`||!Number.isFinite(i)||i<-r||i>r)throw RangeError(`bodyOrientation.${t} must be a finite number between ${-r} and ${r}`)}}function g(f){for(let e of[`camera`,`cameraYaw`,`cameraPitch`,`cameraRoll`,`cameraZoom`,`view`,`viewYaw`,`viewPitch`,`viewRoll`,`viewZoom`,`onCameraChange`,`onViewChange`,`camera-yaw`,`camera-pitch`,`camera-roll`,`camera-zoom`,`view-yaw`,`view-pitch`,`view-roll`,`view-zoom`])if(Object.prototype.hasOwnProperty.call(f,e))throw TypeError(`${e} has been removed; use bodyOrientation, bodyYaw/bodyPitch/bodyRoll, zoom, onBodyOrientationChange or onZoomChange instead`);let{ref:g,design:y,accessories:b,bodyOrientation:x,motion:S,behavior:C,entrance:w,positioning:T,presence:E,task:D,home:O,...k}=f,A=i(null),j=i(!1),M=i(null),N=i(f),P=i(null),F=i([]),I=i(new WeakSet),L=i(null),R=typeof window>`u`?n:r,z=i(new Set),B=i(null),V=i(null),H=i(null),U=i({}),W=i(null),G={};if(y!==void 0&&(G.design=l(y)),b!==void 0&&(G.accessories=l(b)),S!==void 0&&(G.motion=l(S)),x!==void 0&&h(x),typeof x==`string`)G[`body-orientation`]=x;else if(x!==void 0)for(let e of[`yaw`,`pitch`,`roll`])x[e]!==void 0&&(G[`body-${e}`]=String(x[e]));for(let e of Object.keys(s)){let t=f[e];t!==void 0&&(G[s[e]]=String(t)),delete k[e]}let K=t(e=>{if(W.current?.node===e&&W.current.ref===g)return;let t=W.current;if(W.current=null,t?.cleanup?t.cleanup():typeof t?.ref==`function`?t.ref(null):t?.ref&&(t.ref.current=null),!e)return;let n=typeof g==`function`?g(e):void 0;g&&typeof g!=`function`&&(g.current=e),W.current={node:e,ref:g,...typeof n==`function`?{cleanup:n}:{}}},[g]),q=t(e=>{I.current.has(e)||(I.current.add(e),F.current.push(e),L.current&&queueMicrotask(L.current))},[]),J=t(e=>{A.current=e,e||K(null)},[K]);for(let e of Object.keys(c))delete k[e];return R(()=>{N.current=f;let e=A.current;if(e){for(let t of z.current)t in G||e.removeAttribute(t);for(let[t,n]of Object.entries(G))e.getAttribute(t)!==n&&e.setAttribute(t,n);z.current=new Set(Object.keys(G)),queueMicrotask(()=>P.current?.())}}),R(()=>{let e=A.current;if(!e)return;let t=!0,n,r=()=>{if(t&&A.current===e){if(typeof e.setDesign==`function`){let t=N.current.positioning,n=B.current;if(t!==void 0||n?.node===e){let r=t??null;if(n?.node!==e||!_(n.value,r)){B.current={node:e,value:v(r)};try{e.positioning=r}catch(t){e.dispatchEvent(new CustomEvent(`sidekick-error`,{detail:{message:String(t),attribute:`positioning`},bubbles:!0,composed:!0}))}}}let r=N.current.entrance,i=V.current;if(r!==void 0||i?.node===e){let t=r??null;if(i?.node!==e||!a(i.value,t)){V.current={node:e,value:t?{...t}:null};try{e.entrance=t}catch(t){e.dispatchEvent(new CustomEvent(`sidekick-error`,{detail:{message:String(t),attribute:`entrance`},bubbles:!0,composed:!0}))}}}let o=N.current.behavior,s=H.current;if(o!==void 0||s?.node===e){let t=o??null;try{(s?.node!==e||!u(s.value,t))&&(H.current={node:e,value:d(t)},e.behavior=t)}catch(t){e.dispatchEvent(new CustomEvent(`sidekick-error`,{detail:{message:t instanceof Error?t.message:String(t),attribute:`behavior`},bubbles:!0,composed:!0}))}}for(let t of[`home`,`presence`,`task`]){let n=N.current[t],r=U.current[t];if(n===void 0&&r?.node!==e)continue;let i=n??null;try{(r?.node!==e||!m(r.value,i))&&(U.current[t]={node:e,value:p(i)},t===`home`?e.home=i:t===`presence`?e.presence=i:e.task=i)}catch(n){e.dispatchEvent(new CustomEvent(`sidekick-error`,{detail:{message:n instanceof Error?n.message:String(n),attribute:t},bubbles:!0,composed:!0}))}}K(e)}(n&&M.current!==n||!j.current&&e.ready)&&(j.current=!0,M.current=n??null,N.current.onReady?.(n??new CustomEvent(`sidekick-ready`,{detail:{}})))}};P.current=r;let i=()=>{if(!t||A.current!==e)return;let n=F.current.splice(0);for(let r of n){if(!t)break;r.target===e&&N.current.onError?.(r)}};L.current=i;let s=Object.entries(c).map(([i,a])=>{let o=e=>{if(t){if(a===`sidekick-ready`)n=e,queueMicrotask(r);else if(a===`sidekick-error`)q(e);else{let t=N.current[i];t?.(e)}}};return e.addEventListener(a,o),[a,o]});return e.removeEventListener(`sidekick-error`,q),queueMicrotask(i),e.ownerDocument.defaultView?.customElements.get(o)?queueMicrotask(r):import(`./sidekick-element.js`).then(({defineSidekick:n})=>{t&&A.current===e&&(n(),queueMicrotask(r))}).catch(n=>{t&&A.current===e&&e.dispatchEvent(new CustomEvent(`sidekick-error`,{detail:{message:n instanceof Error?n.message:String(n)},bubbles:!0,composed:!0}))}),()=>{t=!1,P.current===r&&(P.current=null),L.current===i&&(L.current=null),e.removeEventListener(`sidekick-error`,q);for(let[t,n]of s)e.removeEventListener(t,n);K(null)}},[K,q]),e(o,{...k,"onsidekick-error":q,ref:J})}function _(e,t){return e===t||!!e&&!!t&&e.target===t.target&&(e.placement??`bottom-right`)===(t.placement??`bottom-right`)&&(e.gap??16)===(t.gap??16)&&(e.follow??!0)===(t.follow??!0)&&(e.offset?.x??0)===(t.offset?.x??0)&&(e.offset?.y??0)===(t.offset?.y??0)}function v(e){return e?{...e,...e.offset?{offset:{...e.offset}}:{}}:null}export{g as SidekickAvatar};