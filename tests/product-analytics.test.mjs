import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createSiteAnalytics, analyticsConsentKey } from '../playground/site-analytics.js';
import { createSectionEngagement } from '../playground/section-engagement.js';
const ga = { production: true, enabled: 'true', measurementId: 'G-TESTONLY01', page: 'guide' };
const newWindow = t => { const dom = new JSDOM('<body></body>', { url: 'https://sidekick.hananakick.cc/guide.html?private=SECRET#state-emotion' }); t.after(() => dom.window.close()); return dom.window; };
function transport(t, settings = ga) {
 const win = newWindow(t), requests = []; win.fetch = () => { requests.push(true); throw Error('No direct analytics transport allowed'); };
 return { win, requests, analytics: createSiteAnalytics(win, settings) };
}
const events = win => (win.dataLayer ?? []).map(a=>[...a]).filter(a=>a[0]==='event');
const ready = (win,analytics) => { analytics.setConsent('granted');win.document.scripts[0].dispatchEvent(new win.Event('load')); };
test('GA-only consent starts with no script, ignores older consent and never creates direct fetch transport', t => {
 const {win,requests,analytics}=transport(t);
 assert.equal(win.document.scripts.length,0);assert.equal(analytics.getConsent(),null);
 assert.notEqual(analyticsConsentKey(ga),`sidekick.site.analytics.v1.${ga.measurementId}`);
 analytics.setConsent('denied');assert.equal(win.document.scripts.length,0);
 ready(win,analytics);assert.equal(win.document.scripts.length,1);assert.deepEqual(analytics.providers,['Google Analytics']);assert.equal(requests.length,0);
});
test('queued GA event attribution is frozen and revocation clears queued events', t => {
 const { win, analytics } = transport(t); analytics.setConsent('granted');
 analytics.record('section_engagement',{site_page:'guide',site_section:'state-emotion',active_duration_ms:1000,end_reason:'navigation'});
 win.history.replaceState({},'','#state-behavior'); analytics.trackPage(); win.document.scripts[0].dispatchEvent(new win.Event('load'));
 const event = win.dataLayer.map(a=>[...a]).find(a=>a[0]==='event'&&a[1]==='section_engagement');
 assert.equal(event[2].page_location,'https://sidekick.hananakick.cc/guide/state-emotion');
 const late = transport(t); late.analytics.setConsent('granted'); late.analytics.setConsent('denied'); late.win.document.scripts[0].dispatchEvent(new late.win.Event('load')); assert.equal(late.win.dataLayer.some(a=>a[0]==='event'),false);
});
function clockFixture(t) {
 const win = newWindow(t); let time=0, visible=true, focus=true, id=0; const timers=new Map(), events=[];
 Object.defineProperty(win.document,'visibilityState',{get:()=>visible?'visible':'hidden'}); win.document.hasFocus=()=>focus;
 win.setTimeout=(fn,ms)=>{timers.set(++id,{fn,due:time+ms});return id;}; win.clearTimeout=i=>timers.delete(i);
 const engine=createSectionEngagement(win,{initialSection:{site_page:'guide',site_section:'state-emotion'},now:()=>time,emit:(name,props)=>events.push({name,...props})});
 t.after(()=>engine.dispose());
 return { win,engine,events,timers, advance(ms,run=true){time+=ms;if(run){for(const [key,timer]of [...timers])if(timer.due<=time){timers.delete(key);timer.fn();}}}, visible(value){visible=value;win.document.dispatchEvent(new win.Event('visibilitychange'));}, focus(value){focus=value;win.dispatchEvent(new win.Event(value?'focus':'blur'));} };
}
test('dwell excludes preconsent/background/unfocused/idle time and withdraw discards pending span', t => {
 const f=clockFixture(t);f.advance(5000);f.engine.setEnabled(true);f.advance(5000);f.focus(false); assert.equal(f.events[0].active_duration_ms,5000);
 f.advance(60000);f.focus(true);f.advance(40000); assert.equal(f.events.at(-1).active_duration_ms,30000); assert.equal(f.events.at(-1).end_reason,'idle');
 const count=f.events.length;f.advance(60000);assert.equal(f.events.length,count);
 f.win.dispatchEvent(new f.win.Event('pointerdown'));f.advance(1000);f.visible(false);assert.equal(f.events.at(-1).active_duration_ms,1000);
 f.advance(50000);f.visible(true);f.advance(2000);f.engine.setEnabled(false);assert.equal(f.events.length,count+1);
 assert.equal(f.timers.size,0);
});
test('section switches flush previous section once; continuous activity heartbeat preserves delayed timer backlog', t => {
 const f=clockFixture(t);f.engine.setEnabled(true);f.advance(7000);f.engine.setSection({site_page:'guide',site_section:'state-behavior'});
 assert.equal(f.events[0].site_section,'state-emotion');assert.equal(f.events[0].active_duration_ms,7000);
 f.engine.setSection({site_page:'guide',site_section:'state-behavior'});assert.equal(f.events.length,1);
 for(let i=0;i<7;i++){f.advance(10000,false);f.win.dispatchEvent(new f.win.Event('keydown'));}
 f.engine.flush('pagehide'); const measured=f.events.slice(1); assert.equal(measured.reduce((sum,e)=>sum+e.active_duration_ms,0),70000);
 assert.ok(measured.every(e=>e.active_duration_ms<=30000&&e.site_section==='state-behavior'));
});
test('API Guide exercises follow allowlisted hash sections', t => {
 const {win,analytics}=transport(t,{...ga,page:'api'});win.document.documentElement.dataset.guideExercise='true';ready(win,analytics);
 analytics.setSection('api','state-emotion');win.history.replaceState({},'','#state-behavior');analytics.trackPage();
 assert.equal(events(win).filter(a=>a[1]==='section_view').at(-1)[2].site_section,'state-behavior');
 const count=events(win).length;win.history.replaceState({},'','#SECRET');analytics.trackPage();assert.equal(events(win).length,count);
});
test('bounded handoff groups sanitize atomically before GA calls and retain consent guards', t => {
 const {win,analytics}=transport(t);
 const batch=Array.from({length:24},()=>({name:'setting_observation',properties:{site_page:'studio',site_section:'appearance',setting_key:'body_shape',value_category:'square',observation_source:'copy',raw:'SECRET'}}));
 assert.equal(analytics.recordBatch(batch),false);ready(win,analytics);const before=events(win).length;
 assert.equal(analytics.recordBatch(batch),true);assert.equal(events(win).length,before+24);
 for(const event of events(win).slice(before)){assert.equal(event[2].page_location,'https://sidekick.hananakick.cc/studio');assert.equal(JSON.stringify(event).includes('SECRET'),false);}
 for(const malformed of [[...batch,...batch],[null],new Array(1),[{get name(){throw Error('getter')},properties:batch[0].properties}],Object.defineProperty([],0,{get(){throw Error('index getter')}}),[{name:'setting_observation',properties:{...batch[0].properties,value_category:'secret'}}]]) assert.equal(analytics.recordBatch(malformed),false);
 assert.equal(events(win).length,before+24);analytics.setConsent('denied');assert.equal(analytics.recordBatch(batch),false);
});
test('successful handoff records one action plus bounded observations exactly once', async t => {
 const {mountSiteAnalytics}=await import('../playground/site-analytics.js');const {prepareBotUsage}=await import('../playground/site-product-usage.js');const {createScene}=await import('../src/core/scene.ts');
 const win=newWindow(t),analytics=mountSiteAnalytics(win.document,'studio',ga);ready(win,analytics);
 const scene=createScene(),finish=prepareBotUsage(win,'bot_copy',scene.design,{site_page:'studio',site_section:'appearance',format:'json'},scene);
 const before=events(win).length;assert.equal(finish(),true);assert.equal(finish(),false);const added=events(win).slice(before);
 assert.equal(added[0][1],'bot_copy');assert.ok(added.length<=25);assert.ok(added.some(e=>e[1]==='setting_observation'&&e[2].setting_key==='body_color_family'));
});
