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
import{r as e}from"./sidekick-element.js";function t(e){if(!e||typeof e!=`object`||Array.isArray(e)||Object.keys(e).some(e=>e!==`x`&&e!==`y`))throw TypeError(`position requires x and y in CSS pixels`);for(let t of[e.x,e.y])if(typeof t!=`number`||!Number.isFinite(t)||Math.abs(t)>1e7)throw RangeError(`position must be finite CSS pixels within ±10000000`);return{x:e.x,y:e.y}}function n(t={}){if(!t||typeof t!=`object`||Array.isArray(t))throw TypeError(`options must be a plain object`);let n=Object.getPrototypeOf(t);if(n!==Object.prototype&&n!==null)throw TypeError(`options must be a plain object`);for(let e of Reflect.ownKeys(t)){if(typeof e!=`string`||![`duration`,`easing`,`travel`,`maxSpeed`,`acceleration`,`deceleration`].includes(e))throw TypeError(`unsupported movement option: ${String(e)}`);let n=Object.getOwnPropertyDescriptor(t,e);if(!n.enumerable||!Object.hasOwn(n,`value`))throw TypeError(`movement option ${e} must be an ordinary data property`)}let r=e({duration:t.duration,easing:t.easing});if(t.travel!==void 0&&t.travel!==`natural`&&t.travel!==`none`)throw TypeError(`unsupported travel mode`);for(let e of[`maxSpeed`,`acceleration`,`deceleration`])if(t[e]!==void 0&&(typeof t[e]!=`number`||!Number.isFinite(t[e])||t[e]<1||t[e]>1e5))throw RangeError(e+` must be between 1 and 100000`);return{...r,travel:t.travel??`natural`,maxSpeed:t.maxSpeed??1350,acceleration:t.acceleration??1800,deceleration:t.deceleration??2200}}const r=e=>Math.max(0,Math.min(1,e)),i=e=>e*e*(3-2*e),a=()=>({direction:[0,0],strength:0,lift:0,bank:0}),o=e=>({...e,direction:[...e.direction]});function s(e,t){let n=Math.hypot(e,t);return n>1e-9?[e/n,t/n]:[0,0]}function c(e,t,n){if(!Math.hypot(...t))return[...e];if(!Math.hypot(...e))return[...t];if(n===0)return[...e];if(n===1)return[...t];let r=Math.atan2(e[1],e[0])+Math.atan2(e[0]*t[1]-e[1]*t[0],e[0]*t[0]+e[1]*t[1])*n;return[Math.cos(r),Math.sin(r)]}var l=class{host;point={x:0,y:0};velocity={x:0,y:0};acceleration={x:0,y:0};phase=`idle`;progress=0;presentation=a();frame=0;revision=0;sampling=!1;reporting=!1;track;suspended=!1;suspendedAt=0;followTiming=n();constructor(e){this.host=e}get position(){return{...this.point}}get state(){return{phase:this.phase,progress:this.progress,position:this.position,velocity:{...this.velocity},acceleration:{...this.acceleration},speed:Math.hypot(this.velocity.x,this.velocity.y)}}to(e,r={}){let i=t(e),a=n(r);this.followTiming=a;let c=++this.revision,l=this.host.now();if(this.sample(l),c!==this.revision)return this.result(!1);let u=o(this.presentation);this.track&&this.complete(this.track,!1,!1);let d=this.host.constrain(i),f=this.host.immediate()?0:a.duration;if(!f||d.x===this.point.x&&d.y===this.point.y&&Math.hypot(this.velocity.x,this.velocity.y)<.01&&(a.travel!==`natural`||Math.hypot(this.acceleration.x,this.acceleration.y)<.01)){if(this.write(d),c!==this.revision)return this.result(!1);this.progress=1;let e={finished:!0,position:this.position};return this.reset(),this.report(),new Promise(t=>this.notify(e,t))}return a.travel===`natural`?new Promise(e=>{let t=Math.hypot(d.x-this.point.x,d.y-this.point.y);this.track={kind:`physical`,to:d,start:l,last:l,accumulator:0,maxSpeed:a.maxSpeed,acceleration:a.acceleration,deceleration:a.deceleration,initialDistance:Math.max(t,1),stopping:!1,resolve:e},this.progress=0,this.phase=Math.hypot(this.velocity.x,this.velocity.y)>.1?`flight`:`takeoff`,this.report(),this.schedule()}):new Promise(e=>{let t=s(d.x-this.point.x,d.y-this.point.y);this.track={kind:`travel`,from:this.position,to:d,start:l,duration:f,smooth:a.easing===`smooth`,natural:a.travel===`natural`,intensity:Math.min(1,Math.hypot(d.x-this.point.x,d.y-this.point.y)/100),fromTravel:0,presentation:u,headingFrom:u.direction,heading:t,headingStart:l,turnDuration:Math.min(180,f*.15),resolve:e},this.progress=0,this.velocity={x:0,y:0},this.acceleration={x:0,y:0},this.phase=this.track.natural?`takeoff`:`flight`,this.report(),this.schedule()})}by(e,r={},i=e=>e){let a=t(e);n(r);let o=++this.revision;return this.sample(this.host.now()),o===this.revision?this.to(i({x:this.point.x+a.x,y:this.point.y+a.y}),r):this.result(!1)}cancel(e=!1){let t=++this.revision,n=this.track;if(!n)return;if(e||this.host.immediate()){this.complete(n,!1);return}if(this.sample(this.host.now()),t!==this.revision)return;let r=this.track;r&&(r.kind===`settling`?r.finished=!1:r.kind===`physical`?(r.stopping=!0,this.phase=`braking`,this.report(),this.schedule()):!this.presentation.strength&&!this.presentation.lift&&!this.presentation.bank?this.complete(r,!1):(this.stopFrame(),this.track={kind:`settling`,start:this.host.now(),duration:180,presentation:o(this.presentation),resolve:r.resolve,silent:r.silent},this.velocity={x:0,y:0},this.phase=`settling`,this.report(),this.schedule()))}relocate(e){let n=t(e),r=++this.revision;this.track&&this.complete(this.track,!1),r===this.revision&&(this.write(n),r===this.revision&&this.reset())}followTarget(e){let n=this.host.constrain(t(e)),r=this.track;if(r?.kind===`physical`&&!r.stopping||r?.kind===`travel`){r.to=n;return}if(r&&!(r.kind===`settling`&&r.finished))return;let i=Math.hypot(n.x-this.point.x,n.y-this.point.y);if(i<=.5)return;if(this.host.immediate()){this.suspended||this.write(n);return}let a=this.host.now();this.track={kind:`physical`,to:n,start:a,last:a,accumulator:0,maxSpeed:this.followTiming.maxSpeed,acceleration:this.followTiming.acceleration,deceleration:this.followTiming.deceleration,initialDistance:Math.max(i,1),stopping:!1,resolve:r?.resolve??(()=>{}),silent:r?.silent??!r},this.progress=0,this.phase=`takeoff`,this.schedule()}suspend(e){if(this.suspended===e)return;let t=this.host.now();this.suspended=e,e?(this.suspendedAt=t,this.stopFrame()):(this.track?.kind===`physical`?(this.track.last=t,this.track.accumulator=0):this.track&&(this.track.start+=Math.max(0,t-Math.max(this.suspendedAt,this.track.start))),this.schedule())}stopFollowing(){this.track?.silent&&this.cancel()}disconnect(){this.cancel(!0)}resize(){let e=++this.revision,t=this.suspended?Math.max(this.suspendedAt,this.track?.start??this.suspendedAt):this.host.now();if(this.sample(t),e!==this.revision)return;let n=this.position;if(this.write(this.host.constrain(this.point)),e!==this.revision||(this.point.x!==n.x&&(this.velocity.x=0,this.acceleration.x=0),this.point.y!==n.y&&(this.velocity.y=0,this.acceleration.y=0),e!==this.revision))return;let i=this.track;i?.kind===`physical`?(i.to=this.host.constrain(i.to),this.report()):(i?.kind===`travel`&&(i.fromTravel=this.travelFraction(i,r((t-i.start)/i.duration)),i.from=this.position,i.to=this.host.constrain(i.to),i.headingFrom=[...this.presentation.direction],i.heading=s(i.to.x-i.from.x,i.to.y-i.from.y),i.headingStart=t,i.turnDuration=Math.min(120,Math.max(0,i.start+i.duration-t))),this.velocity={x:0,y:0},this.report())}finish(){this.revision++,this.finishCurrent()}finishCurrent(){let e=this.track;e?.kind===`physical`&&!e.stopping||e?.kind===`travel`?(this.write(this.host.constrain(e.to)),this.progress=1,this.complete(e,!0)):e?this.complete(e,e.kind===`settling`?e.finished??!1:!1):(this.reset(),this.report())}write(e){this.point={...e},this.host.render(this.position)}report(){if(!this.reporting){this.reporting=!0;try{this.host.progress?.(this.state)}finally{this.reporting=!1}}}present(e){this.presentation=o(e),this.host.presentation?.(o(e))}reset(){this.phase=`idle`,this.velocity={x:0,y:0},this.acceleration={x:0,y:0},this.present(a())}stopFrame(){this.frame&&this.host.cancelFrame(this.frame),this.frame=0}schedule(){this.track&&!this.frame&&!this.suspended&&(this.frame=this.host.requestFrame(this.tick))}complete(e,t,n=!0){if(this.track!==e)return;this.track=void 0,this.stopFrame();let r={finished:t,position:this.position};n&&(this.reset(),this.report()),e.silent?e.resolve(r):this.notify(r,e.resolve)}result(e){let t={finished:e,position:this.position};return new Promise(e=>this.notify(t,e))}notify(e,t){queueMicrotask(()=>{try{let n=this.host.complete(e);n?Promise.resolve(n).then(()=>t(e),()=>t(e)):t(e)}catch{t(e)}})}travelFraction(e,t){let n=e.natural?t<=.15?0:t>=.85?1:(t-.15)/.7:t;return e.smooth?i(n):n}sample(e){if(!(this.sampling||this.suspended)){this.sampling=!0;try{this.sampleTrack(e)}finally{this.sampling=!1}}}sampleTrack(e){let t=this.track;if(!t)return;if(this.host.immediate()){this.finishCurrent();return}if(t.kind===`physical`){this.samplePhysical(t,e);return}let n=r((e-t.start)/t.duration);if(t.kind===`settling`){let e=1-i(n);if(this.present({direction:[...t.presentation.direction],strength:t.presentation.strength*e,lift:t.presentation.lift*e,bank:t.presentation.bank*e}),this.track!==t)return;n===1?this.complete(t,t.finished??!1):this.report();return}let a=this.travelFraction(t,n),o=1-t.fromTravel,s=o>1e-9?r((a-t.fromTravel)/o):1,l={x:t.from.x+(t.to.x-t.from.x)*s,y:t.from.y+(t.to.y-t.from.y)*s},u=this.host.constrain(l),d=t.natural?r((n-.15)/.7):n,f=!t.natural||n>=.15&&n<.85,p=f&&n<1&&o>1e-9?(t.smooth?6*d*(1-d):1)/(t.duration*(t.natural?.7:1)*o)*1e3:0;this.velocity={x:u.x===l.x?(t.to.x-t.from.x)*p:0,y:u.y===l.y?(t.to.y-t.from.y)*p:0};let m=t.smooth&&f&&n<1&&o>1e-9?6*(1-2*d)/((t.duration/1e3)**2*o):0;if(this.acceleration={x:u.x===l.x?(t.to.x-t.from.x)*m:0,y:u.y===l.y?(t.to.y-t.from.y)*m:0},this.progress=n,this.phase=t.natural?n<.15?`takeoff`:n<.85?`flight`:`landing`:`flight`,this.write(u),this.track===t){if(n===1)this.complete(t,!0);else{if(t.natural){let a=t.turnDuration?i(r((e-t.headingStart)/t.turnDuration)):1,o=c(t.headingFrom,t.heading,a),s=i(r(n/.15)),l=1-i(r((n-.85)/.15)),u=(t.presentation.strength+(t.intensity-t.presentation.strength)*s)*l,d=(t.presentation.lift+(.06*t.intensity-t.presentation.lift)*s)*l,f=(t.presentation.bank+(-o[0]*.12*t.intensity-t.presentation.bank)*s)*l;this.present({direction:o,strength:u,lift:d,bank:f})}else{let n=1-i(r((e-t.start)/Math.min(180,t.duration)));this.present({direction:[...t.presentation.direction],strength:t.presentation.strength*n,lift:t.presentation.lift*n,bank:t.presentation.bank*n})}this.track===t&&this.report()}}}samplePhysical(e,t){let n=Math.max(0,Math.min(.1,(t-e.last)/1e3));e.accumulator+=n,e.last=t;let r=1/240,a=!1;for(;e.accumulator+1e-10>=r;){e.accumulator=Math.max(0,e.accumulator-r);let t=.06,n=Math.hypot(e.to.x-this.point.x,e.to.y-this.point.y),i=Math.hypot(this.velocity.x,this.velocity.y),o=Math.hypot(this.acceleration.x,this.acceleration.y),s=Math.min(.1,e.deceleration*r),c=Math.min(1,e.acceleration*.01,e.deceleration*.01);if((e.stopping||n<.08)&&i<s&&o<c){e.stopping||(this.point={...e.to}),this.velocity={x:0,y:0},this.acceleration={x:0,y:0},a=!0;break}let l=e.to.x-(this.point.x+t*this.velocity.x),u=e.to.y-(this.point.y+t*this.velocity.y),d=Math.hypot(l,u),f=this.velocity.x+t*this.acceleration.x,p=this.velocity.y+t*this.acceleration.y,m=Math.hypot(f,p),h=e.stopping?0:Math.min(e.maxSpeed,Math.sqrt(2*e.deceleration*d)*.9,d/(2*r)),g=d>1e-9?l/d*h:0,_=d>1e-9?u/d*h:0,v=g-f,y=_-p,b=Math.hypot(v,y),x=v*f+y*p,S=e.stopping||x<-1e-8,C=f,w=p,T=S&&b>0?Math.min(1,Math.max(0,-x/(b*b))):0,E=S?Math.min(r,b*T/e.deceleration):0,D=b>0?e.deceleration*E/b:0,O=C+v*D,k=w+y*D,A=r-E,j=g-O,M=_-k,N=Math.hypot(j,M),P=N>0?Math.min(1,e.acceleration*A/N):0,F=O+j*P,I=k+M*P,L=(e,n,r)=>{if(e<=0)return;let i=Math.exp(-e/t),a=t*(1-i),o=this.acceleration.x,s=this.acceleration.y;this.point.x+=this.velocity.x*e+n*e**2/2+(o-n)*t*(e-a),this.point.y+=this.velocity.y*e+r*e**2/2+(s-r)*t*(e-a),this.velocity.x+=n*e+(o-n)*a,this.velocity.y+=r*e+(s-r)*a,this.acceleration.x=n+(o-n)*i,this.acceleration.y=r+(s-r)*i};E>0&&L(E,(O-C)/E,(k-w)/E),A>0&&L(A,(F-O)/A,(I-k)/A);let R={...this.point},z=this.host.constrain(R);z.x!==R.x&&(this.velocity.x=0,this.acceleration.x=0),z.y!==R.y&&(this.velocity.y=0,this.acceleration.y=0),this.point=z,this.phase=e.stopping?`braking`:S?`landing`:m<30?`takeoff`:`flight`}if(this.host.render(this.position),this.track!==e)return;let l=Math.hypot(this.velocity.x,this.velocity.y);this.progress=Math.max(this.progress,Math.min(.999,1-Math.hypot(e.to.x-this.point.x,e.to.y-this.point.y)/e.initialDistance));let u=l>1||!Math.hypot(...this.presentation.direction)&&l>1e-7?s(this.velocity.x,this.velocity.y):this.presentation.direction,d=c(this.presentation.direction,u,1-Math.exp(-24*n)),f=1-Math.exp(-12*n),p=i(Math.min(1,l/160)),m=this.presentation.strength+(p-this.presentation.strength)*f,h=Math.max(-.12,Math.min(.12,-this.acceleration.x/Math.max(e.acceleration,e.deceleration)*.12));a||this.present({direction:d,strength:m,lift:.06*m,bank:this.presentation.bank+(h-this.presentation.bank)*f}),this.track===e&&(a&&(e.stopping||(this.progress=1),this.track={kind:`settling`,start:t,duration:180,presentation:o(this.presentation),finished:!e.stopping,resolve:e.resolve,silent:e.silent},this.phase=`settling`),this.report())}tick=e=>{this.frame=0,this.sample(e),this.schedule()}};const u={left:0,center:.5,right:1},d={top:0,center:.5,bottom:1},f=e=>e.assignedSlot??e.parentElement??e.getRootNode().host??null;function p(e,t){for(let n=t;n;n=f(n))if(n===e)throw TypeError(`anchor target cannot be the avatar or its descendant`)}function m(e,r,i,a={}){if(!a||typeof a!=`object`||Array.isArray(a))throw TypeError(`moveToElement options must be an object`);if(![Object.prototype,null].includes(Object.getPrototypeOf(a)))throw TypeError(`moveToElement options must be a plain object`);for(let e of Reflect.ownKeys(a)){let t=Object.getOwnPropertyDescriptor(a,e);if(typeof e!=`string`||!t.enumerable||!Object.hasOwn(t,`value`))throw TypeError(`moveToElement options require ordinary data properties`)}let{x:o=0,y:s=0,alignX:c=`left`,alignY:l=`top`,anchor:m=!1,...h}=a;if(typeof m!=`boolean`)throw TypeError(`anchor must be a boolean`);if(t({x:o,y:s}),n(h),typeof c!=`string`||typeof l!=`string`||!Object.hasOwn(u,c)||!Object.hasOwn(d,l))throw TypeError(`alignX must be left, center or right; alignY must be top, center or bottom`);let g=e.ownerDocument.defaultView;if(!g||!e.isConnected||!(i instanceof g.Element)||!i.isConnected||i.ownerDocument!==e.ownerDocument)throw TypeError(`moveToElement requires connected avatar and target Elements in the same document`);m&&p(e,i);let _=g.getComputedStyle(e).zoom;if(_&&_!==`1`&&_!==`normal`)throw TypeError(`moveToElement does not support CSS zoom on the avatar; use CSS transform: scale() instead`);let v=f(e);for(;v;){let e=g.getComputedStyle(v);if([e.transform,e.scale,e.rotate,e.perspective].some(e=>e&&e!==`none`)||e.zoom&&e.zoom!==`1`&&e.zoom!==`normal`)throw TypeError(`moveToElement does not support transformed or zoomed avatar ancestors; place the avatar directly under an untransformed document body`);v=f(v)}let y=e.getBoundingClientRect(),b=i.getBoundingClientRect();for(let e of[y,b])for(let t of[e.left,e.top,e.width,e.height])if(!Number.isFinite(t))throw TypeError(`moveToElement requires finite layout rectangles`);return{position:t({x:r.x+b.left-y.left+(b.width-y.width)*u[c]+o,y:r.y+b.top-y.top+(b.height-y.height)*d[l]+s}),options:h}}const h=[`top-left`,`top-center`,`top-right`,`center-left`,`center`,`center-right`,`bottom-left`,`bottom-center`,`bottom-right`];function g(e,t,n){if(!e||typeof e!=`object`||![Object.prototype,null].includes(Object.getPrototypeOf(e)))throw TypeError(`${n} must be a plain object`);for(let r of Reflect.ownKeys(e)){let i=Object.getOwnPropertyDescriptor(e,r);if(typeof r!=`string`||!t.includes(r)||!i.enumerable||!Object.hasOwn(i,`value`))throw TypeError(`${n} contains an unsupported property`)}}function _(e,t){g(e,[`target`,`placement`,`gap`,`offset`,`follow`],`positioning`);let n=e.target;if(typeof n==`string`){if(!n.trim())throw TypeError(`positioning target must be viewport, a selector, or an Element`);n!==`viewport`&&t.querySelector(n)}else if(!t.defaultView||!(n instanceof t.defaultView.Element)||n.ownerDocument!==t)throw TypeError(`positioning target must belong to the same document`);let r=e.placement??`bottom-right`,i=e.gap??16,a=e.follow??!0;if(!h.includes(r))throw TypeError(`invalid positioning placement`);if(typeof i!=`number`||!Number.isFinite(i)||i<0)throw TypeError(`positioning gap must be a non-negative finite number`);if(typeof a!=`boolean`)throw TypeError(`positioning follow must be boolean`);let o=e.offset??{};g(o,[`x`,`y`],`positioning offset`);let s=o.x??0,c=o.y??0;if(typeof s!=`number`||!Number.isFinite(s)||typeof c!=`number`||!Number.isFinite(c))throw TypeError(`positioning offsets must be finite numbers`);return{target:n,placement:r,gap:i,offset:{x:s,y:c},follow:a}}function v(e,t){return e===t||!!e&&!!t&&e.target===t.target&&(e.placement??`bottom-right`)===(t.placement??`bottom-right`)&&(e.gap??16)===(t.gap??16)&&(e.follow??!0)===(t.follow??!0)&&(e.offset?.x??0)===(t.offset?.x??0)&&(e.offset?.y??0)===(t.offset?.y??0)}function y(e){return e?{...e,...e.offset?{offset:{...e.offset}}:{}}:null}function b(e,t,n,r){let[i,a]=e.placement===`center`?[`center`,`center`]:e.placement.split(`-`),o=(t,n,i,a)=>t===`center`?n+(i-a)/2:t===`left`||t===`top`?n+(r?e.gap:-a-e.gap):n+i-(r?a+e.gap:-e.gap);return{x:o(a,n.left,n.width,t.width)+e.offset.x,y:o(i,n.top,n.height,t.height)+e.offset.y}}function x(e,n,r){let i=e.ownerDocument.defaultView,a=r.target===`viewport`?null:typeof r.target==`string`?e.ownerDocument.querySelector(r.target):r.target;if(r.target!==`viewport`&&(!a||!a.isConnected))throw TypeError(`positioning target is missing or disconnected`);a?(p(e,a),m(e,n,a)):m(e,n,e.ownerDocument.documentElement);let o=e.getBoundingClientRect(),s=b(r,o,a?.getBoundingClientRect()??{left:0,top:0,width:i.innerWidth,height:i.innerHeight},!a);return{position:t({x:n.x+s.x-o.left,y:n.y+s.y-o.top}),target:a}}export{p as a,n as c,_ as i,t as l,x as n,m as o,v as r,l as s,y as t};