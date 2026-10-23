// A viewport-relative walking partner, independent of contextual narration.
// This marker is sampled by Sidekick's existing shared anchor scheduler. Scroll
// events only update its destination; they never start their own animation loop.
export function createCompanionFollow({bot,doc,win,root,site,createScrollRegions}){
 if(createScrollRegions&&root)return createRegionCompanion({bot,root,site,createScrollRegions});
 const marker=doc.createElement('span');marker.dataset.companionFollow='';marker.setAttribute('aria-hidden','true');
 Object.assign(marker.style,{position:'fixed',width:'1px',height:'1px',pointerEvents:'none',opacity:'0',left:'0px',top:'0px'});doc.body.append(marker);
 let owned=false,disposed=false,drift=0,last=0,revision=0;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function place(delta=0){
  const now=win.performance.now(),elapsed=last?Math.min(200,now-last):16;last=now;
  drift=clamp(drift*Math.exp(-elapsed/220)-delta*.2,-72,72);
  const width=bot.offsetWidth||115,height=bot.offsetHeight||115;
  const viewport=win.visualViewport,viewWidth=viewport?.width||win.innerWidth,viewHeight=viewport?.height||win.innerHeight;
  const left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0;
  const spaceX=Math.max(0,viewWidth-width),spaceY=Math.max(0,viewHeight-height);
  marker.style.left=`${left+Math.max(0,spaceX-Math.min(20,spaceX/2))}px`;
  marker.style.top=`${top+clamp(viewHeight*.56-height/2+drift,Math.min(64,spaceY/3),Math.max(0,spaceY-Math.min(88,spaceY/3)))}px`;
 }
 function follow(delta=0){
  if(disposed)return;place(delta);
  if(owned)return;owned=true;
  // Natural travel preserves velocity when taking over an interrupted approach.
  const token=++revision,failed=()=>{if(token===revision)owned=false;};
  try{void Promise.resolve(bot.moveToElement(marker,{alignX:'left',alignY:'top',anchor:true,travel:'natural',duration:win.matchMedia('(prefers-reduced-motion: reduce)').matches?0:550,maxSpeed:700,acceleration:1800,deceleration:2200})).then(result=>{if(result?.finished===false)failed();},failed);}catch{failed();}
 }
 return {follow,settle(){if(owned){drift=0;place();}},get active(){return owned;},release(){revision++;owned=false;},dispose(){revision++;disposed=true;owned=false;marker.remove();}};
}

// The activation region is intentionally broader than a reaction target. Reading
// a catalog/feed keeps the companion parked; contextual narration still owns its
// own approach and speech. Region transitions reuse one physics anchor.
function createRegionCompanion({bot,root,site,createScrollRegions}){
 const selectors=site==='company'?['.nova-hero','#nova-design','#nova-sound','#nova-compare','#nova-configure']:
  site==='shop'?['.muse-hero','#products','#muse-edit','.muse-collections']:['.th-compose','#th-feed'];
 const spots=[];
 const regions=selectors.flatMap((selector,index)=>{
  const region=root.querySelector(selector);if(!region)return[];
  const spot=root.ownerDocument.createElement('span');spot.dataset.companionRest='';spot.setAttribute('aria-hidden','true');
  Object.assign(spot.style,{position:'fixed',width:'1px',height:'1px',opacity:'0',pointerEvents:'none',right:`${20+(bot.offsetWidth||115)}px`,top:`calc(${index%2?60:44}vh - ${(bot.offsetHeight||115)/2}px)`});
  root.ownerDocument.body.append(spot);spots.push(spot);
  const waitAt={element:spot};
  return [{id:`${site}-${index}`,region,target:region.querySelector('h2,h1,button,[data-product],.th-post')||region,waitAt}];
 });
 // A content root fallback also covers authored intro/footer gaps.
 if(!regions.length)regions.push({id:site,region:root,target:root});
 let controller=null,active=false,disposed=false;
 return {
  follow(){if(disposed)return;if(!controller)controller=createScrollRegions(bot,{regions,hysteresis:64});else if(!active)controller.resume();else controller.refresh();active=!controller.paused;},
  settle(){if(active)controller?.refresh();},
  get active(){return active&&!controller?.paused;},
  release(){active=false;controller?.pause();},
  dispose(){disposed=true;active=false;controller?.dispose();spots.forEach(spot=>spot.remove());},
 };
}
