// A viewport-relative walking partner, independent of contextual narration.
// This marker is sampled by Sidekick's existing shared anchor scheduler. Scroll
// events only update its destination; they never start their own animation loop.
export function createCompanionFollow({bot,doc,win}){
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
