'use client';
/*! Sidekick 0.12.0 | UNLICENSED; no license is granted for Sidekick itself.

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
import{r as e,t}from"./sidekick-element2.js";import{createElement as n,useCallback as r,useEffect as i,useLayoutEffect as a,useRef as o}from"react";function s(e,t){if(!e||!t)return e===t;let n=e,r=t;return Object.keys(n).length===Object.keys(r).length&&Object.keys(n).every(e=>n[e]===r[e])}const c=`sidekick-avatar`,l={emotion:`emotion`,emotionIntensity:`emotion-intensity`,placement:`placement`,positionX:`position-x`,positionY:`position-y`,movementBounds:`movement-bounds`,moveDuration:`move-duration`,moveEasing:`move-easing`,moveTravel:`move-travel`,moveMaxSpeed:`move-max-speed`,moveAcceleration:`move-acceleration`,moveDeceleration:`move-deceleration`,shape:`shape`,bodyColor:`body-color`,eyeColor:`eye-color`,expression:`expression`,leftExpression:`left-expression`,rightExpression:`right-expression`,smile:`smile`,blink:`blink`,leftSmile:`left-smile`,rightSmile:`right-smile`,leftBlink:`left-blink`,rightBlink:`right-blink`,headAccessory:`head-accessory`,headColor:`head-color`,eyesAccessory:`eyes-accessory`,eyesColor:`eyes-color`,mouthAccessory:`mouth-accessory`,mouthColor:`mouth-color`,neckAccessory:`neck-accessory`,neckColor:`neck-color`,leftEarAccessory:`left-ear-accessory`,leftEarColor:`left-ear-color`,rightEarAccessory:`right-ear-accessory`,rightEarColor:`right-ear-color`,bodyYaw:`body-yaw`,bodyPitch:`body-pitch`,bodyRoll:`body-roll`,zoom:`zoom`,gazeX:`gaze-x`,gazeY:`gaze-y`,activity:`activity`,paused:`paused`,interaction:`interaction`,mouseTracking:`mouse-tracking`,trackingMode:`tracking-mode`,renderStyle:`render-style`,shapeDuration:`shape-duration`,shapeEasing:`shape-easing`,motionDuration:`motion-duration`,motionEasing:`motion-easing`,time:`time`},u={onEmotionChange:`sidekick-emotion-change`,onReactionEnd:`sidekick-reaction-end`,onEnterEnd:`sidekick-enter-end`,onExitEnd:`sidekick-exit-end`,onMoveEnd:`sidekick-move-end`,onMoveProgress:`sidekick-move-progress`,onPlayEnd:`sidekick-play-end`,onAssetTransitionEnd:`sidekick-transition-end`,onBehaviorChange:`sidekick-behavior-change`,onBehaviorEnd:`sidekick-behavior-end`,onReady:`sidekick-ready`,onDesignChange:`sidekick-design-change`,onMotionEnd:`sidekick-motion-end`,onShapeEnd:`sidekick-shape-end`,onBodyOrientationChange:`sidekick-body-orientation-change`,onZoomChange:`sidekick-zoom-change`,onActivate:`sidekick-activate`,onError:`sidekick-error`};function d(e){return JSON.stringify(e,(e,t)=>typeof t==`object`&&t&&!Array.isArray(t)?Object.fromEntries(Object.entries(t).sort(([e],[t])=>e.localeCompare(t))):t)}function f(e,t){if(e===null||t===null)return e===t;if(typeof e!=`object`||typeof t!=`object`)return Object.is(e,t);let n=Reflect.ownKeys(e);return n.length!==Reflect.ownKeys(t).length||Object.getPrototypeOf(e)!==Object.getPrototypeOf(t)?!1:n.every(n=>{let r=Object.getOwnPropertyDescriptor(e,n),i=Object.getOwnPropertyDescriptor(t,n);if(!r||!i||!Object.hasOwn(r,`value`)||!Object.hasOwn(i,`value`)||r.enumerable!==i.enumerable)return!1;let a=r.value,o=i.value;return Array.isArray(a)&&Array.isArray(o)?a.length===o.length&&a.every((e,t)=>Object.is(e,o[t])):Object.is(a,o)})}function p(e){if(typeof e!=`object`||!e)return e;let t=Object.getOwnPropertyDescriptors(e);for(let e of Object.values(t))Object.hasOwn(e,`value`)&&Array.isArray(e.value)&&(e.value=[...e.value]);return Object.create(Object.getPrototypeOf(e),t)}function m(e){if(typeof e==`string`){if(![`front`,`three-quarter`,`side`].includes(e))throw TypeError(`bodyOrientation must be front, three-quarter, or side`);return}if(!e||typeof e!=`object`||Array.isArray(e))throw TypeError(`bodyOrientation must be a plain object or preset`);let t=Object.getPrototypeOf(e);if(t!==Object.prototype&&t!==null)throw TypeError(`bodyOrientation must be a plain object`);for(let t of Reflect.ownKeys(e)){let n=Object.getOwnPropertyDescriptor(e,t);if(t!==`yaw`&&t!==`pitch`&&t!==`roll`||!Object.hasOwn(n,`value`)||!n.enumerable)throw TypeError(`bodyOrientation accepts only yaw, pitch, and roll; use the separate zoom prop`);let r=t===`yaw`?360:t===`pitch`?90:180,i=n.value;if(typeof i!=`number`||!Number.isFinite(i)||i<-r||i>r)throw RangeError(`bodyOrientation.${t} must be a finite number between ${-r} and ${r}`)}}function h(h){for(let e of[`camera`,`cameraYaw`,`cameraPitch`,`cameraRoll`,`cameraZoom`,`view`,`viewYaw`,`viewPitch`,`viewRoll`,`viewZoom`,`onCameraChange`,`onViewChange`,`camera-yaw`,`camera-pitch`,`camera-roll`,`camera-zoom`,`view-yaw`,`view-pitch`,`view-roll`,`view-zoom`])if(Object.prototype.hasOwnProperty.call(h,e))throw TypeError(`${e} has been removed; use bodyOrientation, bodyYaw/bodyPitch/bodyRoll, zoom, onBodyOrientationChange or onZoomChange instead`);let{ref:g,design:_,accessories:v,bodyOrientation:y,motion:b,behavior:x,entrance:S,positioning:C,...w}=h,T=o(null),E=o(!1),D=o(null),O=o(h),k=o(null),A=o([]),j=o(new WeakSet),M=o(null),N=typeof window>`u`?i:a,P=o(new Set),F=o(null),I=o(null),L=o(null),R=o(null),z={};if(_!==void 0&&(z.design=d(_)),v!==void 0&&(z.accessories=d(v)),b!==void 0&&(z.motion=d(b)),y!==void 0&&m(y),typeof y==`string`)z[`body-orientation`]=y;else if(y!==void 0)for(let e of[`yaw`,`pitch`,`roll`])y[e]!==void 0&&(z[`body-${e}`]=String(y[e]));for(let e of Object.keys(l)){let t=h[e];t!==void 0&&(z[l[e]]=String(t)),delete w[e]}let B=r(e=>{if(R.current?.node===e&&R.current.ref===g)return;let t=R.current;if(R.current=null,t?.cleanup?t.cleanup():typeof t?.ref==`function`?t.ref(null):t?.ref&&(t.ref.current=null),!e)return;let n=typeof g==`function`?g(e):void 0;g&&typeof g!=`function`&&(g.current=e),R.current={node:e,ref:g,...typeof n==`function`?{cleanup:n}:{}}},[g]),V=r(e=>{j.current.has(e)||(j.current.add(e),A.current.push(e),M.current&&queueMicrotask(M.current))},[]),H=r(e=>{T.current=e,e||B(null)},[B]);for(let e of Object.keys(u))delete w[e];return N(()=>{O.current=h;let e=T.current;if(e){for(let t of P.current)t in z||e.removeAttribute(t);for(let[t,n]of Object.entries(z))e.getAttribute(t)!==n&&e.setAttribute(t,n);P.current=new Set(Object.keys(z)),queueMicrotask(()=>k.current?.())}}),N(()=>{let n=T.current;if(!n)return;let r=!0,i,a=()=>{if(r&&T.current===n){if(typeof n.setDesign==`function`){let r=O.current.positioning,i=F.current;if(r!==void 0||i?.node===n){let a=r??null;if(i?.node!==n||!e(i.value,a)){F.current={node:n,value:t(a)};try{n.positioning=a}catch(e){n.dispatchEvent(new CustomEvent(`sidekick-error`,{detail:{message:String(e),attribute:`positioning`},bubbles:!0,composed:!0}))}}}let a=O.current.entrance,o=I.current;if(a!==void 0||o?.node===n){let e=a??null;if(o?.node!==n||!s(o.value,e)){I.current={node:n,value:e?{...e}:null};try{n.entrance=e}catch(e){n.dispatchEvent(new CustomEvent(`sidekick-error`,{detail:{message:String(e),attribute:`entrance`},bubbles:!0,composed:!0}))}}}let c=O.current.behavior,l=L.current;if(c!==void 0||l?.node===n){let e=c??null;try{(l?.node!==n||!f(l.value,e))&&(L.current={node:n,value:p(e)},n.behavior=e)}catch(e){n.dispatchEvent(new CustomEvent(`sidekick-error`,{detail:{message:e instanceof Error?e.message:String(e),attribute:`behavior`},bubbles:!0,composed:!0}))}}B(n)}(i&&D.current!==i||!E.current&&n.ready)&&(E.current=!0,D.current=i??null,O.current.onReady?.(i??new CustomEvent(`sidekick-ready`,{detail:{}})))}};k.current=a;let o=()=>{if(!r||T.current!==n)return;let e=A.current.splice(0);for(let t of e){if(!r)break;t.target===n&&O.current.onError?.(t)}};M.current=o;let l=Object.entries(u).map(([e,t])=>{let o=n=>{if(r){if(t===`sidekick-ready`)i=n,queueMicrotask(a);else if(t===`sidekick-error`)V(n);else{let t=O.current[e];t?.(n)}}};return n.addEventListener(t,o),[t,o]});return n.removeEventListener(`sidekick-error`,V),queueMicrotask(o),n.ownerDocument.defaultView?.customElements.get(c)?queueMicrotask(a):import(`./sidekick-element3.js`).then(({defineSidekick:e})=>{r&&T.current===n&&(e(),queueMicrotask(a))}).catch(e=>{r&&T.current===n&&n.dispatchEvent(new CustomEvent(`sidekick-error`,{detail:{message:e instanceof Error?e.message:String(e)},bubbles:!0,composed:!0}))}),()=>{r=!1,k.current===a&&(k.current=null),M.current===o&&(M.current=null),n.removeEventListener(`sidekick-error`,V);for(let[e,t]of l)n.removeEventListener(e,t);B(null)}},[B,V]),n(c,{...w,"onsidekick-error":V,ref:H})}export{h as SidekickAvatar};