// Demo-only geometry: speech placement is a preference and may flip or clamp.
// Plan the complete envelope, not merely the avatar's host rectangle.
const box=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
const clamp=(n,low,high)=>Math.max(low,Math.min(Math.max(low,high),n));
export const overlaps=(a,b,gap=0)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
export const inside=(r,v)=>r.left>=v.left+8&&r.right<=v.right-8&&r.top>=v.top+8&&r.bottom<=v.bottom-8;
export function speechBox(host,size,viewport,placement){
 const above=host.top-size.height-10,below=host.bottom+10;
 const fitsAbove=above>=viewport.top+8,fitsBelow=below+size.height<=viewport.bottom-8;
 const top=placement==='bottom'?(fitsBelow||!fitsAbove?below:above):(fitsAbove||!fitsBelow?above:below);
 return box(clamp(host.left+(host.width-size.width)/2,viewport.left+8,viewport.right-size.width-8),clamp(top,viewport.top+8,viewport.bottom-size.height-8),size.width,size.height);
}
export function clearEnvelope(host,bubble,viewport,protectedRects){
 return inside(host,viewport)&&inside(bubble,viewport)&&!overlaps(host,bubble)&&protectedRects.every(r=>!overlaps(host,r,8)&&!overlaps(bubble,r,8));
}
export function planCompanyPresentation({target,host,speech,viewport,protectedRects,visuals=[]}){
 const candidates=[];
 const add=(x,y,placement,visual)=>candidates.push({host:box(x,y,host.width,host.height),placement,visual});
 for(const x of [target.right-host.width,target.left,target.left+(target.width-host.width)/2]){
  add(x,target.top-host.height-8,'top');add(x,target.bottom+8,'bottom');
 }
 for(const visual of visuals){
  const left=Math.max(viewport.left+8,visual.left),right=Math.min(viewport.right-8,visual.right);
  const top=Math.max(viewport.top+8,visual.top),bottom=Math.min(viewport.bottom-8,visual.bottom);
  if(right<=left||bottom<=top)continue;
  for(const x of [right-host.width,left,left+(right-left-host.width)/2]){
   add(x,top,'top',visual);add(x,bottom-host.height,'top',visual);add(x,top,'bottom',visual);add(x,bottom-host.height,'bottom',visual);
   add(x,top+speech.height+10,'top',visual);add(x,bottom-host.height-speech.height-10,'bottom',visual);
   // Product images can share their surrounding whitespace. Candidate boundaries
   // come from actual nearby content, not arbitrary offsets or section padding.
   for(const r of protectedRects){
    add(x,r.bottom+8+speech.height+10,'top',visual);add(x,r.bottom+8,'bottom',visual);
    add(x,r.top-8-host.height,'top',visual);add(x,r.top-8-speech.height-10-host.height,'bottom',visual);
   }
  }
 }
 for(const candidate of candidates){
  if(candidate.visual&&!overlaps(candidate.host,candidate.visual))continue;
  const bubble=speechBox(candidate.host,speech,viewport,candidate.placement);
  if(clearEnvelope(candidate.host,bubble,viewport,protectedRects))return {...candidate,bubble,viewport,offset:{alignX:'left',alignY:'top',x:candidate.host.left-target.left,y:candidate.host.top-target.top}};
 }
 return null;
}
export function companyGeometry(target,win){
 const viewport=win.visualViewport;
 const left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0;
 const bounds=box(left,top,viewport?.width||win.innerWidth,viewport?.height||win.innerHeight);
 const section=target.closest('section')||target;
 const surface=target.closest('.nova-site')||section;
 const visible=el=>{const r=el.getBoundingClientRect();return r.width>1&&r.height>1&&overlaps(r,bounds);};
 return {viewport:bounds,target:target.getBoundingClientRect(),
  protectedRects:[...(target.matches('img,.nova-sound-visual,.nova-config-image')?[]:[target]),...surface.querySelectorAll('h1,h2,h3,p,button,a,input,select,textarea,[role="tablist"],.nova-finishes>div')].filter(visible).map(el=>el.getBoundingClientRect()),
  visuals:[...section.querySelectorAll('.nova-sound-visual,.nova-config-image,.nova-macro>img,.nova-compare-products img')].filter(visible).map(el=>el.getBoundingClientRect())};
}
// Non-live, inert sizing replica. The actual portal is checked after say() as a
// second guard; browser tests compare these dimensions to detect styling drift.
export function measureCompanySpeech(text,doc,viewport){
 const probe=doc.createElement('div');probe.dataset.companySpeechSizer='';probe.setAttribute('aria-hidden','true');probe.inert=true;
 probe.style.cssText=`position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;box-sizing:border-box;width:${Math.max(1,Math.min(280,viewport.width-16))}px;padding:12px 16px;border:1px solid transparent;font:500 14px/1.5 system-ui,sans-serif;overflow-wrap:anywhere;white-space:pre-wrap;display:flex;flex-direction:column;`;
 const message=doc.createElement('span');message.style.cssText='display:block;min-height:0;margin-right:22px';message.textContent=text;probe.append(message);doc.body.append(probe);
 try{const r=probe.getBoundingClientRect();return {width:r.width,height:r.height};}finally{probe.remove();}
}
export function actualCompanyClear(bot,root,target,win){
 const bubble=root?.shadowRoot?.querySelector('.bubble');
 if(!bubble)return false;
 const geometry=companyGeometry(target,win);
 return clearEnvelope(bot.getBoundingClientRect(),bubble.getBoundingClientRect(),geometry.viewport,geometry.protectedRects);
}

export function planCompanyRest({host,viewport,protectedRects,visuals}){
 for(const visual of [...visuals,viewport]){
  const xs=[Math.max(viewport.left+8,visual.left),Math.min(viewport.right-8,visual.right)-host.width];
  const ys=[Math.max(viewport.top+8,visual.top),Math.min(viewport.bottom-8,visual.bottom)-host.height,...protectedRects.flatMap(r=>[r.bottom+8,r.top-8-host.height])];
  for(const left of xs)for(const top of ys){const candidate=box(left,top,host.width,host.height);if(inside(candidate,viewport)&&overlaps(candidate,visual)&&protectedRects.every(r=>!overlaps(candidate,r,8)))return candidate;}
 }
 return null;
}
